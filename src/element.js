import { trials, footerHeaderTrials, SendResults, removeSendResultsFromItems, footer } from './trial'
import { PennEngine } from './pennengine';
import { Resource } from './resource';
import { standardCommands } from './standardCommands';
import { debug } from './debug';
import { order } from './order';

const firstPassOnArguments = async function(element) {
  for (let i = 0; i < this.length; i++){
    if (this[i] instanceof Self)  this[i] = this[i].call(element);
    else if (this[i] instanceof SendResults) {
      removeSendResultsFromItems(this[i]);
      const c = new Commands();
      c.call = this[i].call; c.toString = ()=>"SendResults()";
      this[i] = c;
    }
  }
  return this;
}
const secondPassOnArguments = async function(skipEvalCommands) {
  for (let i = 0; i < this.length; i++)
    if (!skipEvalCommands && this[i] instanceof Commands){
      await this[i].call();
      this[i] = await this[i]._element.value;
    }
    else if (!skipEvalCommands && this[i] instanceof Function)
      this[i] = await this[i].call();
  return this;
}

class Self { // A representation of Self to store invokation information and returns an instance of Commands when call-ed
  constructor(){ this._commands = []; } 
  call(element){ 
    const c = element._commands;
    let currentObject = c;
    for (let i = 0; i < this._commands.length; i++){
      const command = this._commands[i];
      if (command.length==1) currentObject = currentObject[command[0]]; // keyword (settings,test)
      else currentObject = currentObject[command[0]](...command[1]); // call command
    }
    return c;
  }
}
Object.defineProperty(window,'self',{ get(){
  const s = new Self();
  const handler = new Proxy(s, {
    get(t,p){
      if (p=="setImmediate"||p=="clearImmediate") return ()=>handler; // Weird browser behavior
      if (p=="call") return (...args)=>s.call.apply(s,args);  // Get Commands on Self instance, not on Proxy
      s._commands.push([p]);
      if (['settings','test'].indexOf(p)<0)  // Keywords
        return (...args)=>{s._commands[s._commands.length-1].push(args); return handler};
      return handler;
    },
    set(){ throw Error("Cannot set properties of self") }
  });
  return handler;
}, set(){ throw Error("self is read-only") } });

// In case one uses getElement before newElement (eg for Var elements), the script needs to be able to retrieve the element later on
class ElementRetrieval {
  constructor(name,trial,type) {
    this.name = name;
    this.trial = trial;
    this.type = type;
  }
  retrieve() {
    const trial = this.trial || trials.current;
    if (trial && trial._elements) {
      const element = trial._elements.find( e=>e._type==this.type && e._name == this.name );
      if (element) return element;
      else if (trials.running===this.trial)
        debug.error("Could not find an element named '"+this.name+"' in the current trial");
    }
  }
}

/** 
 * PennController commands are called on element references via `newElement()` or `getElement()`,
 * where `Element` stands for the element type.
 * Underlyingly, commands are (asynchronous) functions and you can pass javascript functions
 * wherever PennController commands are referenced
 * @typedef {(function)} Command 
 * @example <caption>Commands in a callback</caption>
 * // Print a Text element on the page and a message in the console when the button is clicked
 * newButton("Click me!")
 *   .callback(
 *     newText("You clicked the button!").print(), // first command
 *     ()=>console.log("click") // second command
 *   )
 */
