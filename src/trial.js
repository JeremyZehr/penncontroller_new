import { items, gotRunningOrder, order } from './order';
import { Commands } from './element';
import { debug } from './debug';

const debugButtons = document.createElement("DIV");
debugButtons.classList.add("buttons");
let promiseSkipCurrentCommand = ()=>null;
const skipCommandButton = document.createElement("BUTTON");
skipCommandButton.addEventListener("click",()=>{
  debug.log("Skipping current command");
  promiseSkipCurrentCommand.call();
});
skipCommandButton.innerText = "Skip command";
debugButtons.append(skipCommandButton);
const endTrialButton = document.createElement("BUTTON");
endTrialButton.addEventListener("click",()=>{
  if (trials.running instanceof Trial) trials.running._end();
  else order.current.options._finishedCallback([]);
});
endTrialButton.innerText = "End trial";
debugButtons.append(endTrialButton);
debug.tabs.Logs.tab.prepend(debugButtons);

export class Trial {
  constructor(header=true,footer=true){
    this._trial = this;
    this._label = 'undefined';
    this._runHeader = true;
    this._runFooter = true;
    this._sequence = [];
    this._properElements = [];
    this._extra_columns = [];
    this._defaults = {};
    this._finishedCallback = ()=>null;
  }
  // Private
  get _elements() {
    const es = [];
    if (this._runHeader && footerHeaderTrials.header) es.push(...footerHeaderTrials.header._properElements);
    es.push(...this._properElements);
    if (this._runFooter && footerHeaderTrials.footer) es.push(...footerHeaderTrials.footer._properElements);
    return es;
  }
  async _run(parent,sequence) {
    sequence = sequence || this._sequence;
    for (let p in sequence){
      const promise = sequence[p];
      if (trials.running != this) continue;
      else if (promise instanceof Function || promise instanceof SendResults){
        const f = promise.call(this,parent);
        await Promise.any([
          f instanceof Promise ? f.catch(e=>debug.error(`Error running command(s) #${p} on ${promise}: ${e}`)) : null ,
          new Promise(r=>promiseSkipCurrentCommand=r)
        ]);
      }
      else if (promise instanceof Array)
        await this._run(parent,promise);
    }
  }
  async _end() { 
    if (trials.running != this) return this;
    // END ALL ELEMENTS
    for (let e in this._elements) await this._elements[e]._end();
    // LOG END EVENT
    this._logs.push([
      ["PennElementName", this._label],
      ["PennElementType", "__Trial__"],
      ["Parameter","__Event__"],
      ["Value","__End__"],
      ["EventTime",Date.now()],
      ["Comments","NULL"]
    ]);
    // ADD ANY OF HEADER'S EXTRA COLUMNS
    if (footerHeaderTrials.header && this._runHeader) 
      await this._insertExtraColumns(footerHeaderTrials.header._extra_columns);
    // ADD SELF'S EXTRA COLUMNS
    await this._insertExtraColumns(this._extra_columns);
    // ADD ANY OF FOOTER'S EXTRA COLUMNS
    if (footerHeaderTrials.footer && this._runFooter) 
      await this._insertExtraColumns(footerHeaderTrials.footer._extra_columns);
    // SET TRIALS.RUNNING TO NULL *BEFORE* CALLING finishedCallback (WHICH WILL START NEXT TRIAL)
    trials.running = null;
    if (this._node instanceof Node) this._node.remove();
    this._logs = this._logs.sort((a,b)=>a[4][1]-b[4][1]);
    console.log("calling newTrial.finishedcallback with", this._logs);
    this._finishedCallback(this._logs); 
    return this;
  }
  _asItem() { return [this._label||'undefined', "PennController", this._trial]; }
  async _insertExtraColumns(ecs) {
    for (let c in ecs){
      let column = ecs[c], name = column[0], value = column[1];
      if (value instanceof Commands) value = await value._element.value;
      if (value instanceof Function) value = await value();
      // Insert extra column before COMMENTS
      this._logs = this._logs.map(v=>[...v.slice(0,-1),[name,value],...v.slice(-1)]);
    }
  }
  // Public
  log(name,value){ this._extra_columns.push([name,value]); return this; }
  label(name){ this._label = name; return this; }
  noFooter(){ this._runFooter = false; return this; }
  noHeader(){ this._runHeader = false; return this; }
  setOption(name,value) { 
    if (this[name]===undefined) this[name] = value; 
    else throw Error(`PennController trial option ${name} already set or read-only`);
    return this;
  }
}

const PRELOAD_TIMEOUT = 60000;
const printPreloading = async (trial,resources,delay=PRELOAD_TIMEOUT) => {
  if (resources.length==0) return;
  const preloadNode = document.createElement("DIV");
  const s = delay/1000, tm = Math.floor(s/60), ts = Math.floor(s%60);
  preloadNode.innerText = "Please wait while resources are preloading.";
  if (s>=1) preloadNode.innerText += ` This could take up to ${tm>0?tm+'min':''}${ts==0?'':ts+'s'}`;
  trial._node.append( preloadNode );
  const timed_out = {};
  let nw = Date.now();
  const preload = await Promise.race([
    new Promise(r=>setTimeout(()=>r(timed_out),delay)),
    Promise.all(resources.map(r=>r._promise))
  ]);
  console.log("diff",Date.now(),nw);
  if (preload==timed_out) 
    console.error("Some resources failed to preload:",...resources.filter(r=>r._status=="unloaded"));
  preloadNode.remove();
}

