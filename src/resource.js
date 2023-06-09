import { gotRunningOrder } from './order';
import { Trial } from './trial';
import { hosts } from './global';
import { scanZipForResource } from './zip';
import { debug } from './debug';

const resources = {};

export class Resource {
  constructor(name,preloader){
    resources[name] = [...resources[name]||[],this];
    this._name = name;
    this._status = 'unloaded';
    // Create a promise that can be resolved by calling this._r
    this._promise = new Promise(r=>this._r = r); // resolving the promise marks the resource as loaded
    this._promise.then(()=>{this._status='loaded';debug.log("Finished preloading "+name);});
    // this._preloader needs to be an async function that returns the object resolved by this._promise
    this._preloader = (preloader instanceof Function ? preloader : async ()=>null );
    // keep track of attempts to preload (array of this._preloader's)
    this._preloadAttempts = [];
    this._checkForErrors = false; // check for errors once all attempts have started
  }
  // wrapper to call this._preloader and keep track of the attempt
  preloader(uri) {
    if (this._status=="loaded") return; // no need to call this._preloader if the resource has already loaded
    this._preloadAttempts.push(this._preloader(uri).then( r=>this._r(r) ));
  }
  preload(name) {
    if (name===undefined) name = this._name;
    if (this._status=='unloaded'){
      debug.log("Starting to preload "+name);
      this.preloader(name);
      let zipFilesExtracted = new Promise(r=>r());
      if (!name.match(/^http/i)) {
        for (let h of hosts)
          if (h.match(/^http/i)) this.preloader(h+name);
        zipFilesExtracted = Promise.allSettled(scanZipForResource(this));
      }
      Promise.allSettled(this._preloadAttempts); // embed promises in an environment that won't throw errors
      zipFilesExtracted.then(async ()=>{
        const rs = await Promise.allSettled(this._preloadAttempts);
        if (rs.find(r=>r.status=="fulfilled")) return;
        debug.warning(`No valid resource named ${this._name} could be found at any URL or in any zip file.`);
      });
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
        console.log("Resource",r,"has not finished preloading after "+ROLL_TIMEOUT+"ms");
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