export class Commands extends Function {
  constructor(element,actions={},settings={},tests={}) {
    super('throw Error("Instances of PennController Commands should not be invoked directly");');
    Object.defineProperty(this,'length',{writable: true});
    Object.defineProperty(this,'name',{writable: true});
    if (element instanceof Element) this._elementRef = element;
    else if (element instanceof ElementRetrieval) this._elementRetrieval = element;
    this._sequence = [];
    this._currentTrial = null;
    this._node = null;
    this.settings = {};
    this.test = {};
    this.testNot = {};
    for (let c in standardCommands.settings)
      this.#getAddCommandToSequence(standardCommands.settings[c],c);
    for (let c in standardCommands.actions)
      this.#getAddCommandToSequence(standardCommands.actions[c],c);
    for (let c in settings)
      this.#getAddCommandToSequence(settings[c],c);
    for (let c in actions)
      this.#getAddCommandToSequence(actions[c],c);
    for (let c in standardCommands.tests) {
      this.#getTest(standardCommands.tests[c],c);
      this.#getTest(standardCommands.tests[c],c,'not');
    }
    for (let c in tests) {
      this.#getTest(tests[c],c);
      this.#getTest(tests[c],c,'not');
    }
  }
  get _element() { 
    if (this._elementRef instanceof Element) return this._elementRef;
    if (this._elementRetrieval instanceof ElementRetrieval) return (this._elementRef = this._elementRetrieval.retrieve());
  }
  set _element(v) { /* void */ }
  _asProxy() {
    const p = new Proxy(this,{
      get(t,p){
        if (typeof(p) == "string" && !Reflect.has(t,p)) 
          throw Error(`Command get${t._element._type}("${t._element._name}").<strong>${p}</strong> does not exist`);
        return Reflect.get(t,p);
      },
      set(t,p,v){
        t[p] = v;
        return t;
      }
    });
    return p;
  }
  _getItemNumber() {
    let trial_order;
    if (this._currentTrial) {
      const n = order.og.findIndex(v=>v.find(w=>w.options._trial==this._currentTrial));
      if (n>=0) trial_order = `<em>(item #${n+1})</em>`
    }
    return trial_order;
   }
  #getAddCommandToSequence(command,name) {
    const skipEvalCommands = name.startsWith('$');
    name = name.replace(/^\$/,'');
    const f = function () {
      if (name=="log" && arguments.length==2)
        debug.warning(`Called .log(${arguments[0]},${arguments[1]}) on get${this._element._type}(${this._element._name}); 
                        Did you mean to call it on newTrial() instead?`);
      firstPassOnArguments.call(arguments,this._element);
      // for (let i = 0; i < arguments.length; i++)
      //   if (arguments[i] instanceof Self)  arguments[i] = arguments[i].call(this._element);
      const c = (trial,parent) => new Promise(async r=>{
        debug.log(`Running ${c.toString()} ${this._getItemNumber()||''}`);
        const copyOfArguments = [...arguments]; // Do not overwrite original arguments
        await secondPassOnArguments.call(copyOfArguments,skipEvalCommands);
        command.call(this._element,r,...copyOfArguments);
      });
      c.toString = ()=>`get${this._element._type}("${this._element._name}").${name}(${[...arguments].join(',')})`;
      this._sequence.push(c);
      return this; 
    }
    this.settings[name] = (...args)=>f.apply(this,args);
    this[name] = f;
    return f;
  }
  #getTest(test,name,not) { 
    const skipEvalCommands = name.startsWith('$');
    name = name.replace(/^\$/,'');
    const that = this;
    const f = function () { 
      firstPassOnArguments.call(arguments,that._element);
      const tests = [], successCommands = [], failureCommands = [];
      const handler = new Proxy(that, {get(target,prop){  // Handler add test methods (and,or,etc.) to the commands
        if (['and','or','success','failure'].indexOf(prop)<0) return target[prop];
        return (...args) => {
          firstPassOnArguments.call(args,that._element);
          if (prop=='and'||prop=='or') tests.push({type:prop, test: args[0]});
          else if (prop=='success') successCommands.push(...args);
          else if (prop=='failure') failureCommands.push(...args);
          return handler;
        };
      }});
      const f = (...args)=>new Promise(async r=>{
        args = args.map(a=>(a instanceof Self?a.call(that._element):a));
        const ors = [];
        ors[0] = await test.call(that._element,...args);
        if (not) ors[0] = !ors[0];
        for (let t = 0; t < tests.length; t++){
          if (!(tests[t].test instanceof Function)) continue; // Instances of Commands are instances of Function
          if (tests[t].type=='or') ors.push(true);
          const s = await tests[t].test.call(that._currentTrial,that._node);
          ors[ors.length-1] = ors[ors.length-1] && s;
        }
        const success = ors.reduce((m,n)=>m||n);
        let callback = (success ? successCommands : failureCommands);
        for (let i = 0; i < callback.length; i++){
          if (!(callback[i] instanceof Function)) continue; // Instances of Commands are instances of Function
          await callback[i].call(that._currentTrial,that._node);
        }
        r( success );
      });
      const c = async (trial,parent) => {
        debug.log(`Running ${c.toString()} ${that._getItemNumber()||''}`);
        const copyOfArguments = [...arguments]; // Do not overwrite original arguments
        await secondPassOnArguments.call(copyOfArguments,skipEvalCommands);
        const v = await f.call(that._element,...copyOfArguments);
        debug.log(`> Test result (${c.toString()}): ${v?'success':'failure'} ${that._getItemNumber()||''}`);
        return v;
      };
      c.toString = ()=>`get${that._element._type}("${that._element._name}").test${not?'Not':''}.${name}(${[...arguments].join(',')})`;
      that._sequence.push(c);
      return handler;
    }
    if (not) this.testNot[name] = f;
    else this.test[name] = f;
    return f;
  }
  async call(trial,parent) {
    if (order.og===undefined)
      throw Error("Invoked .call() on a command before running a trial; your script cannot use getX().call()");
    this._currentTrial = trial || trials.current;
    // this._currentTrial = trials.current;
    // this._node = parent;
    this._node = parent || this._currentTrial._node;
    let lastValue = null;
    for (let i = 0; i < this._sequence.length; i++) {
      if (trials.running!=this._currentTrial) {
        debug.warning(`Element command aborted: ${this._sequence}, ${i} ${this._getItemNumber()||''}`);
        lastValue = "ABORTED";
      }
      else {
        try { lastValue = await this._sequence[i](trial,parent); }
        catch (e) { debug.error(`Error running element command ${this._sequence[i]}: ${e} ${this._getItemNumber()||''}`); }
      }
    }
    return lastValue;
  }
  toString(){ return `get${this._element._type}("${this._element._name}")`; }
}

