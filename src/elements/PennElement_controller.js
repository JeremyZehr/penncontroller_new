window.PennController._AddElementType('Controller', function (PennEngine){
  const controllersInitOverridden = {}; // keep track of which controllers' init fn have been overridden already
  const nodeToController = new Map(); // map to retrieve the ibex controller instance from the main pcibex node

  this.immediate = function(name,controller,options){ 
    if (options===undefined){
      options = controller;
      if (typeof(name)==="string" && typeof(controller)==="object") controller = name;
    } 
    if (controller===undefined) controller = name;
    if (name===undefined) PennEngine.debug.error("No controller type given for newController");
    if (window.jQuery.ui[controller]===undefined) PennEngine.debug.error("Could not find a controller type named "+controller);
    // Override the _init method to associate the controller instance with the node it is applied on
    if (controllersInitOverridden[controller]!==true) {
      const init = window.jQuery.ui[controller].prototype._init;
      window.jQuery.ui[controller].prototype._init = function(...args){
        const r = init.apply(this,args);
        nodeToController.set(this.element[0],this);
        return r;
      }
      controllersInitOverridden[controller] = true;
    }
    this._controllerName = controller;
    this._options = options;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    const d = Date.now();
    let controllerInstance;
    this.addEventListener("print", ()=> {
      if (controllerInstance) {
        for (let c of this._nodes.main.children) c.remove(); // empty the node main first
        controllerInstance.destroy(); // and destroy instance to unbind any bound methods
      }
      window.addSafeBindMethodPair(this._controllerName);
      const os = {
        _finishedCallback: results => {
          if (controllerInstance) controllerInstance.destroy(); // Destroy instance to unbind any bound methods
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
      controllerInstance = nodeToController.get(this._nodes.main);
    });
    r();
  }
  this.end = async function(){ 
    // Delete any references to _nodes.main to free memory
    if (nodeToController.get((this._nodes||{main:null}).main)) nodeToController.delete(this._nodes.main);
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

