(()=>{

const global_vars = {};
let PE;

window.PennController._AddElementType('Var', function (PennEngine){

  PE = PennEngine;

  this.immediate = function(name,value){ 
    this._initialValue = value;
    this._global = false;
    this._target = this;
  }
  this.uponCreation = async function(r){
    this._values = [];
    this._value = this._initialValue;
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    if (!(this._values instanceof Array) || this._values.length==0) this.log("Value", this._initialValue);
    for (let i = 0; i < this._values; i++)
      this.log("Value",this._values[i].value,this._values[i].date);
  }
  this.value = async function () {
    if (this._global && global_vars[this._name]) this._target = global_vars[this._name];
    return this._target._value; 
  }
  this.actions = {
    $set: async function (r,value) { 
      if (value instanceof PennEngine.Commands){
        await value.call();
        value = await value._element.value;
      }
      else if (value instanceof Function)
        value = await value.call(this._target,this._target._value);
      this._target._value = value;
      if (!(this._values instanceof Array)) this._values = [];
      this._values.push({v: value, date: Date.now()});
      r();
    }
  }
  this.settings = {
    global: function(r){ 
      this._global = true;
      if (!global_vars.hasOwnProperty(this._name)) 
        global_vars[this._name] = {_value: this._value};
      this._target = global_vars[this._name];
      r();
    },
    local: function(r) {
      this._global = false;
      this._value = this._target._value;
      this._target = this;
      r(); 
    },
    log: function(r){ this._log = true; r(); },
  }
  this.test = {
    $is: async function(t){
      let v = t;
      if (t instanceof PennEngine.Commands){
        await t.call();
        v = await t._element.value;
      }
      else if (t instanceof Function)
        v = await t.call(this._target,this._target._value);
      else
        v = this._target._value == v;
      return v;
    }
  }

  PennEngine.Commands.prototype.setVar = function(v){
    if (typeof(v)==="string") v = getVar(v);
    this._sequence.push( ()=>v.set(this._element._commands).call() );
    return this;
  }
});

// Overwrite getVar now that _AddElementType has taken effect
PE.elements.getVar = function(name){
  let v = PE.trials.current._elements.find(e=>e._type=="Var"&e._name==name);
  if (v) return v._commands;
  v = PE.elements.newVar(name);
  const c =  ()=>{
    if (!global_vars.hasOwnProperty(name))
      throw new Error(`Found no local of global Var element named ${name}`);
  };
  c.toString = ()=>`getVar("${name}")`;
  v._sequence.push(c);
  v._element._global = true;  // Mark it as global now
  v.global(); // Make sure it is treated as global when commands are run
  return v;
}

})();