// Every element's initial properties need to be backed up so they can be reset if the trial is re-run
const backups = new Map();
// Rigid properties are element properties that should never be modified during runtime
const IS_RIGID_PROPERTY = p=>Object({
  constructor,_type:1,_proto:1,_resources:1,value:1,_commands:1,_init:1,_end:1,
  addResource:1,dispatchEvent:1,addEventListener:1,_name:1
})[p]==1;
const backup = function(){
  const bu = {};  // Save the state before the trial to restore it at the end
  for (let p of Object.getOwnPropertyNames(this.__proto__))
    if (!IS_RIGID_PROPERTY(p)) bu[p] = this[p];
  for (let p of Object.getOwnPropertyNames(this))
    if (!IS_RIGID_PROPERTY(p)) bu[p] = this[p];
  backups.set(this, bu);
}

/** 
 * PennController elements belong to PennController trials and are named upon creation in `newElement`
 * (where `Element` stands for the type of element) and referenced back using `getElement("name")`.
 * @typedef {(Object)} Element 
 */
class Element {
  constructor(type,proto, ...args){
    this._type = type;
    this._proto = proto;
    this._resources = [];
    this._eventListeners = {};
    this._initialized = false;
    if (!(proto.immediate instanceof Function)) debug.error("Elements of type "+type+" should have an 'immediate' method");
    proto.immediate.apply(this, args);
  }
  get value() { return (this._proto.value||(()=>undefined)).call(this); }
  set value(v) { /* void */ }
  get _commands() { return new Commands(this,this._proto.actions,this._proto.settings,this._proto.test); }
  set _commands(v) { /* void */ }
  // private
  async _init(){
    if (this._initialized) return;
    await new Promise(r=>this._proto.uponCreation.call(this,r));
    this._initialized = true;
  }
  async _end() {
    await this.dispatchEvent('_end');
    const r = await this._proto.end.call(this);
    const backup = backups.get(this);  // Restore the pre-trial state for future reruns of this trial
    for (let p of Object.getOwnPropertyNames(this))
      if (!IS_RIGID_PROPERTY(p)) delete this[p];
    for (let p in backup) this[p] = backup[p];
    this._initialized = false;
    this._eventListeners = {};  // Object references persist in backup, so we need a new, empty object here
    return r;
  }
  // public
  addEventListener(name,f){
    this._eventListeners[name] = (this._eventListeners[name]||[]);
    this._eventListeners[name].push(f);
    return this;
  }
  async dispatchEvent(name, ...args) {
    const els = this._eventListeners[name];
    if (els===undefined) return;
    for (let e in els)
      await els[e].call(this, ...args);
  }
  addResource(name,preloader) {
    let r = (Resource.all[name] || [])[0];
    if (r === undefined) r = new Resource(name,preloader); // Need new resource
    else {
      const duplicates = trials.current._elements.filter(e=>e!=this).map(e=>e._resources).flat().filter(r=>r._name==name);
      if (duplicates.length>0){ // The current trial already uses the resource
        // Use an existing copy of the resource if there are enough already
        if (Resource.all[name].length>duplicates.length) r = Resource.all[name][duplicates.length];
        // Create a new copy of the resource if there aren't enough yet
        else r = new Resource(name,preloader);
      }
    }
    this._resources.push(r);
    return r._promise;
  }
  log(name,value,date,comments="NULL"){
    trials.current._logs.push([
      ["PennElementName", this._name],
      ["PennElementType", this._type],
      ["Parameter",name],
      ["Value",value],
      ["EventTime",date||Date.now()],
      ["Comments",comments]
    ]);
    return this;
  }
}

