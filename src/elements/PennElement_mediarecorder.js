// MEDIARECORDER element
/* $AC$ PennController.newMediaRecorder(name,audio video) Creates a new audio and/or video MediaRecorder element $AC$ */
/* $AC$ PennController.getMediaRecorder(name) Retrieves an existing MediaRecorder element $AC$ */  

window.PennController._AddElementType("MediaRecorder", function(PennEngine) {

  const texts = {
    noSupport: "Your browser does not support media recording",
    accessWebcam: "This experiment needs to access your webcam",
    accessMicrophone: "This experiment needs to access your microphone",
    // accessBoth: "This experiment needs to access your webcam and your microphone",
    clickToGrant: "Click here to grant access",
    uploading: "Please wait while your recordings are being uploaded to the server...",
    generatingArchive: "An archive of your recordings is being generated...",
    downloadArchive: "Download an archive of your recordings",
    allUploaded: "All the recordings have been uploaded to the server",
    someUploaded: "Only some of the recordings could be uploaded!",
    noneUploaded: "None of the recordings could be uploaded!",
    sendInvitation: "The experimenters might ask you to send them the archive manually"
  }
  window.PennController.newTrial.MediaRecorderTexts = texts;

  if (window.MediaRecorder===undefined||navigator.mediaDevices===undefined||navigator.mediaDevices.getUserMedia===undefined){
    PennEngine.debug.error("This browser does not support media recording");
    return alert(texts.noSupport);
  }

  const constraints = {audio: false, video: false};
  const recorders = {}, mediaRecorderElements = [], blobs = [];
  let init = false, postURL, initiateMessage;
  
  const initiateRecorderCommand = async () => {
    insertUploadRecordingsBeforeSendResults();
    let message = initiateMessage;
    if (typeof(message)=="string" && message.match(/\.html?$/i)) message = window.htmlCodeToDOM({include: message});
    if (!(message instanceof Node) && (typeof(message)!="string" || message.length<1)) {
      if (constraints.audio && constraints.video && texts.accessBoth) message = texts.accessBoth;
      else {
        if (!constraints.audio && !constraints.video)
          PennEngine.debug.error("No audio or video stream requested; did you create at least one MediaRecorder element?");
        else {
          if (constraints.audio) message = "<p>"+texts.accessMicrophone+"</p>";
          if (constraints.video) message = (message||"") + "<p>"+texts.accessWebcam+"</p>";
        }
      }
      message += "<p><a href='javascript:;' class='mediarecorder-consent'>"+texts.clickToGrant+"</a></p>";
      const span = document.createElement("SPAN");
      span.innerHTML = message;
      message = span;
    }
    document.body.querySelector(".PennController-PennController").append(message);
    const consent = document.body.querySelector(".PennController-PennController .mediarecorder-consent");
    consent.style.display='none';
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      message.innerHTML = "<p>Stream is inaccessible</p><p>If you are using your recording device with another application, quit it and then refresh this page</p>"
      await new Promise(r=>null);
    }
    recorders.default = new MediaRecorder(stream);
    recorders.audio = recorders.default;
    recorders.video = recorders.default;
    if (constraints.video){
      const videoStream = stream.clone();
      videoStream.getAudioTracks().map(track=>videoStream.removeTrack(track));
      recorders.video = new MediaRecorder(videoStream);
      const audioStream = stream.clone();
      audioStream.getVideoTracks().map(track=>audioStream.removeTrack(track));
      recorders.audio = new MediaRecorder(audioStream);
    }
    const statusElement = document.createElement("DIV");
    statusElement.classList.add("PennController-recording-status");
    document.body.append(statusElement);
    [recorders.default,recorders.audio,recorders.video].forEach( r => {
      if (!(r instanceof MediaRecorder)) return;
      r.onstop = () => statusElement.classList.remove("PennController-recording-status-recording");
      r.onstart = () => statusElement.classList.add("PennController-recording-status-recording");
      r.onpause = () => statusElement.classList.remove("PennController-recording-status-recording");
      r.onresume = () => statusElement.classList.add("PennController-recording-status-recording");
      r.ondataavailable = e=>mediaRecorderElements.forEach(m=>m._status=="recording" && m._chunks.push(e.data));
    });
    consent.style.display='block';
    await new Promise(r=>consent.onclick=r);
    init=true;
  }
  initiateRecorderCommand.toString = ()=>`InitiateRecorder(${url},[message, consentText])`;
  window.PennController.newTrial.InitiateRecorder = (url,message,consent)=>{
    if (typeof(url)!="string" || url.length<1) PennEngine.debug.warning("Invalid url passed to InitiateRecorder: "+url);
    else postURL = url;
    initiateMessage = message;
    if (typeof(consent)=="string") texts.clickToGrant = consent;
    // InitiateRecorder returns a newTrial
    const t = PennController.newTrial( initiateRecorderCommand ).noFooter().noHeader();
    // back compatibility
    t.warning = m => { initiateMessage = m; return t; };
    t.consent = m => { texts.clickToGrant = m; return t; };
    return t;
  };
  
  let zipFilename = PennEngine.utils.uuid();
  window.PennController.newTrial.SetRecordingsZipFilename = fn => zipFilename = fn;
  const uploadedZipFiles = [];
  const zipBlobs = async (filename,blobs) => {
    const blobWriter = new PennEngine.zip.BlobWriter("application/zip");
    const writer = new PennEngine.zip.ZipWriter(blobWriter);
    for (let b=0; b<blobs.length; b++) await writer.add(blobs[b].filename, new PennEngine.zip.BlobReader(blobs[b].blob));
    await writer.close();
    return new File([blobWriter.getData()],filename);
  }
  const uploadPromises = [];
  const uploadRecordings = async ()=>{
    const uploadingBlobs = [];
    for (let b=0; b<blobs.length; b++){
      if (blobs[b].uploaded || blobs[b].uploading) continue;
      blobs[b].uploading = true;
      uploadingBlobs.push(blobs[b]);
    }
    if (uploadingBlobs.length==0) return;
    let filename = zipFilename+'.zip', n = 1;
    while (uploadedZipFiles.indexOf(filename)>=0) filename = zipFilename+'-'+(n+=1)+'.zip';
    const fileobj = await zipBlobs(filename,uploadingBlobs);
    let success;
    try {
      const uploadPromise = PennEngine.utils.upload(postURL,filename,fileobj,"application/zip");
      uploadPromises.push(uploadPromise);
      await uploadPromise;
      console.log("uploadPromise", uploadPromise);
      uploadingBlobs.forEach(b=>b.uploaded=true);
      success=true;
    }
    catch (e) { 
      uploadingBlobs.forEach(b=>(b.uploaded=false)||(b.uploading=false)); 
      PennEngine.debug.error("Failed to upload recordings: "+e);
      success=false;
    }
    const currentElement = PennEngine.order.current;
    PennEngine.trials.pushDirectlyToResults([
      [0,  currentElement.controller ? currentElement.controller : "UNKNOWN"],
      [1, (currentElement.itemNumber || currentElement.itemNumber == 0) ? currentElement.itemNumber : "DYNAMIC"],
      [2, (currentElement.elementNumber || currentElement.elementNumber == 0) ? currentElement.elementNumber : "DYNAMIC"],
      [3, (currentElement.type || currentElement.type == 0) ? currentElement.type.toString() : "DYNAMIC"],
      [4, currentElement.group instanceof Array && currentElement.group.length>0 ? currentElement.group[0] : "NULL"],
      [5 /*"PennElementName"*/, "UploadRecordings"],
      [6 /*"PennElementType"*/, "UploadRecordings"],
      [7 /*"Parameter"*/, "Upload"],
      [8 /*"Value"*/, filename],
      [9 /*"EventTime"*/, Date.now()],
      [10 /*"Comments"*/, success?"Success":"Failure"]
    ])
    return {success:success, filename: filename};
  }
  window.PennController.newTrial.UploadRecordings = (label,noblock) => PennController.newTrial(label,
    async ()=>{
      const controller = PennEngine.trials.running;
      const message=document.createElement("DIV");
      message.innerHTML = "<p>"+texts.uploading+"</p>";
      controller._node.append(message);
      const promise = uploadRecordings();
      if (noblock==undefined) {
        await promise;
        await Promise.allSettled(uploadPromises);
        await new Promise(r=>setTimeout(r,100)); // leave time for blobs' status to be updated
        if (blobs.find(b=>b.uploaded!==true)) await uploadRecordings();  // upload the blobs that failed
      }
    }
  );
  window.PennController.newTrial.DownloadRecordingsButton = text => {
    const button = document.createElement("BUTTON"); button.innerText = text;
    button.onclick = async ()=>{
      const file = await zipBlobs("recordings.zip", blobs);
      const a = document.createElement("A");
      a.href = URL.createObjectURL(file);
      a.target = "_blank"; a.download = "recordings.zip"; a.style.display = 'none';
      document.body.append(a); a.click(); a.remove();
    }
    return button;
  }
  let inserted = false
  const insertUploadRecordingsBeforeSendResults = () => {
    if (inserted) return;
    inserted = true;
    // Automatically insert UploadRecordings before SendResults
    const oldInit = window.jQuery.ui.__SendResults__.prototype._init;
    window.jQuery.ui.__SendResults__.prototype._init = async function(){
      // Create a link to let participants download their recordings
      if (this.recordingsHeader===undefined){
        this.recordingsHeader = document.createElement("P");
        this.uploadElement = document.createElement("DIV");
        this.uploadElement.innerText = texts.generatingArchive;
        this.recordingsHeader.append(this.uploadElement);
        if (blobs.length>0) this.element.append(this.recordingsHeader);
        const link = document.createElement("A");
        link.innerText = texts.downloadArchive;
        const file = await zipBlobs("recordings.zip", blobs);
        link.href = URL.createObjectURL(file);
        link.target = "_blank";
        link.download = "recordings.zip";
        this.recordingsHeader.append(link);
      }
      // If there are still unuploaded blobs, try to upload them
      if (blobs.find(b=>b.uploaded!==true)){
        this.uploadElement.innerText = texts.uploading;
        await Promise.allSettled(uploadPromises);
        await new Promise(r=>setTimeout(r,100)); // leave time for blobs' status to be updated
        if (blobs.find(b=>b.uploaded!==true)) await uploadRecordings();  // upload the blobs that failed
        if (blobs.find(b=>b.uploaded!==true)) // if there still are unuploaded blobs, error
          this.uploadElement.innerHTML = 
          `<strong style="color: red;">${blobs.find(b=>b.uploaded==true)?texts.someUploaded:texts.noneUploaded}</strong><br>${texts.sendInvitation}`;
        else
          this.uploadElement.innerText = texts.allUploaded;
      }
      else
        this.uploadElement.innerText = texts.allUploaded;
      const originalEmpty = this.element.empty, t = this;
      this.element.empty = function(){
        const r = originalEmpty.call(this);
        if (blobs.length>0) t.element.append(t.recordingsHeader);
        return r;
      }
      return oldInit.call(this); 
    }
  };

  this.immediate = function(name, type){
    if (type===undefined) type = name || "audio video";
    if (name===undefined) name = "MediaRecorder";
    this._mediaType = []
    if (!type.match(/audio/i) && !type.match(/video/i)) type = "audio video";
    if (type.match(/audio/i)) {
      constraints.audio = true;
      this._mediaType.push("audio");
    }
    if (type.match(/video/i)) {
      constraints.video = true;
      this._mediaType.push("video");
    }
    this._mediaType = this._mediaType.join(" ");
    this._chunks = [];
    mediaRecorderElements.push(this);
  };

  this.uponCreation = async function(r){
    if (!init) return PennEngine.debug.error("Executing newMediaRecorder before InitiateRecorder");
    if (this._mediaType.match(/audio/i) && this._mediaType.match(/video/i)) this._mediaRecorder = recorders.default;
    else if (this._mediaType.match(/audio/i)) this._mediaRecorder = recorders.audio;
    else if (this._mediaType.match(/video/i)) this._mediaRecorder = recorders.video;
    this._hasPlayed = false;
    this._status = "inactive";
    this.addEventListener("playback", ()=>this._hasPlayed=true);
    if (this._mediaType.match(/video/i)) this._mediaPlayer = document.createElement("video")
    else this._mediaPlayer = document.createElement("audio");
    this._mediaPlayer.addEventListener("play", ()=>this._status!="recording" && this.dispatchEvent("playback"));
    this._mediaPlayer.addEventListener("ended", ()=>this._status!="recording" && this.dispatchEvent("playback_over"));
    this._mediaPlayer.controls = true;
    this._nodes = {main: document.createElement("DIV")};
    this._nodes.main.append(this._mediaPlayer);
    this.updateRecorder = async to => {
      if (this._disabled && to!="stop") return;
      const recorder = this._mediaRecorder, mimeType = recorder.mimeType;
      const otherActiveMRE = mediaRecorderElements.find( mre => mre!=this && mre._status=="recording" && 
          (recorder==mre._mediaRecorder || [recorder,mre._mediaRecorder].indexOf(recorders.default)>=0) );
      if (otherActiveMRE)
        return PennEngine.debug.warning(`Cannot ${to} MediaRecorder ${this._name} because another one (${otherActiveMRE._name}) is currently recording`);
      const skip = (to=="start"&&recorder.state=="recording") ||
                   (to=="stop"&&recorder.state=="inactive") ||
                   ((to=="pause"||to=="resume")&&recorder.state!="recording");
      if (!skip){
        const p = new Promise(r=>recorder.addEventListener(to,r));
        recorder[to].call(recorder,50);  // Chunks of 50ms
        await p;
      }
      this.dispatchEvent(({start:"recording",stop:"recorded",pause:"pause",resume:"resume"})[to], mimeType);
    };
    this._chunks = [];
    this._blobs = [];
    this._events = [];
    this._latestEvents = [];
    this.addEventListener("recording",()=>{
      this._status = "recording";
      this._chunks = [];
      this._latestEvents = [];
      if (this._mediaRecorder && this._mediaRecorder.stream instanceof MediaStream){
        this._mediaPlayer.oldMuted = this._mediaPlayer.muted;
        this._mediaPlayer.muted=true;
        this._mediaPlayer.srcObject = this._mediaRecorder.stream;
        this._mediaPlayer.play();
      }
      this._latestEvents.push(["Recording","placeholder",Date.now()]);
    });
    this.addEventListener("pause",()=>{
      this._latestEvents.push(["Playback","placeholder",Date.now()]);
      this._status = "paused";
    });
    this.addEventListener("resume",()=>{
      this._latestEvents.push(["Playback Over","placeholder",Date.now()]);
      this._status = "recording";
    });
    this.addEventListener("recorded", mimeType=>{
      this._status = "inactive";
      const ext = "." + mimeType.split(';')[0].split("/")[1];
      let filename = this._name+ext, n = 1;
      while ([...blobs,...this._blobs].find(b=>b.filename==filename)) filename = this._name+'-'+(n+=1)+ext;
      this._latestEvents.forEach(ev=>ev[1]=filename);
      this._latestEvents.push(["Recorded",filename,Date.now()]);
      this._events.push(...this._latestEvents);
      this._latestEvents = [];
      const blob = new Blob(this._chunks);
      this._mediaPlayer.srcObject = undefined;
      this._mediaPlayer.muted = this._mediaPlayer.oldMuted;
      this._mediaPlayer.src = URL.createObjectURL(blob);
      this._chunks = [];
      this._blobs.push({blob:blob,filename:filename,uploading:false,uploaded:false});
    });
    this.addEventListener("playback",()=>this._latestEvents.push(["Playback","placeholder",Date.now()]));
    this.addEventListener("playback_over",()=>this._latestEvents.push(["Playback Over","placeholder",Date.now()]));
    r();
  };

  this.end = async function(){
    if (this.updateRecorder instanceof Function && (this._status == "recording" || this._status == "paused"))
      await this.updateRecorder("stop");
    this._mediaRecorder = undefined;
    if (this._blobs instanceof Array)
      for (let b=0; b<this._blobs.length; b++)
        if (blobs.indexOf(this._blobs[b])<0) blobs.push(this._blobs[b]);
    if (this._log) this._events.forEach(e=>this.log(...e));
  };
  
  this.value = function(){ return undefined; };

  this.actions = {
    /* $AC$ MediaRecorder PElement.pause() Pauses any ongoing recording $AC$ */
    pause: async function(r){
      if (this._status == "recording") await this.updateRecorder("pause");
      else if (this._mediaPlayer && !this._mediaPlayer.paused) this._mediaPlayer.pause();
      r();
    },
    /* $AC$ MediaRecorder PElement.pause() Plays bakc the latest recording $AC$ */
    play: async function(r){
      if (this._mediaRecorder.state=="inactive" && this._mediaPlayer && this._mediaPlayer.src) this._mediaPlayer.play();
      else PennEngine.debug.warning("Tried to play back a recording that wasn't stopped");
      r();
    },
    /* $AC$ MediaRecorder PElement.record() Starts recording $AC$ */
    record: async function(r){ 
      if (this._status != "recording") await this.updateRecorder("start");
      r();
    },
    /* $AC$ MediaRecorder PElement.resume() Resumes previously paused recording $AC$ */
    resume: async function(r){
      if (this._status == "paused") await this.updateRecorder("resume");
      else if (this._mediaPlayer && this._mediaPlayer.paused && this._mediaPlayer.currentTime>0) this._mediaPlayer.play();
      r();
    },
    /* $AC$ MediaRecorder PElement.stop() Stops recording $AC$ */
    stop: async function(r){
      if (this._status == "recording" || this._status == "paused") await this.updateRecorder("stop"); 
      else if (this._mediaPlayer && this._mediaPlayer.currentTime>0){
        this._mediaPlayer.pause();
        this._mediaPlayer.currentTime=0;
      }
      r();
    },
    /* $AC$ MediaRecorder PElement.wait([playback]) Waits until recording or playback has ended $AC$ */
    $wait: function(r, t){
      if (t=="first" && this._blobs.length>0) return r();
      let waited = false;
      this.addEventListener(t=="playback"?"playback_over":"recorded", PennEngine.utils.parallel(async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      }));
    }
  };
  
  this.settings = {
    /* $AC$ MediaRecorder PElement.callback(commands) Will run the commands when recording ends $AC$ */
    $callback: async function(r, ...c){
      this.addEventListener("recorded", PennEngine.utils.parallel(async e=>{
        for (let i=0; i<c.length; i++)
          if (c[i] instanceof Function) await c[i].call();
      }));
      r();
    },
    /* $AC$ MediaRecorder PElement.disable() Disables recording capabilities $AC$ */
    disable: async function(r){
      if (this._status!="inactive") await this.updateRecorder("stop");
      this._disabled = true;
      r();
    },
    /* $AC$ MediaRecorder PElement.disable() Enables recording capabilities $AC$ */
    enable: async function(r){
      this._disabled = false;
      r();
    }
  };
  
  this.test = {
    /* $AC$ MediaRecorder PElement.test.hasPlayed() Checks whether the recording has ever been played back $AC$ */
    hasPlayed: function(){ return this._hasPlayed; },
    /* $AC$ MediaRecorder PElement.test.playing() Checks whether the recording is currently being played back $AC$ */
    playing: function(){ return this._status == "inactive" && this._mediaPlayer && this._mediaPlayer.paused===false; },
    /* $AC$ MediaRecorder PElement.test.recorded() Checks whether a recording was completed $AC$ */
    recorded: function(){ return this._blobs.length>0; },
    /* $AC$ MediaRecorder PElement.test.recording() Checks whether a recording is in progress $AC$ */
    recording: function(){ return this._status=="recording"; }
  };

});

(()=>{
  // Expose global commands to ResetPrefix
  const oldResetPrefix = window.PennController.ResetPrefix;
  window.PennController.newTrial.ResetPrefix = function(prefix){
    const o = (prefix?window[prefix]:window);
    ['InitiateRecorder','UploadRecordings','DownloadRecordingsButton','SetRecordingsZipFilename','MediaRecorderTexts']
      .forEach( name => o[name] = window.PennController.newTrial[name] );
    return oldResetPrefix.call(this,prefix);
  }
})();
