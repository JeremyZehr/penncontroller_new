window.PennController._AddElementType('Function', function (PennEngine){
  this.immediate = function(name,fn){ 
    if (name===undefined) name = "Function";
    if (fn===undefined) fn = name;
    this._function = (fn instanceof Function?fn:()=>undefined);
    console.log("initialized function with", this._function);
  }
  this.uponCreation = async function(r){ 
    console.log("uponCreation function with", this._function);
    r(); 
  }
  this.end = async function(){ return; }
  this.value = async function () { return await this._function.call(); }
  this.actions = {
    run: async function(r,...cs){ await this._function.call(this,...cs); r(); },
    print: function (r) { PennEngine.debug.warning("Function elements cannot be printed"); r(); }
  }
  this.test = {
    is: async function(v) {
      const r = await this._function.call();
      if (v instanceof Function)
        return await v(r);
      else
        return r;
    }
  }
});
