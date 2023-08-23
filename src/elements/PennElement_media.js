// AUDIO & VIDEO elements
/* $AC$ PennController.newAudio(name,file) Creates a new Audio element $AC$ */
/* $AC$ PennController.getAudio(name) Retrieves an existing Audio element $AC$ */
/* $AC$ PennController.newVideo(name,file) Creates a new Video element $AC$ */
/* $AC$ PennController.getVideo(name) Retrieves an existing Video element $AC$ */

(()=>{

const audioCtx = new AudioContext();
let resumingAudioCtx = null;
let user_has_interacted = false
const user_interaction_callback = ()=>{
  if (user_has_interacted) return;
  user_has_interacted = true;
  resumingAudioCtx = audioCtx.resume(); // Resume after first interaction to allow playback
}
document.documentElement.addEventListener("click", user_interaction_callback, false);
document.documentElement.addEventListener("keydown", user_interaction_callback, false);

const TIME_DIFFERENCE_PRELOADED = 0.1;
let RATIO_PRELOADED = 0.95;

window.PennController.newTrial.SetMediaPreloadRatio = n=>typeof(n)=="number"&&n>=0&&n<=1&&(RATIO_PRELOADED=n);
const oldResetPrefix = window.PennController.ResetPrefix;
window.PennController.newTrial.ResetPrefix = function(prefix){
  const o = (prefix?window[prefix]:window);
  o.SetMediaPreloadRatio = window.PennController.SetMediaPreloadRatio;
  return oldResetPrefix.call(this,prefix);
}

const tracks = new Map();

// Create a rewind helper method for safe 
const rewind = async o=>{
  if (!(o instanceof Node)) return;
  const v = o.volume;
  o.volume = 0;
  const track = tracks.get(o);
  if (track) track.disconnect(); // make sure no sound comes out
  o.pause();
  if (o.currentTime !== 0 && (o.currentTime > 0 && o.currentTime < o.duration)) o.currentTime = 0;
  o.volume = v;
  if (track) track.connect(audioCtx.destination); // ready for next playback
}

const addMediaElement = mediaType => window.PennController._AddElementType(mediaType, function(PennEngine) {
  
  // This is executed when Ibex runs the script in data_includes (not a promise, no need to resolve)
  this.immediate = function(id, file, target_ratio){
    this._events = [];
    if (typeof(file)!="string") target_ratio = file;
    if (typeof(id)=="string" && (file===undefined || typeof(file)!="string")) file = id;
    if (target_ratio===undefined || (typeof(target_ratio)=="number" && target_ratio>0 && target_ratio<=1)) 
      target_ratio = target_ratio||RATIO_PRELOADED;
    else
      target_ratio = undefined;
    this._pause = ()=>{
      if (!(this._media instanceof HTMLMediaElement)) return;
      const track = tracks.get(this._media);
      if (track) track.disconnect();
      this._media.pause();
    };
    this._prepareForNextPlayback = ()=>{
      if (!(this._media instanceof HTMLMediaElement)) return;
      const track = tracks.get(this._media);
      if (track) track.connect(audioCtx.destination);
    };
    this.addResource(file, async uri => { // new Promise((resolve,reject) => {
      const object = document.createElement(mediaType=="Audio"?"AUDIO":"VIDEO");
      object.muted = true;
      object.preload = 'auto';
      const checkLoaded = r=>{
        if (this._media instanceof Node) return;
        if (target_ratio===undefined) return r();
        if (user_has_interacted && object.readyState > 0 && object.paused && object.currentTime==0) {
          object.play();
          setTimeout(()=>this._media instanceof Node || object.pause(), 500);
        }
        const difference = object.duration-object.currentTime;
        let ratio = 0;
        if (object.buffered.length && object.seekable.length) ratio = object.buffered.end(0)/object.seekable.end(0);
        if (difference<TIME_DIFFERENCE_PRELOADED || ratio >= target_ratio) return r(object);        
        else window.requestAnimationFrame(()=>checkLoaded(r));
      };
      object.src = uri;
      const track = audioCtx.createMediaElementSource(object);
      tracks.set(object, track);
      const p = await new Promise(r=>{
        object.addEventListener('error', e=>r(e.target.error));
        object.addEventListener("canplaythrough", ()=>checkLoaded(r));
      });
      if (p instanceof MediaError) throw Error("Invalid media at "+uri);
      return object;
    })
    .then( async o => {
      await rewind(o);
      o.controls = (mediaType=="Audio"?true:false);
      o.style["max-width"] = "100%";
      o.style["max-height"] = "100%";
      if (this._nodes && this._nodes.main && document.body.contains(this._nodes.main)){
        if (this._media instanceof Node) this._media.remove();
        o.muted = false;
        this._nodes.main.append(o);
      }
      // No handler to capture clicks on media controls, so using a trick instead
      let mouse_over_controls = false;
      o.addEventListener("mouseenter", ()=>mouse_over_controls=true);
      o.addEventListener("mouseleave", ()=>mouse_over_controls=false);
      o.addEventListener("play", ()=>{
        // If play fires off when the mouse is over the controls, we assume it was initiated by the user
        if (mouse_over_controls) resumingAudioCtx = audioCtx.resume(); // Resume after first interaction to allow playback
        this._events.push(["Play",o.currentTime,Date.now()]);
      });
      o.addEventListener("pause", ()=>this._events.push(["Paused",o.currentTime,Date.now()]));
      o.addEventListener("seeking", ()=>this._events.push(["Seeking",o.currentTime,Date.now()]));
      o.addEventListener("seeked", ()=>this._events.push(["Seeked",o.currentTime,Date.now()]));
      o.addEventListener("waiting", ()=>this._events.push(["Waiting",o.currentTime,Date.now()]));
      o.addEventListener("ended", ()=>{
        this._events.push(["Ended",o.currentTime,Date.now()]);
        this.dispatchEvent("ended");
      });
      this._media = o;
    });
  };

  // This is executed when newAudio/newVideo is executed in the trial (converted into a Promise, so call resolve)
  this.uponCreation = async function(r){
    if (this._media instanceof HTMLMediaElement) this._prepareForNextPlayback();
    this._hasPlayed = false;                 // Whether the media has played before
    this.addEventListener("ended", ()=>this._hasPlayed=true);
    this._events = [];
    this._nodes = {main: document.createElement("div")};
    this._nodes.main.style.position = 'relative';
    this._whatToSave = [];                   // ["play","end","pause","seek"] (buffer logged by default)
    this._showDisabledLayer = ()=>{
      if (!(this._disabled && this._media instanceof Node && this._nodes && document.body.contains(this._nodes.main))) return;
      if (this._disableLayer instanceof Node) this._disableLayer.remove();
      this._disableLayer = document.createElement("DIV");
      if (this._opacity) {
        this._disableLayer.style['background-color'] = "#000";
        this._disableLayer.style.opacity = this._opacity;
      }
      this._disableLayer.style.width = "100%";
      this._disableLayer.style.height = "100%";
      this._disableLayer.style.position = "absolute";
      this._nodes.main.prepend(this._disableLayer);
    };
    this._disableLayer = undefined;
    this.addEventListener("print", ()=>{
      if (this._media instanceof Node) {
        // this._media.pause();
        this._media.muted = false;
        this._media.controls = true;
        this._nodes.main.append(this._media);
      }
      if (this._disabled) {
        this._showDisabledLayer();
        if (mediaType=="Video" && this._media instanceof Node) this._media.removeAttribute("controls");
      }
      else if (this._disableLayer instanceof Node) this._disableLayer.remove();
    });
    r();
  };

  // This is executed at the end of a trial
  this.end = async function(){
    await rewind(this._media);
    this._pause();
    if (this._disableLayer instanceof Node) {
      this._disableLayer.remove();
      this._disableLayer = undefined;
    }
    if (this._events instanceof Array)
      this._events.forEach( e => ( this._log===true || this._log instanceof Array && 
        this._log.find(s=>typeof(s)=="string"&&e[0].match(RegExp("^"+s,"i"))) ) && this.log(...e) );
  };
  
  this.value = function(){                                    // Value is timestamp of last end event
    if (this._media instanceof Node) return this._media.currentTime;
    else return 0;
  };

  this.actions = {
    /* $AC$ Audio PElement.play() Starts the audio playback $AC$ */
    /* $AC$ Video PElement.play() Starts the video playback $AC$ */
    play: async function(r, loop){
      if (!(this._media instanceof HTMLMediaElement)) 
        return r(PennEngine.debug.error(`No media to play for ${mediaType} element ${this._name}`));
      if (resumingAudioCtx instanceof Promise) await resumingAudioCtx;
      this._prepareForNextPlayback();
      if (loop===undefined) this._media.removeAttribute("loop");
      else this._media.loop = true;
      if (this._media.currentTime >= this._media.duration)
        await rewind(this._media);
      this._media.muted = false;
      const p = this._media.play();
      if (p instanceof Promise) {
        p.catch(e=>PennEngine.debug.error(
          `Error playing ${this._type} element "${this._name}"; note that most browsers block playback until the user has interacted with the page via a click or a keypress`
        ));
        await p;
      }
      r();
    },
    /* $AC$ Audio PElement.pause() Pauses the audio playback $AC$ */
    /* $AC$ Video PElement.pause() Pauses the video playback $AC$ */
    pause: async function(r){
      if (!(this._media instanceof HTMLMediaElement)) 
        return r(PennEngine.debug.error(`No media to play for ${mediaType} element ${this._name}`));
      this._pause();
      this._prepareForNextPlayback();
      r();
    },
    /* $AC$ Audio PElement.stop() Stops the audio playback $AC$ */
    /* $AC$ Video PElement.stop() Stops the video playback $AC$ */
    stop: async function(r){
      if (!(this._media instanceof HTMLMediaElement)) 
        return r(PennEngine.debug.error(`No media to play for ${mediaType} element ${this._name}`));
      this._pause();
      this._media.currentTime = this._media.duration;
      this._prepareForNextPlayback();
      r();
    },
    // Here, we resolve only when the video ends (and the test is felicitous, if provided)
    /* $AC$ Audio PElement.wait() Waits until the audio playback has ended $AC$ */
    /* $AC$ Video PElement.wait() Waits until the video playback has ended $AC$ */
    $wait: function(r, t){
      if (t=="first" && this._hasPlayed) return r();
      let waited = false;
      this.addEventListener('ended', PennEngine.utils.parallel(async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      }));
    }
  };
  
  this.settings = {
    /* $AC$ Audio PElement.callback(commands) Will run the commands when playback ends $AC$ */
    /* $AC$ Video PElement.callback(commands) Will run the commands when playback ends $AC$ */
    $callback: async function(r, ...c){
      this.addEventListener('ended', PennEngine.utils.parallel(async e=>{
        for (let i=0; i<c.length; i++)
          if (c[i] instanceof Function) await c[i].call();
      }));
      r();
    },
    /* $AC$ Audio PElement.disable(opacity) Disables the interface $AC$ */
    /* $AC$ Video PElement.disable(opacity) Disables the interface $AC$ */
    disable: function(r, opacity){
      this._opacity = opacity;
      this._disabled = true;
      if (mediaType=="Video" && this._media instanceof Node) this._media.removeAttribute("controls");
      this._showDisabledLayer();
      r();
    },
    /* $AC$ Audio PElement.enable() (Re-)enables the interface $AC$ */
    /* $AC$ Video PElement.enable() (Re-)enables the interface $AC$ */
    enable: function(r){
      if (this._disableLayer instanceof Node) this._disableLayer.remove();
      if (this._media instanceof Node) this._media.controls = true;
      this._disabled = false;
      r();
    },
    log: function(r,...whats){
      if (whats.length==0) this._log = true;
      else this._log = whats;
      r();
    },
    once: function(r){
      this.addEventListener('ended', PennEngine.utils.parallel(e=>this._showDisabledLayer()));
      r();
    }
  };
  
  this.test = {
    // Every test is used within a Promise back-end, but it should simply return true/false
    /* $AC$ Audio PElement.test.hasPlayed() Checks whether the audio has ever been played fully $AC$ */
    /* $AC$ Video PElement.test.hasPlayed() Checks whether the video has ever been played fully $AC$ */
    hasPlayed: function(){ return this._hasPlayed; },
    /* $AC$ Audio PElement.test.playing() Checks whether the audio is currently playing $AC$ */
    /* $AC$ Video PElement.test.playing() Checks whether the video is currently playing $AC$ */
    playing: function(){ return this._media instanceof Node && this._media.currentTime && !this._media.paused; }
  };

});

addMediaElement("Audio");
addMediaElement("Video");

})();
