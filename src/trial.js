import { items, gotRunningOrder, order } from './order';
import { Commands } from './element';
import { debug } from './debug';
import { get_encrypted_blob } from './utils';

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
    this._logStart = true;
    this._logEnd = true;
    this._logHeader = true;
    this._logFooter = true;
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
    let trial = this; // Pass down this as the running trial, or trials.running if this is the header or footer trial
    if ([footerHeaderTrials.header,footerHeaderTrials.footer].indexOf(trial)>=0) trial = trials.running;
    for (let p in sequence){
      const promise = sequence[p];
      if (trials.running != trial) continue;
      else if (promise instanceof Function || promise instanceof SendResults){
        const f = promise.call(trial,parent);
        await Promise.any([
          f instanceof Promise ? f.catch(e=>debug.error(`Error running command(s) #${p} on ${promise}: ${e}`)) : null ,
          new Promise(r=>promiseSkipCurrentCommand=r)
        ]);
      }
      else if (promise instanceof Array)
        await trial._run(parent,promise);
    }
  }
  async _end() { 
    if (trials.running != this) return this;
    // END ALL ELEMENTS
    for (let e in this._elements) await this._elements[e]._end();
    // LOG END EVENT
    if (this._logEnd) logTrialEvent(this,"__Trial__","__End__");
    // ADD ANY OF HEADER'S EXTRA COLUMNS
    if (footerHeaderTrials.header && this._runHeader) {
      await this._insertExtraColumns(footerHeaderTrials.header._extra_columns);
    }
    // ADD SELF'S EXTRA COLUMNS
    await this._insertExtraColumns(this._extra_columns);
    // ADD ANY OF FOOTER'S EXTRA COLUMNS
    if (footerHeaderTrials.footer && this._runFooter) 
      await this._insertExtraColumns(footerHeaderTrials.footer._extra_columns);
    // SET TRIALS.RUNNING TO NULL *BEFORE* CALLING finishedCallback (WHICH WILL START NEXT TRIAL)
    trials.running = null;
    if (this._node instanceof Node) this._node.remove();
    this._logs = this._logs.sort((a,b)=>a[4][1]-b[4][1]);
    for (let log of this._logs) // pairs of column name + value
      for (let i in log) log[i] = [
        String(log[i][0]).replace(/,/g,'%2C').replace(/[\n\r]/g,'%0A'),
        String(log[i][1]).replace(/,/g,'%2C').replace(/[\n\r]/g,'%0A')
      ];
      // for (let i in log) log[i] = [encodeURIComponent(log[i][0]),encodeURIComponent(log[i][1])];
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
  noTrialLog(...what){ 
    if (what.length==0 || what.find(v=>v.match(/start/))) this._logStart = false;
    if (what.length==0 || what.find(v=>v.match(/end/))) this._logEnd = false;
    if (what.length==0 || what.find(v=>v.match(/header/))) this._logHeader = false;
    if (what.length==0 || what.find(v=>v.match(/footer/))) this._logFooter = false;
    return this; 
  }
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
  const preload = await Promise.race([
    new Promise(r=>setTimeout(()=>r(timed_out),delay)),
    Promise.all(resources.map(r=>r._promise))
  ]);
  if (preload==timed_out) 
    console.error("Some resources failed to preload:",...resources.filter(r=>r._status=="unloaded"));
  preloadNode.remove();
}

const logTrialEvent = (trial,type,event) => trial._logs.push([
  ["PennElementName", trial._label],
  ["PennElementType", type],
  ["Parameter","__Event__"],
  ["Value",event],
  ["EventTime",Date.now()],
  ["Comments","NULL"]
]);

window.define_ibex_controller({
  name: "PennController",
  jqueryWidget: {
    _init: async function () {
      
      const trial = this.options._trial;
      trial._node = this.element[0];
      trial._finishedCallback = this.options._finishedCallback;

      this.cssPrefix = this.options._cssPrefix;
      this.utils = this.options._utils;

      trial._logs = [];
      if (trial._logStart) logTrialEvent(trial,"__Trial__","__Start__");

      trials.running = trial;

      // PRELOAD
      const resources = trial._elements.map(e=>e._resources).flat();
      if (resources.length) await printPreloading(trial,resources);

      // HEADER
      if (footerHeaderTrials.header && trial._runHeader) {
        if (trial._logHeader && footerHeaderTrials.header._logStart) logTrialEvent(trial,"__Header__","__Start__");
        await footerHeaderTrials.header._run(this.element);
        if (trial._logHeader && footerHeaderTrials.header._logEnd) logTrialEvent(trial,"__Header__","__End__");
      }

      // MAIN
      await trial._run(this.element);

      // FOOTER
      if (footerHeaderTrials.footer && trial._runFooter) {
        if (trial._logFooter && footerHeaderTrials.footer._logStart) logTrialEvent(trial,"__Footer__","__Start__");
        await footerHeaderTrials.footer._run(this.element);
        if (trial._logFooter && footerHeaderTrials.footer._logEnd) logTrialEvent(trial,"__Footer__","__End__");
      }
      
      // END
      await trial._end();
    }
  },
  properties: {obligatory: [], countsForProgressBar: true, htmlDescription: null}
});

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