export const elements = {};
for (let c in standardCommands.special)
  elements[c] = (...args) => {
    const f = ()=>standardCommands.special[c].call(trials.running,...args);
    f.toString = ()=>c;
    return f;
  }
export const addElementType = (type, proto) => {
  type = type[0].toUpperCase() + type.substring(1);
  PennEngine.trials = trials; // For some reason importing trials in pennengine.js crashes
  const p = new proto(PennEngine);
  elements['new'+type] = (...args) => {
    const element = new Element(type, p, ...args);
    const argName = (args[0] && typeof(args[0])=="string" ? args[0] : "");
    // In case the immediate method didn't explicitly name the element, choose a name automatically
    element._name = element._name || argName || type;
    // Now make sure the name is unique
    const name = element._name;
    let i = 1;
    while (trials.current._elements.find(e=>e._type==type && e._name==element._name)) element._name = name+'-'+parseInt(i=i+1);
    if (argName && element._name != name) debug.warning(`A ${type} element named ${name} already exists--naming this one ${element._name}`);
    // The element has its final name, now back it up
    backup.call(element);
    trials.current._properElements.push(element);
    const commands = new Commands(element,p.actions,p.settings,p.test);
    commands._sequence.push(()=>element._init());
    // default commands
    let defaultCommands = [];
      // header
    if (trials.current._runHeader && footerHeaderTrials.header && footerHeaderTrials.header._defaults[type] instanceof Array)
      defaultCommands = footerHeaderTrials.header._defaults[type]
      // specific trial
    if (trials.current._defaults[type] instanceof Array)
      defaultCommands = [...defaultCommands, ...trials.current._defaults[type]]
    if (defaultCommands.length)
      defaultCommands.reduce((p,v)=>{
          let thisFn;
          if (v.name.startsWith("test.")) thisFn=[p.test,p.test[v.name.replace(/^test\./,'')]];
          else if (v.name.startsWith("testNot.")) thisFn=[p.testNot,p.testNot[v.name.replace(/^testNot\./,'')]];
          else thisFn=[p,p[v.name]];
          if (thisFn && thisFn[1] instanceof Function) p=thisFn[1].apply(thisFn[0],v.args);
          else debug.error(`Could not find command default${type}.<strong>${v.name}</strong>`);
          return p;
        }, commands);
    // return commands;
    return commands._asProxy();
  }
  elements['get'+type] = name => {
    const element = trials.current._elements.find( e=>e._type==type && e._name == name );
    if (element === undefined)
      debug.warning(`Found get${type}('${name}') before new${type}('${name}') could be found; make sure the element is created before the first get.`);
    // return new Commands(element,p.actions,p.settings,p.test);
    return (new Commands(element||new ElementRetrieval(name,trials.current,type),p.actions,p.settings,p.test))._asProxy();
  }
  elements['default'+type] = new Proxy({},{get(t,p){
    if (p=="settings") return elements['default'+type];
    else if (p=="test"||p=="testNot") return new Proxy({},{get(t2,p2){
      return (...args)=>{
        trials.current._defaults[type] = [...(trials.current._defaults[type]||[]),{name: p+'.'+p2, args: args}];
        return elements['default'+type];
      };
    }});
    else
      return (...args)=>{
        trials.current._defaults[type] = [...(trials.current._defaults[type]||[]),{name: p, args: args}];
        return elements['default'+type];
      };
  }})
};

PennEngine.Commands = Commands;
PennEngine.Element = Element;
PennEngine.evalArguments = secondPassOnArguments;
PennEngine.elements = elements;
