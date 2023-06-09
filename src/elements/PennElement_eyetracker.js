(()=>{

const waitDuration = d => {
  let start = performance.now();
  return new Promise(r=>(function wait(t){ (t-start>=d && r()) || setTimeout(()=>wait(performance.now())) })()); // setTimeout faster than requestAnimationFrame
  // let start;
  // return new Promise(r=>(function wait(t){start=start||t; if (t-start>=d) r(); else window.requestAnimationFrame(wait);})());
}

const XpName = window.location.href.replace(/[^/]+$/,'').replace(/[^\w\d]/g,'').replace(/[\.]{2,}/g,'');
let SessionID;

let FixationTime = 3000;
window.PennController.newTrial.SetETFixationTime = t => FixationTime=isNaN(t)||t<200?FixationTime:t;
// let LeewayPx = 50;
let LeewayPx = Math.round(Math.min(window.innerWidth,window.innerHeight)/4);
window.PennController.newTrial.SetETLeeway = px => LeewayPx=isNaN(px)||px<1?LeewayPx:px;
let trackerURL;
window.PennController.newTrial.EyeTrackerURL = url => trackerURL=url;
let webgazerLibrary = "https://cdn.jsdelivr.net/gh/penncontroller/penncontroller/releases/latest/webgazer.min.js";
window.PennController.newTrial.WebgazerURL = url => webgazerLibrary=url;
let failedCalibrationMessage = "The eye-tracker could place <span class='score'></span>% of your eye-gazes "+
                               "within a <span class='leeway'></span>px area surrounding the central dot, "+
                               "which does not meet the target threshold of <span class='threshold'></span>%. "+
                               "Make sure that the lens of your webcam is clean and unobstructed, "+
                               "that you are in a well-lit setting, that your keep your head at a constant angle, "+
                               "that you are not wearing glasses and that there is no moving object in the background. "+
                               "We will go through another round of calibration. Please click anywhere to start.";
window.PennController.newTrial.FailedCalibrationMessage = message => failedCalibrationMessage = message;
let faceDetectionMessage = "Please wait until your face appears in the top-left corner of the page overlaid with green lines and dots, and then click anywhere to proceed";
window.PennController.newTrial.FaceDetectionMessage = message => faceDetectionMessage = message;

const oldResetPrefix = window.PennController.newTrial.ResetPrefix;
window.PennController.newTrial.ResetPrefix = function(prefix){
  const o = (prefix?window[prefix]:window);
  ['SetETFixationTime','SetETLeeway','EyeTrackerURL','WebgazerURL','FailedCalibrationMessage','FaceDetectionMessage']
    .forEach(v=>o[v]=window.PennController.newTrial[v]);
  return oldResetPrefix.call(this,prefix);
}

window.PennController._AddElementType('EyeTracker', function (PennEngine){

  SessionID = PennEngine.utils.uuid();

  // Compression algorithm: since every data point is a 0 (gaze off) or a 1 (gaze on)
  // group them in sequences of 7 and do String.fromCharCode(parseInt(SEQ,2))
  // and add 45 (44 = charcode of comma) to output one character only
  // The last sequence may be less than 7 bits, so indicate that too, eg:
  //
  //  11010100101001001010100000000010100100111101110
  //
  //  is 47 bit long, so the last sequence will only contain 47%7 = 5 bits
  //  output: 5.VB-A|;
  //  what comes before . is the number of bits comprised in the last character
  //  so even though -'s char code is 45, 45-45 = 0, because it's NOT the last character,
  //  it will be extended to a 7-bit sequence (0000000), but ";" at the end, 
  //  whose char code is 59, 59-45 = 14, 1110 in binary, should be preceded with a single 0,
  //  as per the initial 5 before the period (01110)
  //
  //  Timestamps: all numbers <= 209, simply use String.fromCharCode(N+45)
  //  if number >= 210, use ÿ (charCode=255) and then String.fromCharCode on excedent
  //
  //  eg. 32,54,76,120,150,190,206,240,653,36,89
  //    [32,54,76,120,150,190,206,240,653,36,89].map(n=>[...Array(Math.floor(n/209))].map(v=>"ÿ").join('')+String.fromCharCode(n%209+45)).join('') 
  //  > Mcy¥ÃëûÿLÿÿÿGQ

  // from https://stackoverflow.com/a/23395136
  const beep = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
  const past50Array = {x:Array(50),y:Array(50),n:0};
  const webgazer = new Proxy({}, { get(t,p) {
    if (window.webgazer===undefined) PennEngine.debug.error("Tried to access webgazer before it was initialized");
    else return window.webgazer[p];
  } });
  const calibrationDiv = document.createElement("DIV");
  Object.entries({position:'fixed',top:0,left:0,width:'100vw',height:'100vh'}).forEach( s => calibrationDiv.style[s[0]]=s[1] );
  let lastCalibrationScore = 0;
  let currentETElement;
  let moveEvent, clickEvent;
  let detectedFace = false, storePoints = false;

  const showPredictionDot = (show=true) => {
    const predictionDot = document.querySelector("#webgazerGazeDot");
    if (!predictionDot) return;
    predictionDot.style.opacity = Number(show);
    predictionDot.style.pointerEvents = 'none';
  }
  const showFaceDetectionMessage = () => {
    [...calibrationDiv.children].forEach(c=>c.remove());
    const message = document.createElement("P");
    message.innerText = faceDetectionMessage;
    Object.entries({position:'absolute',top:'50vh',left:'50vw',transform:'translate(-50%,-50%)'}).forEach( s => message.style[s[0]]=s[1] );
    calibrationDiv.append(message);
  }
  const setTracker = async function(){
    if (init) return;
    console.log("start setTracker");
    webgazer.params.saveDataAcrossSessions = false;
    past50Array.x = Array(50); past50Array.y = Array(50); past50Array.n = 0;
    if (webgazer.saveDataAcrossSessions instanceof Function) webgazer.saveDataAcrossSessions(false)
    if (webgazer.applyKalmanFilter instanceof Function) webgazer.applyKalmanFilter(true);
    webgazer.setRegression('ridge').setGazeListener((data, clock) => {
      if (data instanceof Promise) data.then( d=>parseData(d,clock) );
      else if (data && data.x) parseData(data,clock);
    });
    webgazer.params.showVideoPreview = true;
    setEvents();  // The next addEventListener(mousemove/click) will be webgazer's, as triggered by begin below
    webgazer.begin();
    webgazer.removeMouseEventListeners();
    showPredictionDot(false);
    console.log("end setTracker");
    init = true;
    (function face(){detectedFace=webgazer.getTracker().predictionReady; if (!detectedFace) window.requestAnimationFrame(face);})();
  }
  // Give some time for a local copy of webgazer to load before checking distant server
  setTimeout( ()=>{
    if (window.webgazer===undefined &&  typeof(webgazerLibrary)=="string" && webgazerLibrary.match(/^http/i)) {
      const library = document.createElement('script');
      library.setAttribute('src',webgazerLibrary);
      document.head.appendChild(library);
    }
  }, 250);

  const parseData = (data,clock) => {
    if (storePoints){
      past50Array.x[past50Array.n] = data.x;
      past50Array.y[past50Array.n] = data.y;
      past50Array.n = (past50Array.n+1) % 50;
    }
    if (currentETElement instanceof PennEngine.Element) currentETElement.dispatchEvent("data", data, clock);
  };
  const setEvents = ()=>{ // Captures the mousemove and click handlers
    if (moveEvent instanceof Function && clickEvent instanceof Function) return;
    const oldAEL = document.addEventListener;
    document.addEventListener = function(...args){
      if (moveEvent===undefined&&args[0]=="mousemove"&&typeof(args[1])=="function"&&args[2]===true) moveEvent = args[1];
      if (clickEvent===undefined&&args[0]=="click"&&typeof(args[1])=="function"&&args[2]===true) clickEvent = args[1];
      oldAEL.apply(document, args);
    };
  }
  const printDot = (x,y,tx,ty,color='green',showDotFrame=false) => {
    const dot = document.createElement("div");
    Object.entries({
      background:color,'border-radius':'50%',border:'solid 0.25em black',cursor:'pointer',
      color:'white','text-align':'center','line-height':'3em','font-weight':'bold','user-select':'none',
      position:'absolute',top:y,left:x,width:'3em',height:'3em',transform: `translate(${tx},${ty})`
    }).forEach( s => dot.style[s[0]]=s[1] );
    calibrationDiv.append(dot);
    if (showDotFrame) {
      const bcr = dot.getBoundingClientRect();
      const frame = document.createElement("div");
      frame.style.position = 'relative';
      frame.style.left = 0-LeewayPx;
      frame.style.top = 0-LeewayPx;
      frame.style.width = bcr.width+LeewayPx*2;
      frame.style.height = bcr.height+LeewayPx*2;
      frame.style.border = "dotted 1px gray";
      frame.style.pointerEvents = 'none';
      dot.append(frame);
    }
    return dot;
  }
  const fixateDot = async (dot,overwriteFixate) => {
    // const bcr = dot.getBoundingClientRect();
    // const target = {clientX: bcr.x+bcr.width/2, clientY: bcr.y+bcr.height/2};
    // moveEvent(target);
    // const delay = 500;
    // await waitDuration(delay);  // Allow for DELAYms to place gaze
    // // webgazer.addMouseEventListeners();
    // await new Promise(r=>{
    //   let start;
    //   (function wait(t){
    //     if (start===undefined) start=t;
    //     if (t-start>=(overwriteFixate||FixationTime)-delay) r();
    //     else {
    //       clickEvent(target);
    //       console.log("clicking at", target);
    //       window.requestAnimationFrame(wait);
    //     }
    //   })();
    // });
    // // webgazer.removeMouseEventListeners();
    webgazer.addMouseEventListeners();
    for (let i=0; i<5; i++) {
      dot.innerText = 5-i;
      await new Promise(r=>dot.addEventListener("click",r));
      dot.style.backgroundColor = `rgb(${255/(5-i)},${128+(127/(5-i))},0)`;
    }
    webgazer.removeMouseEventListeners();
  }
  const scoreFixation = async (showDotFrame=false,short=false) => {
    console.log("start scoreFixation");
    await waitDuration(750); // Wait 750ms
    [...calibrationDiv.children].forEach(n=>n.remove());
    const positions = [{x:'50vw',y:'50vh'},{x:'25vw',y:'25vh'},{x:'75vw',y:'25vh'},{x:'75vw',y:'75vh'},{x:'25vw',y:'75vh'}];
    if (short) {
      window.fisherYates(positions);
      positions.splice(1,10);
    }
    // const positions = [{x:'25vw',y:'25vh'},{x:'75vw',y:'25vh'},{x:'25vw',y:'75vh'},{x:'75vw',y:'75vh'}];
    // window.fisherYates(positions);
    // positions.unshift({x:'50vw',y:'50vh'});
    const scores = Array(positions.length);
    for (let n=0; n<positions.length; n++) {
      const p = positions[n];
      const dot = printDot(p.x,p.y,"-50%","-50%","blue",showDotFrame);
      const bcr = dot.getBoundingClientRect();
      // await waitDuration(200);
      await new Promise(r=>dot.addEventListener("click",r));
      const ft = Math.max(500,FixationTime/2)
      dot.style.borderColor = 'gray';
      dot.style.transition = `background-color ${ft}ms linear`;
      dot.style.backgroundColor = 'transparent';
      [past50Array.x,past50Array.y,past50Array.n] = [Array(50),Array(50),0];
      storePoints = true;
      // await fixateDot(dot,Math.max(500,FixationTime/2));
      await waitDuration(ft);
      storePoints = false;
      console.log("past50Array",n,past50Array);
      let len = 0;
      const localScores = Array(50);
      for (let i=0; i<50; i++) {
        const [x, y] = [past50Array.x[i], past50Array.y[i]];
        if (x===undefined || y===undefined) localScores[i] = 0;
        else {
          localScores[i] = bcr.x-LeewayPx<=x && x<=bcr.x+bcr.width+LeewayPx && bcr.y-LeewayPx<=y && y<=bcr.y+bcr.height+LeewayPx;
          len++;
        }
      }
      scores[n] = localScores.reduce((a,b)=>a+b,0) / len;
      dot.remove();
    }
    // const dot = printDot("50vw","50vh","-50%","-50%",'blue');
    // const bcr = dot.getBoundingClientRect();
    // console.log("before fixateDot");
    // await waitDuration(200);
    // storePoints = true;
    // await fixateDot(dot);
    // storePoints = false;
    // console.log("after fixateDot, past50Array", past50Array);
    // const len = Math.min(past50Array[0].length,past50Array[1].length);
    // const scores = Array(len);
    // for (let i=0; i<len; i++) {
    //   const x = past50Array[0][i], y = past50Array[1][i];
    //   scores[i] = bcr.x-LeewayPx<=x && x<=bcr.x+bcr.width+LeewayPx && bcr.y-LeewayPx<=y && y<=bcr.y+bcr.height+LeewayPx;
    // }
    console.log("scores", scores);
    const score = 100*scores.reduce((a,b)=>a+b,0)/scores.length;
    console.log(`Percentage of gaze estimates falling within a ${LeewayPx}px leeway around the dot: ${score}`);
    lastCalibrationScore = score;
    return score;
  }
  const showFailedCalibrationMessage = (threshold,score)=>{
    [...calibrationDiv.children].forEach(c=>c.remove());
    const message = document.createElement("DIV");
    if (typeof(failedCalibrationMessage)=="string" && failedCalibrationMessage.match(/\.html?$/i))
      message.innerHTML = window.htmlCodeToDOM({include: failedCalibrationMessage}).innerHTML;
    else
      message.innerHTML = failedCalibrationMessage;
    message.querySelectorAll("span.score").forEach(n=>n.innerText=Math.round(score));
    message.querySelectorAll("span.threshold").forEach(n=>n.innerText=threshold);
    message.querySelectorAll("span.leeway").forEach(n=>n.innerText=LeewayPx);
    Object.entries({position:'absolute',top:'50vh',left:'50vw',transform:'translate(-50%,-50%)'}).forEach( s => message.style[s[0]]=s[1] );
    calibrationDiv.append(message);
  }
  const calibrate = async (threshold,attempts,showDotFrame=false) => {
    threshold = (isNaN(threshold)?0:Math.min(100,Math.max(0,Number(threshold))));
    showPredictionDot();
    [...calibrationDiv.children].forEach(c=>c.remove());
    document.body.append(calibrationDiv);
    if (!detectedFace) {
      showFaceDetectionMessage();
      await new Promise(r=>(function wait(){ if (detectedFace) r(); else window.requestAnimationFrame(wait); })());
    }
    console.log("calibrate, before removeMouseEventListeners");
    webgazer.removeMouseEventListeners();
    let score = 0, calibrated = false;
    showPredictionDot(false);
    if (lastCalibrationScore>=threshold) {
      await waitDuration(500);
      showPredictionDot();
      score = await scoreFixation(showDotFrame,'short');
      showPredictionDot(false);
      calibrated = score >= threshold;
    }
    // if (calibrated==false) webgazer.clearData();
    const videoElement = document.querySelector("#"+webgazer.params.videoContainerId);
    while (calibrated===false && attempts>0) {
      webgazer.clearData();
      attempts--;
      [...calibrationDiv.children].forEach(n=>n.remove());
      showPredictionDot();
      if (videoElement instanceof Node) videoElement.style.opacity = 1; // changing display messes with calibration
      await new Promise(r=>{
        const startButton = document.createElement("button");
        startButton.innerText = "Calibrate";
        Object.entries({position:'absolute',top:"50vh",left:"50vw",transform: `translate(-50%,-50%)`})
              .forEach( s => startButton.style[s[0]]=s[1] );
        calibrationDiv.append(startButton);
        startButton.addEventListener("click",()=>{ startButton.remove(); r(); });
      });
      if (videoElement instanceof Node) videoElement.style.opacity = 0; // changing display messes with calibration
      let d = printDot('50vw','50vh','-50%','-50%');
      await waitDuration(1000);
      d.remove();
      const positions = [
        {x:"2vw",y:"2vh",      tX:0,tY:0}, {x:"50vw",y:"2vh",tX:"-50%",tY:0},       {x:"98vw",y:"2vh",tX:"-100%",tY:0},
        {x:"2vw",y:"50vh", tX:0,tY:"-50%"},/*       central one added last       ,*/{x:"98vw",y:"50vh",tX:"-100%",tY:"-50%"},
        {x:"2vw",y:"98vh",tX:0,tY:"-100%"},{x:"50vw",y:"98vh",tX:"-50%",tY:"-100%"},{x:"98vw",y:"98vh",tX:"-100%",tY:"-100%"}
      ];
      window.fisherYates(positions);
      positions.push({x:"50vw",y:"50vh",tX:"-50%",tY:"-50%"});
      console.log("positions", positions);
      for (let i=0; i<positions.length; i++){
        console.log(`dot #${i+1}, waiting 1s...`);
        await waitDuration(1000); // Wait 1s
        const p = positions[i];
        console.log(`dot #${i+1}, printing at ${p.x}:${p.y}`);
        const dot = printDot(p.x,p.y,p.tX,p.tY);
        beep.play();
        await fixateDot(dot);
        dot.remove();
      }
      console.log("calibration phase over, now moving on to validateFixation");
      score = await scoreFixation(showDotFrame);
      showPredictionDot(false);
      calibrated = score >= threshold;
      if (!calibrated && attempts>0) {
        showFailedCalibrationMessage(threshold,score);
        await new Promise(r=>calibrationDiv.addEventListener("click",r));
      }
    }
    calibrationDiv.remove();
    webgazer.addMouseEventListeners();
    return score;
  }

  this.immediate = function(name,span,proportion){ 
    if (name===undefined) name = "EyeTracker";
    this._span = span;
    this._proportion = proportion;
  }
  let init = false;
  this.uponCreation = async function(r){
    if (!init) (function setWhenReady(){ if (window.webgazer) setTracker(); else window.requestAnimationFrame(setWhenReady); })();
    this._calibrated = false;
    this._trainOnMouseMove = false;
    this._counts = {};
    this._elements = [];
    this._times = [];
    this._startTime = 0;
    this._stopTime = 0;
    this._lookedAtNode = undefined;
    this._lastClock = undefined;
    this.addEventListener("data", (data,clock)=>{
      if (this._disabled || data==null || data.x===undefined || data.y===undefined) return;
      this._lookedAtNode = undefined;
      for (let e of this._elements) {
        const node = e.node;
        node.classList.remove("PennController-eyetracked");
        const bcr = node.getBoundingClientRect();
        const within = Number( bcr.left<=data.x && data.x<=bcr.left+bcr.width && bcr.top<=data.y && data.y<=bcr.top+bcr.height );
        e.gazes.push(within);
        let looked_at = within;
        // Span-based triggering: check proportion of gazes over SPAN cycles
        if (!isNaN(this._span)) {
          const span = Number(this._span);
          if (e.gazes.length<span) looked_at = false;
          else {
            const p = Math.max(0,Math.min(1,isNaN(this._proportion)?1:Number(this._proportion)));
            looked_at = e.gazes.slice(0-span).reduce((a,b)=>a+b,0)/span >= p;
          }
        }
        if (looked_at){
          this._lookedAtNode = node;
          node.classList.add("PennController-eyetracked");
          this.dispatchEvent("looked_at", data.x, data.y, node, clock);
        }
      };
      // Keep track of cycles' timestamps (relative for shorter encoding)
      this._times.push(Math.round( clock - (this._lastClock||clock) ));
      this._lastClock = clock;
    });
    r();
  }
  this.end = async function(){ 
    showPredictionDot(false);
    webgazer.removeMouseEventListeners();
    currentETElement = undefined;
    if (this._log && this._elements instanceof Array && this._elements.length) {
      this.log("StartTracking","Time",this._startTime,this._score);
      const log = (param,value,time) => {
        if (typeof(trackerURL)=="string" && trackerURL.match(/^https?:/i)){
          const data = {experiment:XpName,id:SessionID,pcnumber:PennEngine.order.current.id,parameter:param,value:value};
          const xhr = new XMLHttpRequest();     // XMLHttpRequest rather than jQuery's Ajax (mysterious CORS problems with jQuery 1.8)
          xhr.open('POST', trackerURL, true);
          xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
          xhr.onreadystatechange = ()=>xhr.status!=200 && this.log("Upload", "Error", Date.now(), param);
          xhr.send("json="+JSON.stringify(data));
        }
        else this.log(param,value,time);
      }
      for (let e of this._elements) {
        const bits = e.gazes.map(v=>Number(v)).join('');
        log(
          e.target instanceof PennEngine.Commands?e.target._element._name:(e.target instanceof Node?e.target.id||e.target.nodeName:"NA"),
          bits.length % 7 + '.' + bits.replace(/\d{1,7}/g,v=>String.fromCharCode(parseInt(v,2)+45)),
          this._startTime
        );
      };
      log(
        "Times",
        this._times.map(n=>[...Array(Math.floor(n/209))].map(v=>"ÿ").join('')+String.fromCharCode(n%209+45)).join(''),
        this._startTime
      );
    }
    return;
  }
  this.value = async function () { return this._name; }
  this.actions = {
    $add: async function(r,...refs){
      for (let i=0; i<refs.length; i++) {
        let ref = refs[i];
        if (refs[i] instanceof PennEngine.Commands) await refs[i].call();
        else if (refs[i] instanceof Function) ref = await refs[i].call();
        const target = {target: ref, gazes: []};
        // Use a proxy to return a node regardless of the nature of refs[i]
        this._elements.push( new Proxy( target , {get(t,p){ 
          if (p!="node") return t[p];
          else if (ref instanceof Node) return ref;
          else if (ref instanceof PennEngine.Commands && ref._element._nodes) return ref._element._nodes.main;
          else return document.createElement("span");
        }} ) );
      }
      r(); 
    },
    calibrate: async function(r,threshold,attempts){ 
      this._score = await calibrate(threshold,attempts,this._showDotFrames);
      this._calibrated = true; r(); 
    },
    $callback: async function(r,...commands) {
      this.addEventListener("data", PennEngine.utils.parallel(async (data,clock)=>{
        for (let i=0; i<commands.length; i++){
          const command = commands[i];
          if (command instanceof PennEngine.Commands) await command.call();
          else if (command instanceof Function) await command.call(data.x,data.y,clock);
        }
      }));
      r();
    },
    hideFeedback: function(r){ showPredictionDot(false); r(); },
    hideDotFrames: function(r) { this._showDotFrames = false; r(); },
    showFeedback: function(r) { showPredictionDot(true); r(); },
    showDotFrames: function(r) { this._showDotFrames = true; r(); },
    start: function(r){ currentETElement = this; this._startTime = Date.now(); r(); },
    stop: function(r){ currentETElement = undefined; this._stopTime = Date.now(); r(); },
    stopTraining: function(r){ webgazer.removeMouseEventListeners(); r(); },
    train: async function(r,showDot){ 
      webgazer.addMouseEventListeners();
      if (!this._trainOnMouseMove) document.removeEventListener("mousemove", moveEvent, true);
      if (showDot) showPredictionDot(true); 
      r(); 
    },
    trainOnMouseMove: function(r,yesNo){
      if (yesNo===false) { this._trainOnMouseMove = false; document.removeEventListener("mousemove", moveEvent, true); } 
      else this._trainOnMouseMove = true;
      r();
    }
  }
  this.test = {
    calibrated: function(){ return this._calibrated; },
    looking: async function(element){
      if (!(this._lookedAtNode instanceof Node)) return false;
      else if (element===undefined) return true;
      else {
        if (element instanceof Node) return this._lookedAtNode == element;
        else if (element instanceof PennEngine.Commands) {
          await element.call();
          return this._lookedAtNode == (element._element._nodes||{main: undefined}).main;
        }
      }
    },
    ready: function(){ return window.webgazer!==undefined && webgazer.isReady(); },
    score: function(s){ 
      if (s instanceof Function) return s(this._score);
      else return this._score >= (s || 0); 
    }
  }
});

})();