export const footerHeaderTrials = {};
const footerHeader = (which,...sequence) => {
  footerHeaderTrials[which] = footerHeaderTrials[which] || new Trial();
  const trial = footerHeaderTrials[which];
  sequence.forEach(s=>removeSendResultsFromItems(s));
  trial._sequence.push(...sequence);
  trial._properElements.push(...trials.constructing._properElements);
  trial._defaults = {...trials.constructing._defaults};
  Object.defineProperty(trial,'_node',{get(){ return trials.running._node; }});
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

const oldAlert = window.alert;
window.alert = function(...args){
  if (args[0]=="WARNING: Results have already been sent once. Did you forget to set the 'manualSendResults' config option?") return;
  return oldAlert.call(this, ...args);
}
const DOWNLOADMESSAGE = "Click here to download a copy of your results";
const CONTACTMESSAGE = "The experimenters might contact you in case the results are missing on their end:";

export class SendResults {};
export const sendResults = (label,noPrompt) => {
  if (window.manualSendResults == undefined || window.manualSendResults != false) window.manualSendResults = true;
  const sym = {
    toString: ()=>"SendResults", 
    _cssPrefix: '',
    noPrompt: noPrompt,
    downloadMessage: DOWNLOADMESSAGE,
    contactMessage: CONTACTMESSAGE
  };
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
    sym._finishedCallback = r;
    sym._utils = order.current.options._utils;
    window.jQuery(p).__SendResults__(sym);
  });
  r.setOption = (p,t) => {
    if (p=="noPrompt") sym.noPrompt = t;
    if (p=="downloadMessage") sym.downloadMessage = t;
    if (p=="contactMessage") sym.contactMessage = t;
    return r;
  }
  return r;
}
export const removeSendResultsFromItems = sr=>{
  if (!(sr instanceof SendResults)) return;
  let idx;
  while ((idx=items.findIndex(i=>sr.args[0](i[2])))>=0) items.splice(idx,1);
}

// Catch the allResults array
let allResults;
const resultsCandidates = new Map();
const oldPush = window.Array.prototype.push;
window.Array.prototype.push = function(...args){
  if ( !resultsCandidates.has(this) && this.length>0 &&
      this.map(v=>v instanceof Array && v.length>=5 && v.map(w=>w instanceof Array && w.length==2).reduce((a,b)=>a&&b) &&
               v[0][0]==0&&v[1][0]==1&&v[2][0]==2&&v[3][0]==3&&v[4][0]==4).reduce((a,b)=>a&&b) )
    resultsCandidates.set(this,[]);
  return oldPush.call(this, ...args);
}
const pushDirectlyToResults = (...args) => {
  if (allResults===undefined)
    resultsCandidates.forEach( (pushes,keyArray) => pushes.push([keyArray.length, ...args]) );
  else
    resultsCandidates.forEach( (pushes,keyArray) => keyArray.push(...args) );
}

// Make it possible to encrypt the local copy of the results file
let encryption_public_key;
export const encryptResults = key => encryption_public_key = key;
// Overwrite __SendResults__ to insert manual download of results
gotRunningOrder.then(()=>{
  const oldInit = jQuery.ui.__SendResults__.prototype._init;
  let t;  // This will be updated by each SendResults, so it will refer appropriately in JSON.stringify (overwritten only once)
  jQuery.ui.__SendResults__.prototype._init = function(){
    t = this;
    const oldCallback = t.options._finishedCallback, oldStringify = JSON.stringify;
    t.downloadResults = t.downloadResults || document.createElement("P");
    t.clickedDownload = t.clickedDownload || new Promise(r=>null);
    // Only overwrite JSON.stringify once
    if (allResults===undefined) JSON.stringify = function(...args){
      if (args.length==1 && args[0] instanceof Array && args[0].length==6 && 
          args[0][0]===false && args[0][3] instanceof Array && resultsCandidates.has(args[0][3])) {
        // The first time JSON.stringify is called, set allResults
        if (allResults===undefined){
          // We have now identified allResults: delete all other candidates and add the pending pushes
          resultsCandidates.forEach( (pushes,keyArray) => keyArray!=args[0][3] && resultsCandidates.delete(keyArray) );
          const pushes = resultsCandidates.get(args[0][3]);
          let offset = 0;
          pushes.forEach( p => {
            const toPush = p.slice(1,);
            args[0][3].splice(offset+p[0],0,...toPush);
            offset += toPush.length;
          });
          allResults = [false,args[0][1],args[0][2],[],args[0][4],args[0][5]];
        }
        // Each time JSON.stringify is called, push allResults[3]
        allResults[3].push(...args[0][3]);
        // Create a link to let participants download their results
        if (t.downloadResults.childElementCount==0){
          const link = document.createElement("A");
          link.innerHTML = t.options.downloadMessage||DOWNLOADMESSAGE;
          link.download = "results_"+(window.location.host+window.location.pathname).replace(/\W/g,'')+"_"+args[0][4]+".bak";
          get_encrypted_blob(oldStringify(allResults),encryption_public_key).then(blob=>{
            link.href = URL.createObjectURL(blob);
            t.clickedDownload = new Promise(r=>link.onclick=r);
            const d = document.createElement("DIV");
            d.innerText = t.options.contactMessage||CONTACTMESSAGE;
            t.downloadResults.append(d);
            t.downloadResults.append(link);
            if (!t.options.noPrompt) t.element.append(t.downloadResults);
            const originalEmpty = t.element.empty;
            t.element.empty = function(){
              const r = originalEmpty.call(this);
              if (!t.options.noPrompt) t.element.append(t.downloadResults);
              return r;
            }
          });
        }
      }
      return oldStringify(...args);
    }
    t.options._finishedCallback = async function() { 
      if (!t.options.noPrompt) {
        t.element.append(t.downloadResults);
        await t.clickedDownload;
      }
      // These results have been sent, delete them from array
      const resultLines = resultsCandidates.keys().next().value;
      resultLines.splice(0,resultLines.length);
      oldCallback.call(t);
    }; 
    return oldInit.call(t); 
  }
});

export const trials = {
  all: [],
  running: null,
  constructing: new Trial(),
  pushDirectlyToResults: pushDirectlyToResults
};
Object.defineProperty(trials,'current',{get(){ return trials.running||trials.constructing }});
