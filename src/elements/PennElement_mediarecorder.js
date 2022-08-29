// MEDIARECORDER element
/* $AC$ PennController.newMediaRecorder(name,audio video) Creates a new audio and/or video MediaRecorder element $AC$ */
/* $AC$ PennController.getMediaRecorder(name) Retrieves an existing MediaRecorder element $AC$ */  

// TODO: handle enable/disable
// TODO: handle mimetypes
// TODO: auto sending of recordings upon SendResults

window.PennController._AddElementType("MediaRecorder", function(PennEngine) {

  if (window.MediaRecorder===undefined||navigator.mediaDevices===undefined||navigator.mediaDevices.getUserMedia===undefined){
    PennEngine.debug.error("This browser does not support audio recording");
    return alert("Your browser does not support audio recording");
  }

  const constraints = {audio: false, video: false};
  const recorders = {}, mediaRecorderElements = [], blobs = [];
  let init = false, postURL;
  
  window.PennController.newTrial.InitiateRecorder = (url,message)=>{
    if (typeof(url)!="string" || url.length<1) PennEngine.debug.warning("Invalid url passed to InitiateRecorder: "+url);
    else postURL = url;
    return PennController.newTrial(
      async ()=>{
        if (typeof(message)=="string" && message.match(/\.html?$/i)) message = window.htmlCodeToDOM({include: message});
        if (!(message instanceof Node) && (typeof(message)!="string" || message.length<1)) {
          const devices = [constraints.audio?"microphone":null,constraints.video?"webcam":null].filter(v=>v!=null);
          message = "<p>This experiment needs to access your "+devices.join(" and your ")+".</p>"+
                    "<p><a href='#' class='mediarecorder-consent'>I consent</a></p>"
          const span = document.createElement("SPAN");
          span.innerHTML = message;
          message = span;
        }
        document.body.querySelector(".PennController-PennController").append(message);
        const consent = document.body.querySelector(".PennController-PennController .mediarecorder-consent");
        consent.style.display='none';
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    )
    .noFooter().noHeader();
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
    let filename = zipFilename+'.zip', n = 1;
    while (uploadedZipFiles.indexOf(filename)>=0) filename = zipFilename+'-'+(n+=1)+'.zip';
    const fileobj = await zipBlobs(filename,uploadingBlobs);
    try {
      const uploadPromise = PennEngine.zip.upload(postURL,filename,fileobj,"application/zip");
      uploadPromises.push(uploadPromise);
      await uploadPromise;
      uploadingBlobs.forEach(b=>b.uploaded=true);
    }
    catch (e) { 
      uploadingBlobs.forEach(b=>(b.uploaded=false)||(b.uploading=false)); 
      PennEngine.debug.error("Failed to upload recordings: "+e);
    }
  }
  window.PennController.newTrial.UploadRecordings = (label,noblock) => PennController.newTrial(label,
    async ()=>{
      const message=document.createElement("DIV");
      message.innerHTML = "<p>Please wait while the archive of your recordings is being uploaded to the server...</p>";
      document.querySelector(".PennController-PennController").append(message);
      const promise = uploadRecordings();
      if (noblock!==undefined) {
        await promise;
        await Promise.all(uploadPromises);
        await new Promise(r=>setTimeout(r,100)); // leave time for blobs' status to be updated
        if (blobs.find(b=>b.uploaded!=true)) await uploadRecordings();  // upload the blobs that failed
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

  this.immediate = function(name, type){
    if (type===undefined) type = name || "audio";
    if (name===undefined) name = "MediaRecorder";
    if (type.match(/audio/i) || !type.match(/video/i)) constraints.audio = true;
    if (type.match(/video/i)) constraints.video = true;
    this._mediaType = type;
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
      const recorder = this._mediaRecorder;
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
      this.dispatchEvent(({start:"recording",stop:"recorded",pause:"pause",resume:"resume"})[to]);
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
    this.addEventListener("recorded",()=>{
      this._status = "inactive";
      let filename = this._name+".webm", n = 1;
      while ([...blobs,...this._blobs].find(b=>b.filename==filename)) filename = this._name+'-'+(n+=1)+".webm";
      this._latestEvents.forEach(ev=>ev[1]=filename);
      this._latestEvents.push(["Recorded",filename,Date.now()]);
      this._events.push(...this._latestEvents);
      this._latestEvents = [];
      const blob = new Blob(this._chunks,{type:"webm"});
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
    for (let i=0; i<recorders.length; i++){
      await this.updateRecorder("stop");
      recorders[i].chunks=[];
    }
    this._mediaRecorder = undefined;
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
      this.addEventListener(t=="playback"?"playback_over":"recorded",async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      });
    }
  };
  
  this.settings = {
    /* $AC$ MediaRecorder PElement.callback(commands) Will run the commands when recording ends $AC$ */
    $callback: async function(r, ...c){
      this.addEventListener("recorded",async e=>{
        for (let i=0; i<c.length; i++)
          if (c[i] instanceof Function) await c[i].call();
      });
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
  const oldResetPrefix = window.PennController.ResetPrefix;
  window.PennController.newTrial.ResetPrefix = function(prefix){
    const o = (prefix?window[prefix]:window);
    o.InitiateRecorder = window.PennController.InitiateRecorder;
    o.UploadRecordings = window.PennController.UploadRecordings;
    o.DownloadRecordingsButton = window.PennController.DownloadRecordingsButton;
    o.SetRecordingsZipFilename = window.PennController.SetRecordingsZipFilename;
    return oldResetPrefix.call(this,prefix);
  }
})();