window.define_ibex_controller({
  name: "PennController",
  jqueryWidget: {
    _init: async function () {
      
      const trial = this.options._trial;
      trial._node = this.element[0];
      trial._finishedCallback = this.options._finishedCallback;

      this.cssPrefix = this.options._cssPrefix;
      this.utils = this.options._utils;

      trial._logs = [
        [
          ["PennElementName", trial._label],
          ["PennElementType", "__Trial__"],
          ["Parameter","__Event__"],
          ["Value","__Start__"],
          ["EventTime",Date.now()],
          ["Comments","NULL"]
        ]
      ];
      trials.running = trial;

      // PRELOAD
      const resources = trial._elements.map(e=>e._resources).flat();
      if (resources.length) await printPreloading(trial,resources);

      // HEADER
      if (footerHeaderTrials.header && trial._runHeader) 
        await footerHeaderTrials.header._run(this.element);

      // MAIN
      await trial._run(this.element);

      // FOOTER
      if (footerHeaderTrials.footer && trial._runFooter)
        await footerHeaderTrials.footer._run(this.element);
      
      // END
      await trial._end();
    }
  },
  properties: {obligatory: [], countsForProgressBar: true, htmlDescription: null}
});

export const trials = {
  all: [],
  running: null,
  constructing: new Trial()
};
Object.defineProperty(trials,'current',{get(){ return trials.running||trials.constructing }});

let pushItems = true;
export const pushItemsInNewTrial = (yesno=true) => pushItems = yesno;
export const newTrial = (label,...sequence) => {
  if (typeof label != "string") sequence = [label, ...sequence];
  const trial = trials.constructing;
  if (pushItems) items.push(trial);
  trial._label = (typeof label == "string" ? label : 'undefined');
  sequence.forEach(s=>removeSendResultsFromItems(s));
  trial._sequence = sequence;
  trials.all.push(trial);
  trials.constructing = new Trial();
  return trial;
}

const footerHeaderTrials = {};
const footerHeader = (which,...sequence) => {
  footerHeaderTrials[which] = footerHeaderTrials[which] || new Trial();
  const trial = footerHeaderTrials[which];
  sequence.forEach(s=>removeSendResultsFromItems(s));
  trial._sequence.push(...sequence);
  trial._properElements.push(...trials.constructing._properElements);
  trials.constructing = new Trial();
  return trial;
}
export const header = (...sequence) => footerHeader('header', ...sequence);
export const footer = (...sequence) => footerHeader('footer', ...sequence);

export const checkpreloaded = (...args) => {
  let labels = [], delay = PRELOAD_TIMEOUT;
  args.forEach( (a,i) => (i+1==args.length&&typeof(a)=="number"?delay=a:labels.push(a)) );
  if (labels.length==0) labels.push(()=>true);
  const trial = new Trial(/*header=*/false,/*footer=*/false);
  items.push(trial);
  trials.all.push(trial);
  trial._sequence = [async()=>{
    const resources = [];
    const ro = await gotRunningOrder;
    ro.flat().forEach( c=>{
      const t = c.options._trial;
      if (!(t instanceof Trial)) return;
      let include = false;
      for (let i = 0; i < labels.length; i++){
        if (typeof(labels[i])=="string") include = c.type == labels[i];
        else if (labels[i] instanceof Function) include = labels[i](c.type);
      }
      if (include)
        resources.push( ...t._elements.map( e=>e._resources ).flat() );
    });
    await printPreloading(trial,resources,delay);
  }];
  return trial;
}

export class SendResults {};
export const sendResults = label => {
  if (window.manualSendResults == undefined || window.manualSendResults != false) window.manualSendResults = true;
  const sym = {toString: ()=>"SendResults"};
  window.items = [ [label===undefined?[sym,null]:label, "__SendResults__", sym] ];
  const r = new SendResults();
  r.args = [s=>s==sym];
  r.run = a=>a[0];
  r.toString = ()=>"SendResults()";
  r.call = ()=>new Promise(r=>{
    debug.log("Running SendResults()");
    const p = document.createElement("p");
    trials.current._node.append(p);
    window.addSafeBindMethodPair('__SendResults__');
    window.jQuery(p).__SendResults__({_finishedCallback: r, _cssPrefix: '', _utils: order.current.options._utils})
  });
  return r;
}
export const removeSendResultsFromItems = sr=>{
  if (!(sr instanceof SendResults)) return;
  let idx;
  while ((idx=items.findIndex(i=>sr.args[0](i[2])))>=0) items.splice(idx,1);
}
