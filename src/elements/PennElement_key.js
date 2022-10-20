window.PennController._AddElementType('Key', function (PennEngine){

  this.immediate = function(name,...keys){
    if (keys.length==0) keys = [name===undefined?"":name];
    else if (name.match(/^([A-Z][a-z]|F[0-9])/)) 
      PennEngine.debug.warning(`Named a Key element "${name}" (not interpreted as a key name)`);
    if (name===undefined) name = "Key";
    this._initialKeys = keys;
  }
  this.uponCreation = async function(r){
    this._keyEvents = [];
    const trial = PennEngine.trials.current;
    this._handler = e=>{
      if (trial!=PennEngine.trials.current || PennEngine.utils.keyMatch(e,this._initialKeys)<0 || this._disabled) return;
      this._keyEvents.push({key:(e.ctrlKey||e.altKey||e.shiftKey?PennEngine.utils.fullKey(e):e.key),date:Date.now(),e:e});
      this.dispatchEvent("keydown", e);
    };
    window.addEventListener("keydown",this._handler);
    r();
  }
  this.end = async function(){ 
    if (this._handler) window.removeEventListener("keydown",this._handler);
    if (!this._log || !this._keyEvents) return;
    this._keyEvents.forEach((k,i)=>{
      if (k.waited || this._log instanceof Array && this._log.filter(s=>typeof(s)=="string").map(s=>s.toLowerCase())
        .find(s=>s=="all" || s=="first"&&i==0 || s=="last"&&i==this._keyEvents.length-1) )
          this.log("Press", k.key, k.date, k.waited?'Wait validation':'No wait validation');
    });
  }
  this.value = async function () { 
    if (this._keyEvents && this._keyEvents.length>0) return this._keyEvents[this._keyEvents.length-1].key;
    else return '';
  }
  this.actions = {
    print: function(r){ PennEngine.debug.warning("Key elements cannot be printed"); r(); },
    $callback: function(r,...rest) {
      this.addEventListener("keydown", async e=>{
        for (let i = 0; i < rest.length; i++)
          if (rest[i] instanceof Function) await rest[i].call(PennEngine.trials.current,e);
      });
      r();
    },
    $wait: function(r,f,t) { 
      if (t===undefined) t = f;
      if (f=="first" && this._keyEvents.length>0) return r();
      let waited = false;
      this.addEventListener("keydown", async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        waited = true;
        this._keyEvents[this._keyEvents.length-1].waited = true;
        this.dispatchEvent("waited");
        r();
      });
    },
  }
  this.settings = {
    log: function(r,...whats){ 
      if (whats.length==0) this._log = true;
      else this._log = whats; 
      r(); 
    }
  }
  this.test = {
    pressed: async function(key,first){ 
      if (first===undefined) first = key;
      if (this._keyEvents.length==0) return false;
      else if (key===undefined) return true;
      else if (first==="first") return PennEngine.utils.keyMatch(this._keyEvents[0].e,[key])>=0;
      else return PennEngine.utils.keyMatch(this._keyEvents[this._keyEvents.length-1].e,[key])>=0;
    }
  }
});
