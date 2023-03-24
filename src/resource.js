import { gotRunningOrder } from './order';
import { Trial } from './trial';
import { hosts } from './global';
import { scanZipForResource } from './zip';
import { debug } from './debug';

const resources = {};

export class Resource {
  constructor(name,preloader){
    resources[name] = this;
    this._name = name;
    this._status = 'unloaded';
    this._promise = new Promise(r=>this._r = r);
    this._promise.then(()=>{this._status='loaded';debug.log("Finished preloading "+name);});
    this._preloader = (preloader instanceof Function ? preloader : async ()=>null );
  }
  preload(name) {
    if (name===undefined) name = this._name;
    if (this._status=='unloaded'){
      debug.log("Starting to preload "+name);
      this._preloader(name).then( r=>this._r(r) );
      if (!name.match(/^http/i)) {
        hosts.filter(h=>h.match(/^http/i)).forEach(h=>this._preloader(h+name).then(r=>this._r(r)));
        scanZipForResource(this);
      }
    }
    return this._promise;
  }

  static get all() { return resources; }
}

const ROLL_TIMEOUT = 60*1000; // Time after which next resource starts to preload
const MAX_PARALLEL_RESOURCES = 4; // Number of resources allowed to preload in parallel
const resourcesToLoad = [], resourcesPreloading = [];
const runPreloadCycle = ()=>{
  while (resourcesPreloading.length<MAX_PARALLEL_RESOURCES && resourcesToLoad.length>0){
    const r = resourcesToLoad.shift();
    resourcesPreloading.push(r);
    Promise.race([r._promise,new Promise(r=>setTimeout(r,ROLL_TIMEOUT))]).then(()=>{
      if (r._status!='loaded') {
        debug.warning("Resource "+r._name+" has not finished preloading after "+ROLL_TIMEOUT+"ms");
        console.log("Resource",r,"has not finished preloading after "+ROLL_TIMEOUT+"ms")
      }
      const idx = resourcesPreloading.indexOf(r);
      if (idx>=0) resourcesPreloading.splice(idx,1);
    });
    r.preload();
  }
  if (resourcesToLoad.length>0)
    window.requestAnimationFrame(runPreloadCycle);
}
gotRunningOrder.then( async ro => {
  ro.flat().map(i=>i.options).forEach(t=>{
    if (!(t._trial instanceof Trial)) return;
    t._trial._elements.map(e=>e._resources).flat().forEach(r=> resourcesToLoad.indexOf(r)<0 && resourcesToLoad.push(r) );
  });
  runPreloadCycle();
});
