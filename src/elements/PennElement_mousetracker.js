window.PennController._AddElementType('MouseTracker', function (PennEngine){
  this.immediate = function(name){ 
    if (name===undefined) name = "MouseTracker";
  }
  this.uponCreation = async function(r){
    this._log = false;
    this._clicks = [];
    this._coordinates = [];
    this._resizes = [];
    this._tracking = false;
    this._callbacks = [];
    this._initialW = window.innerWidth;
    this._initialH = window.innerHeight
    this.addEventListener("action", (what,x,y)=>this._callbacks.forEach(async c=>{
      if (!(c instanceof Array)) return;
      for (let i=0; i<c.length; i++)
        if (c[i] instanceof Function) await c[i].call(PennEngine.trials.current,what,x,y);
    }));
    document.documentElement.addEventListener("mousemove", e=>{
      if (!this._tracking) return;
      this._coordinates.push([e.clientX,e.clientY,Date.now()]);
      this.dispatchEvent("action", "move", e.clientX, e.clientY);
    });
    document.documentElement.addEventListener("click", e=>{
      if (!this._tracking) return;
      this._clicks.push([e.clientX,e.clientY,Date.now()]);
      this.dispatchEvent("action", "click", e.clientX, e.clientY);
    });
    this._onResize = e=>this._resizes.push([window.innerWidth,window.innerHeight,Date.now()]);
    window.addEventListener('resize', this._onResize, true);
    r();
  }
  this.end = async function(){ 
    window.removeEventListener('resize', this._onResize, true);
    this._tracking = false;
    if (!this._log) return;
    this._clicks.forEach(e=>this.log("Click",`${e[0]}:${e[1]}`,e[2]));
    this._resizes.forEach(e=>this.log("Resize",`${e[0]}:${e[1]}`,e[2]));
    if (this._coordinates.length>0){
      let prevX = this._coordinates[0][0], prevY = this._coordinates[0][1], prevDate = this._coordinates[0][2];
      let str = `x${prevX}y${prevY}w${this._initialW}h${this._initialW}`;
      this._coordinates.slice(1,).forEach(c=>{
        const diffX = c[0]-prevX, diffY = c[1]-prevY, diffDate = c[2]-prevDate;
        str+=`${diffX>=0?'+':''}${diffX}${diffY>=0?'+':''}${diffY}+${diffDate}`;
        prevX = c[0]; prevY = c[1]; prevDate = c[2];
      });
      this.log("Coorindates", str, this._coordinates[0][2]);
    }
  }
  this.value = async function () { 
    if (this._coordinates && this._coordinates.length>0)
      return this._coordinates[this._coordinates.length-1].slice(0,2);
    else return [NaN,NaN];
  }
  this.actions = {
    $callback: async function(r,...c) { this._callbacks.push(c); r(); },
    start: async function(r){ this._tracking = true; r(); },
    stop: async function(r){ this._tracking = false; r(); },
    $wait: async function(r,t){
      let waited = false;
      this.addEventListener("action", async what=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        if (typeof(t)=="string" && t.length>0 && t!=what) return;
        waited = true;
        this.dispatchEvent("waited");
        r();
      });
    }
  }
  this.test = {
    clicked: function(){ return this._clicks.length>0; },
    moved: function(){ return this._coordinates.length>0; },
    $over: async function(e){
      if (!this._tracking){
        PennEngine.debug.warning("Tested MouseTracker.over while the MouseTracker element is not tracking");
        return false;
      }
      if (this._coordinates.length==0) return false;
      if (e instanceof PennEngine.Commands) {
        await e.call();
        if (e._element._nodes && e._element._nodes.main instanceof Node)
          e = e._element._nodes.main;
        else
          e = document.createElement("DUMMY");
      }
      else if (e instanceof Function) e = await e.call();
      if (e instanceof Node) {
        const bcr = e.getBoundingClientRect();
        const c = this._coordinates[this._coordinates.length-1].slice(0,2);
        return c[0]>=bcr.x && c[0]<=bcr.x+bcr.width && c[1]>=bcr.y && c[1]<=bcr.y+bcr.height;
      }
      else return false;
    }
  }
});
