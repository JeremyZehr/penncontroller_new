import { trials, Trial } from './trial';
import { jump, order } from './order';
import { Commands } from './element';
import { debug } from './debug';
import { PennEngine } from './pennengine';
import { addStylesheet } from './utils';

const coordRegex = /^((left|top|center|middle|right|bottom) at )?(\d+.*)$/i;
const isPrinted = n=>n instanceof Node && document.body.contains(n);
const applyCss = function (css) {
  for (let p in css)
    this.style[p] = css[p];
}
const cssCommandOnNode = async function (node, ...args) {
  if (args.length==2 && typeof(args[0])=="string" && args[1] instanceof Object){
    const f = ()=>this._nodes[node].querySelectorAll(args[0]).forEach(n=>applyCss.call(n,css));
    this.addEventListener("print", f);
    if (this._nodes && this._nodes[node]) f();
  }
  else{
    let css = {};
    if (args.length==1 && args[0] instanceof Object) css = args[0];
    else if (args.length==2 && typeof(args[0])=="string" && typeof(args[1])=="string") css[args[0]] = args[1];
    this.addEventListener("print", ()=>applyCss.call(this._nodes[node],css));
    if (this._nodes && this._nodes[node]) applyCss.call(this._nodes[node],css);
  }
}
PennEngine.cssCommandOnNode = cssCommandOnNode;
// updatePrints keeps track of latest print parameters to keep "update" up to date(!)
const updatePrints = new Map();
const applyCoordinates = async (x,y,element,container,callback) => {
  updatePrints.set(element, {x:x,y:y,container:container});
  let bcr;  // BoundingClientRect of the container
  const update = async r=>{
    if (!(callback instanceof Function)) r();
    const updatePrint = updatePrints.get(element);
    if (updatePrint===undefined) return;
    x=updatePrint.x;
    y=updatePrint.y;
    container=updatePrint.container;
    // Stop updating the display if the container or the element is not printed
    if (bcr && (!isPrinted(container) || !isPrinted(element))) return;
    if (window.getComputedStyle(container).position=="static") container.style.position = 'relative';
    let newbcr;
    if (container==document.body)
      newbcr = {height: window.innerHeight, width: window.innerWidth,
                top: 0, left:0, bottom: window.innerHeight, right: window.innerWidth};
    else
      newbcr = container.getBoundingClientRect();
    // Don't do anything if BoundingClientRect hasn't changed since last update
    if (bcr && JSON.stringify(bcr)==JSON.stringify(newbcr)) return window.requestAnimationFrame(update);
    bcr = newbcr;
    const dummy = document.createElement("DIV");
    [['visibility','hidden'],['position','absolute'], // Create a dummy, hidden element in place of the one we want to print
     ['width','100%'],['height','100%'],              // so we can determine its BoundingClientRect and adjust its position
     ['left','0px'],['top','0px']].forEach(v=>dummy.style[v[0]]=v[1]);
    container.append(dummy);
    const dummybcr = dummy.getBoundingClientRect();
    dummy.remove();
    const transform = []; // We'll use transform X/Y to center the element horizontally and/or vertically
    const coordinate = (c,xOrY) => {
      xOrY = xOrY.toUpperCase();
      const leftOrTop = xOrY=='X'?'left':'top', widthOrHeight = xOrY=='X'?'width':'height';
      if (typeof(c)=='number') element.style[leftOrTop] = `${(bcr[leftOrTop]-dummybcr[leftOrTop])+c}px`;
      else if (typeof(c)=="string"){
        const phrase = c.match(coordRegex);
        if (phrase) {
          let coord = phrase[3];
          // Percentage
          if (coord.match(/^-?\d+(\.\d+)?%$/)) coord = `${bcr[widthOrHeight]*coord.replace('%','')/100}px`;
          // No unit
          else if (coord.match(/^-?\d+(\.\d+)?$/)) coord = coord+"px";
          // Invalid format
          else if (!coord.match(/^-?\d+(\.\d+)?[a-z]*$/i)) debug.error(`Invalid ${xOrY} coordinate: ${c}`);
          element.style[leftOrTop] = `calc(${(bcr[leftOrTop]-dummybcr[leftOrTop])}px + ${coord})`;
          if (phrase[1]) {
            if (phrase[1].match(/middle|center/i)) transform.push(`translate${xOrY}(-50%)`);
            else if (phrase[1].match(/right|bottom/i)) transform.push(`translate${xOrY}(-100%)`);
          }
        }
        else debug.error(`Invalid ${xOrY} coordinate: ${c}`);
      }
      else debug.error(`Invalid ${xOrY} coordinate: ${c}`);
    };
    if (x!==undefined) coordinate(x,'X');
    if (y!==undefined) coordinate(y,'Y');
    // if (transform.length) element.style.transform = transform.join(" ");
    element.style.transform = transform.join(" ");
    element.style.position = 'absolute';
    let dispatch = !isPrinted(element);
    container.append(element);
    if (dispatch && callback instanceof Function) {
      await callback();
      r();
    }
    window.requestAnimationFrame(update);
  };
  return new Promise(r=>update(r));
}
const processComplexPrint = async function (...args) {
  const evaledArguments = await PennEngine.evalArguments.call([...args]);
  let coordinates = [], where, beforeOrAfter;
  [...args, ...evaledArguments].forEach(v=>{
    if (typeof(v)=="number"||(typeof(v)=="string"&&v.match(coordRegex))) coordinates.push(v);
    else if (v instanceof Commands) where = v;
    else if (typeof(v)=="string"&&v.match(/^(before|after)$/i)) beforeOrAfter = v.toLowerCase();
  });
  if (coordinates.length==0) updatePrints.set(this._nodes.parent, undefined);
  if (where){
    const addBeforeOrAfterToWhere = ()=> {
      const whereNodes = where._element._nodes;
      whereNodes[beforeOrAfter] = (whereNodes[beforeOrAfter]||document.createElement("DIV"));
      whereNodes[beforeOrAfter].classList.add(beforeOrAfter);
      if (beforeOrAfter=='before') whereNodes.parent.prepend(whereNodes[beforeOrAfter]);
      else whereNodes.parent.append(whereNodes[beforeOrAfter]);
    };
    const isWherePrinted = isPrinted((where._element._nodes||{}).main);
    if (coordinates.length){
      const ac = async ()=>{
        if (beforeOrAfter) addBeforeOrAfterToWhere();
        await applyCoordinates(
          coordinates[0],
          coordinates[1],
          this._nodes.parent,
          beforeOrAfter?where._element._nodes[beforeOrAfter]:where._element._nodes.main,
          ()=>this.dispatchEvent("print", ...args)
        );
      };
      if (isWherePrinted) await ac();
      else where._element.addEventListener("print",ac);
    }
    else{
      const ap = async ()=>{
        if (beforeOrAfter) addBeforeOrAfterToWhere();
        (beforeOrAfter?where._element._nodes[beforeOrAfter]:where._element._nodes.main).append( this._nodes.parent );
        await this.dispatchEvent("print", ...args);
      };
      if (isWherePrinted) await ap();
      else where._element.addEventListener("print",ap);
    }
  }
  else {
    where = args.find(v=>v instanceof Node);
    if (!where) where = args.find(v=>v instanceof Function);
    if (where instanceof Function) where = await where();
    if (!(where instanceof Node)) where = undefined;
    if (coordinates.length){
      if (!where) where = document.body;
      await applyCoordinates(coordinates[0],coordinates[1],this._nodes.parent,where,()=>this.dispatchEvent("print", ...args));
    }
    else{
      if (!where) where = trials.current._node;
      where.append(this._nodes.parent);
      await this.dispatchEvent("print", ...args);
    }
  }
};
const printBeforeOrAfter = async function(r,beforeOrAfter,what){
  let once = false;
  if (what instanceof Commands) await what.call();  // If commands, run them now
  const callback = async ()=>{
    if (once) return;
    if (what instanceof Commands) await what._element._commands.print(this._commands,beforeOrAfter).call();
    else {
      if (what instanceof Function) what = await what();
      const thisNodes = this._element._nodes;
      thisNodes[beforeOrAfter] = (thisNodes[beforeOrAfter]||document.createElement("DIV"));
      thisNodes[beforeOrAfter].classList.add(beforeOrAfter);
      if (beforeOrAfter=='before') thisNodes.parent.prepend(thisNodes[beforeOrAfter]);
      else thisNodes.parent.append(thisNodes[beforeOrAfter]);
    }
    once = true;
  }
  if (isPrinted((this._nodes||{}).parent)) await callback();
  else this.addEventListener("print",callback);
//   this._nodes[beforeOrAfter] = (this._nodes[beforeOrAfter]||document.createElement("DIV"));
//   this._nodes[beforeOrAfter].classList.add(beforeOrAfter);
//   if (what instanceof Commands) await what.call();  // If commands, run them now
//   const c = async ()=>{
//     if (!isPrinted((this._nodes||{}).parent)) return;
//     if (beforeOrAfter=='before') this._nodes.parent.prepend(this._nodes[beforeOrAfter]);
//     else this._nodes.parent.append(this._nodes[beforeOrAfter]);
//     // If commands (ie reference to element) then create new *empty* commands so as to only stack "print," and run it
//     if (what instanceof Commands) await what._element._commands.print(this._nodes[beforeOrAfter]).call();
//     else {
//       if (what instanceof Function) what = await what();
//       this._nodes[beforeOrAfter].append(what);
//     }
//   };
//   this.addEventListener("print", c);
//   if (isPrinted((this._nodes||{}).parent)) await c();
  r();
};

