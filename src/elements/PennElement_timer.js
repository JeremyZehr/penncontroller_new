window.PennController._AddElementType('Timer', function (PennEngine){
  this.immediate = function(name,duration){ 
    if (name===undefined) name = "Timer";
    if (duration===undefined) duration = name;
    if (isNaN(duration) || duration<=0) 
      PennEngine.debug.error(`Invalid duration when creating Timer element ${name}: ${duration}`);
    this._initialDuration = duration;
  }
  this.uponCreation = async function(r){
    this._log = false;
    this._events = [];
    this._running = false;
    this._duration = this._initialDuration;
    const trial = PennEngine.trials.current;
    this._callback = d=>{
      if (trial!=PennEngine.trials.current) return;
      if (this._running && this._startTime===undefined) this._startTime = d;
      else if (this._running && d-this._startTime>=this._duration) {
        this._running = false;
        this._startTime = undefined;
        this._events.push(["Ended", "NA", Date.now()]);
        this.dispatchEvent("elapsed");
      }
      window.requestAnimationFrame(this._callback);
    };
    this._callback();
    r();
  }
  this.end = async function(){ 
    this._running = false;
    this._startTime = false;
    if (!this._log) return;
    this._events.forEach(e=>this.log(...e));
  }
  this.value = async function () { return this._running; }
  this.actions = {
    $callback: async function(r,...c) {
      this.addEventListener("elapsed", async ()=>{
        for (let i=0; i < c.length; i++)
          if (c[i] instanceof Function) await c[i].call();
      });
      r();
    },
    pause: async function(r){
      this._running = false;
      this._events.push(["Paused","NA",Date.now()]);
      r();
    },
    resume: async function(r){
      this._running = true;
      this._events.push(["Resumed","NA",Date.now()]);
      r();
    },
    set: async function(r,d){
      if (isNaN(d) || d<=0) PennEngine.debug.error(`Invalid duration when creating Timer element ${this._name}: ${d}`);
      this._duration = d;
      r();
    },
    start: async function(r){
      this._startTime = undefined;
      this._running = true;
      this._events.push(["Started","NA",Date.now()]);
      r();
    },
    stop: async function(r){
      this._running = false;
      this._startTime = undefined;
      this._events.push(["Stopped","NA",Date.now()]);
    },
    $wait: async function(r,t){
      let waited = false;
      this.addEventListener("elapsed",async ()=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        waited = true;
        this.dispatchEvent("waited");
        r();
      });
    }
  }
  this.test = {
    ended: function(){ return this._events.find(v=>["Stopped","Ended"].indexOf(v[0])>=0) },
    running: function(){ return this._running }
  }
});
