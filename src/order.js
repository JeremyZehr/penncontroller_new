import { Trial, trials } from './trial'
import { Template } from './template'
import { debug } from './debug'

let seq = null;
export const sequence = (...args) => seq = window.seq(...args);
Object.defineProperty(window, 'shuffleSequence', {get(){ return (seq||window.seq(window.anyType)) }});

export const items = [];
let finalItems = [];
Object.defineProperty(window, 'items', {
  set(i) { 
    const flatI = i.flat();
    // Exclude any trial added by newTrial which is in fact included in the setting of items
    const itemsNoRedundance = items.filter( v=>!flatI.find(w=>w==v[2]) );
    while (items.length) items.pop();
    items.push(...itemsNoRedundance);
    // Now add the items
    items.push(...i);
  },
  get() { 
    if (order.og && finalItems) return finalItems;
    const its = [];
    items.forEach(i=>{
      if (i instanceof Trial) its.push(i._asItem());
      else if (i instanceof Template) its.push(...i._asItems());
      else its.push(i);
    });
    its.push = (...i)=>items.push(...i); its.pop = (...i)=>items.pop(...i);
    its.unshift = (...i)=>items.unshift(...i); its.shift = (...i)=>items.shift(...i);
    its.splice = (...i)=>items.splice(...i);
    finalItems = its;
    return its;
  }
});

const refreshSequence = async () => {
  await gotRunningOrder;
  const ro = originalRunningOrder, idx = ro.findIndex(r=>r.indexOf(order.current)>=0);
  const progressBar = document.querySelector(".bar-container .bar");
  let progressPassedPoints = 0, progressTotalPoints = 0;
  const ol = document.createElement("OL");
  ro.forEach( (t,i) => {
    const olli = document.createElement("LI");
    if (idx==i) olli.style['background-color'] = 'pink';
    const reachButton = document.createElement("BUTTON");
    reachButton.innerText = "Reach";
    reachButton.addEventListener("click", ()=>jumpToItem(t));
    olli.append(reachButton);
    const ul = document.createElement("UL");
    t.forEach( e=> {
      const ulli = document.createElement("LI");
      ulli.innerHTML = `<strong>${(e.type||'No Label').toString()}</strong> (${e.controller.toString()})`;
      ul.append(ulli);
      if (progressBar) {
        const defaultCountsForProgressBar = window.ibex_controller_get_property(e.controller, "countsForProgressBar");
        if (e.options.countsForProgressBar || 
            (e.options.countsForProgressBar===undefined&&defaultCountsForProgressBar)) {
          progressTotalPoints++;
          if (i<idx) progressPassedPoints++;
        }
      }
    });
    olli.append(ul);
    ol.append(olli);
  });
  debug.tabs.Sequence.tab.innerHTML = "";
  debug.tabs.Sequence.tab.append(ol);
  if (progressBar){
    const progressBarMaxWidth = parseInt(progressBar.parentElement.style.width);
    progressBar.style.width = `${Math.round(progressPassedPoints*progressBarMaxWidth/progressTotalPoints)}px`;
  }
}
let originalRunningOrder;
export const gotRunningOrder = new Promise(r=> {
  const modifyRunningOrders = [];
  Object.defineProperty(window,'modifyRunningOrder',{ 
    get(){ return ro =>{
      // main.js has been executed, prevent participants from messing with debugger
      // window.PennController.Debug = ()=>null; window.PennController.DebugOff = ()=>null;
      if (!debug.on){
        debug.show = ()=>null; 
        debug.switch = ()=>null;
        while (items.length) items.pop();
        window.CHUNKS_DICT = {};
      }
      modifyRunningOrders.forEach( f=>ro=f(ro) );
      order.ro = ro;
      const original_addSafeBindMethodPair = window.addSafeBindMethodPair;
      window.addSafeBindMethodPair = function(...args){
        if (originalRunningOrder===undefined){
          originalRunningOrder = [...ro];
          order.og = originalRunningOrder;
          r(ro);
          refreshSequence();
        }
        return original_addSafeBindMethodPair.apply(this,args); 
      }
      return ro;
    } },
    set(f){ modifyRunningOrders.push(f); }
  });
});

export const order = {};
let currentItemIdx = 0, currentElementIdx = -1;
const newItem = async ()=>{
  const runningOrder = await gotRunningOrder;
  currentElementIdx++;
  if (currentElementIdx>=runningOrder[currentItemIdx].length){
    currentItemIdx++;
    currentElementIdx = 0;
  }
  order.current = runningOrder[currentItemIdx][currentElementIdx];
  refreshSequence();
}
gotRunningOrder.then( ro=>newItem() );  // dget only gets called on the *second* item/element in the sequence

const dgetOld = window.dget;
window.dget = (...args) => {    // Called whenever a new item shows up
  const r = dgetOld(...args);   // displayMode,overwrite only called in finishCallback
  if (args[1] && args[1] == "displayMode" && args[2] && args[2] == "overwrite") newItem();
  return r;
};

export const jumpToItem = async (item,endNow=true) => {
  if (!trials.current) return;
  const ro = await gotRunningOrder;
  const original_ro_idx = originalRunningOrder.indexOf(item);
  if (original_ro_idx<0) return;
  while (ro.length>currentItemIdx+1) ro.pop();  // Delete all after the current one
  for (let i = original_ro_idx; i < originalRunningOrder.length; i++) ro.push(originalRunningOrder[i]);
  if (!endNow) return;
  const currentItemBuffer = [...ro[currentItemIdx]], currentItemIdxCopy = currentItemIdx;
  ro[currentItemIdx] = [...ro[currentItemIdx].slice(0,currentElementIdx+1)];
  if (order.current.options._trial instanceof Trial) order.current.options._trial._end();
  else order.current.options._finishedCallback([]);
  // Place the elements back into the left item
  new Promise(function idxChanged(r){
    if (currentItemIdx!=currentItemIdxCopy) r();
    else window.requestAnimationFrame(()=>idxChanged(r));
  }).then(()=>ro[currentItemIdxCopy] = [...currentItemBuffer]);
}
export const jump = async predicate => {
  await gotRunningOrder;
  if (typeof(predicate)=="string") predicate = ((p)=>s=>s==p)(predicate);
  console.log("predicate", predicate, "originalRunningOrder", originalRunningOrder);
  const item = originalRunningOrder.find(v=>predicate(v[0].type));
  if (item) jumpToItem(item,/*endNow=*/false);
  else debug.warning(`No trial found matching jump's argument ${predicate}`);
}