export const standardCommands = {
  actions: {
    $print: async function(r, ...args){
      const name = this._name.replace(/\s+/g,'_');
      this._nodes = (this._nodes||{});
      if (this._nodes.main===undefined) this._nodes.main = document.createElement("div");
      this._nodes.main.classList.add(`PennController-${this._type}`,`PennController-${name}`);
      if (this._nodes.main.style.display=="") this._nodes.main.style.display = 'inline-block';
      if (this._nodes.parent===undefined) this._nodes.parent = document.createElement("div");
      this._nodes.parent.classList.add(`PennController-${this._type}-container`,`PennController-${name}-container`);
      this._nodes.parent.style.display = 'flex';
      this._nodes.parent.append(this._nodes.main);
      await processComplexPrint.call(this, ...args);
      // await this.dispatchEvent("print", ...args);
      this.addEventListener("_end",()=>{
        if (this._nodes) {  // Make sure to remove all printed content when the trial ends
          if (this._nodes.before instanceof Node) this._nodes.before.remove();
          if (this._nodes.after instanceof Node) this._nodes.after.remove();
          if (this._nodes.main instanceof Node) this._nodes.main.remove();
          if (this._nodes.parent instanceof Node) this._nodes.parent.remove();
        }
      });
      r();
    },
    remove: async function(r){
      if (this._nodes) 
        for (let n in this._nodes) this._nodes[n].remove();
      r();
    }
  },
  settings: {
    addClass: async function(r,cl) {
      const f = ()=>{
        if (this._nodes){
          if (this._nodes.main instanceof Node) this._nodes.main.className += " "+cl;
          if (this._nodes.parent instanceof Node) this._nodes.parent.className += " "+cl;
        }
      };
      this.addEventListener("print", f);
      r( f() );
    },
    $after: function(r,what){ return printBeforeOrAfter.call(this, r, 'after', what) },
    $before: function(r,what){ return printBeforeOrAfter.call(this, r, 'before', what) },
    bold: async function(r){ await cssCommandOnNode.call(this, 'main', {'font-weight': 'bold'}); r(); },
    center: async function(r){ await cssCommandOnNode.call(this, 'parent', {width: '100%', 'justify-content': 'center'}); r(); },
    color: async function(r,c){ await cssCommandOnNode.call(this, 'main', {color: c}); r(); },
    css: async function(r, ...args){ await cssCommandOnNode.call(this, 'main', ...args); r(); },
    cssContainer: async function(r, ...args){ await cssCommandOnNode.call(this, 'parent', ...args); r(); },
    cssRule: async function(r,string){ 
      let css = string.replace(
        /(^|\n)(([^,{\n]+(,\s*)?)+)\{/g, // All selectors in lines that end with {
        m=>m.replace(/(^\n?|,\s*)/g,`\$1.PennController-${this._type}.PennController-${this._name} `));
      const l = addStylesheet(css);
      this.addEventListener("_end",()=>l.remove());
      r(); 
    },
    disable: async function(r){ (this._nodes||{main:{}}).main.disabled=true; this._disabled=true; r(); },
    enable: async function(r){ (this._nodes||{main:{removeAttribute:()=>null}}).main.removeAttribute("disabled"); this._disabled=undefined; r(); },
    $function: async function(r,f) {
      if (f instanceof Function) await f.call(trials.current,this);
      r();
    },
    italic: async function(r){ await cssCommandOnNode.call(this, 'main', {'font-style': 'italic'}); r(); },
    left: async function(r){ await cssCommandOnNode.call(this, 'parent', {width: '100%', 'justify-content': 'start'}); r(); },
    log: async function(r){ this._log = true; r(); },
    once: function(r){ this.addEventListener("waited", ()=>{ (this._nodes||{main:{}}).main.disabled=true; this._disabled=true }); r(); },
    removeClass: async function(r,cl){ 
      const d = Date.now();
      const f = ()=>{
        const classes = cl.split(/\s\t+/);
        if (this._nodes){
          if (this._nodes.main instanceof Node) classes.forEach(c=>this._nodes.main.classList.remove(c));
          if (this._nodes.parent instanceof Node) classes.forEach(c=>this._nodes.parent.classList.remove(c));
        }
      };
      this.addEventListener("print", f);
      r( f() );
    },
    right: async function(r){ await cssCommandOnNode.call(this, 'parent', {width: '100%', 'justify-content': 'end'}); r(); },
    size: async function(r,w,h) { await cssCommandOnNode.call(this, 'main', {width: w, height: h}); r(); }
  },
  tests: {
    printed: function(){ return isPrinted((this._nodes||{}).main); }
  },
  special: {
    clear: async function(){
      debug.log(`Running clear() -- removing all elements currently displayed`);
      for (let e in trials.running._elements)
        await trials.running._elements[e]._commands.remove().call(trials.running,null);
      return;
    },
    end: async function(){ 
      debug.log(`Running end() from current trial`);
      if (trials.running instanceof Trial) trials.running._end();
      else order.current.options._finishedCallback([]);
      return;
    },
    exitFullscreen: async function() {
      debug.log(`Running exitFullscreen()`);
      if (document.exitFullscreen) await new Promise(r=>document.exitFullscreen().then(r)
        .catch(e=>r(debug.warning("Ran exitFullscreen() while not in fullscreen mode"))));
    },
    fullscreen: async function() { 
      debug.log(`Running fullscreen()`);
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    },
    jump: async function(predicate,){
      debug.log(`Running jump(${predicate})`);
      await jump(predicate);
    }
  }
}

PennEngine.applyCoordinates = applyCoordinates;
