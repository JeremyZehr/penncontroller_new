window.PennController._AddElementType('Controller', function (PennEngine){
  this.immediate = function(name,controller,options){ 
    if (options===undefined){
      options = controller;
      if (typeof(name)==="string" && typeof(controller)==="object") controller = name;
    } 
    if (controller===undefined) controller = name;
    if (name===undefined) PennEngine.debug.error("No controller type given for newController");
    if (window.jQuery(document.body)[controller]===undefined) PennEngine.debug.error("Could not find a controller type named "+controller);
    this._controllerName = controller;
    this._options = options;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    const d = Date.now();
    this.addEventListener("print", ()=> {
      window.addSafeBindMethodPair(this._controllerName);
      const os = {
        _finishedCallback: results=>{
          const n = Date.now();
          results.forEach(r=>PennEngine.trials.current._logs.push([
            ["PennElementName", this._name],
            ["PennElementType", this._type],
            ["Parameter", this._controllerName],
            ["Value", r.length>0?`See extra column${r.length>1?'s':''}`:"NA"],
            ["EventTime", n],
            ["Comments", r.length>1?`${r.length} extra column${r.length>1?'s':''} added for this controller`:"NULL"],
            ...r
          ]));
          this.dispatchEvent("waited"); 
        },
        _cssPrefix: this._controllerName+'-',
        _utils: PennEngine.order.current.options._utils
      };
      for (let o in this._options) os[o] = this._options[o];
      window.jQuery(this._nodes.main)[this._controllerName](os);
    });
    r();
  }
  this.end = async function(){ 
    if (!this._log || !this._logLines) return;
    for (let i = 0; i < this._logLines; i++)
      this.log(this._controllerName,...this._logLines[i]);
  }
  this.value = async function () { return this._name; }
  this.actions = {
    $callback: function(r,...rest) {
      this.addEventListener("waited", PennEngine.utils.parallel(async ()=>{
        for (let i = 0; i < rest.length; i++)
          if (rest[i] instanceof Function)
            await rest[i].call();
      }));
      r();
    },
    $wait: function(r,t){
      this.addEventListener("waited", PennEngine.utils.parallel(async ()=>{
        if (t instanceof Function && !(await t.call(this)))  return;
        r(t=undefined);
      }));
    }
  }
});

