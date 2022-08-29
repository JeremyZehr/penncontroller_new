window.PennController._AddElementType('DragDrop', function (PennEngine){

  const addWhat = function(what,node){  // what in ['_drags','_drops']
    let d = this[what].find(v=>v.node==node);
    if (d!==undefined) return d;
    d = {node: node};
    if (what=='_drags') {
      d.dragging = false;
      d.drop = undefined;
      d.placeholder = undefined;
    }
    else if (what=='_drops'){
      d.drag = [];
      d.offset = {};
    }
    this[what].push(d);
    return d;
  }
  const addWhatCommand = async function(what, els) {  // what in ['_drags','_drops']
    for (let i = 0; i < els.length; i++){
      if (els[i] instanceof PennEngine.Commands){
        await els[i].call();
        const node = (els[i]._element._nodes||{main: undefined}).main;
        if (node===undefined) els[i]._element.addEventListener("print", ()=>addWhat.call(this,what,els[i]._element._nodes.main));
        else addWhat.call(this,what,node);
      }
      else if (els[i] instanceof Function){
        const node = await els[i].call();
        if (node instanceof Node) addWhat.call(this,what,node);
      }
      else if (els[i] instanceof Node) addWhat.call(this,what,els[i]);
    }
  }
  const removeWhat = async function(what,els){
    for (let i = 0; i < els.length; i++){
      let node;
      if (els[i] instanceof PennEngine.Commands){
        await els[i].call();
        node = (els[i]._element._nodes||{main: undefined}).main;
      }
      else if (els[i] instanceof Function)
        node = await els[i].call();
      const idx = this[what].findIndex(v=>v.node==node);
      if (idx>=0) this[what].splice(idx,1);
    }
  }
  const cancelDragging = function(destination){ 
    const d = this._dragging;
    if (!d) return;
    d.dragging = false;
    d.node.style['pointer-events'] = 'unset';
    if (this._bungee && d.placeholder instanceof Node) {
      d.placeholder.parentElement.insertBefore(d.node,d.placeholder);
      d.placeholder.remove();
      d.placeholder = undefined;
      d.node.style.position = d.oldStyle.position;
      d.node.style.top = d.oldStyle.top;
      d.node.style.left = d.oldStyle.left;
      d.node.style['margin-left'] = d.oldStyle['margin-left'];
      d.node.style['margin-top'] = d.oldStyle['margin-top'];
    }
    d.drop = destination;
    this._dragging = null;
  }
  const dropOn = function(d,destination) {
    d.dragging = false;
    if (this._single && destination.drag.length>0){
      if (!this._swap) return cancelDragging.call(this,this.dragging.drop); // Back to original location
      const previous = destination.drag.shift();
      d.placeholder.parentElement.insertBefore(previous.node,d.placeholder);
      previous.drop = d.drop;
      if (d.drop) d.drop.drag = [previous,...d.drop.drag.filter(v=>[previous,d].indexOf(v)<0)];
      // TODO: swap styles too
    }
    d.node.style['pointer-events'] = 'unset';
    d.drop = destination;
    destination.drag.push(d);
    if (this._bungee) {
      destination.node.append(d.node);
      d.node.style.position = d.oldStyle.position;
      d.node.style.top = d.oldStyle.top;
      d.node.style.left = d.oldStyle.left;
      d.node.style['margin-left'] = d.oldStyle['margin-left'];
      d.node.style['margin-top'] = d.oldStyle['margin-top'];
    }
    if (destination.offset.x!==undefined) {
      d.node.style['margin-left'] = destination.offset.x;
      d.node.style['margin-top'] = destination.offset.y;
    }
    if (d.placeholder instanceof Node) d.placeholder.remove();
    d.placeholder = undefined;
    this._dragging = null;
    this.dispatchEvent("drop", d, destination);
  }

  this.immediate = function(name,...params){ 
    if (name===undefined) name = "DragDrop";
    [name,...params].forEach(v=>{
      if (typeof(v) !== "string") return;
      this['_initial'+v[0].toUpperCase()+v.substring(1,).toLowerCase()] = true;
    });
  }
  this.uponCreation = async function(r){
    this._bungee = this._initialBungee;
    this._swap = this._initialSwap;
    this._single = this._swap || this._initialSingle;
    this._events = [];
    this.addEventListener("drop", (drag,drop)=>{
      const dragElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==drag.node);
      const dropElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==drop.node);
      this._events.push([
        "Drop",
        dragElement?dragElement._name:drag.node.id||drag.node.className||drag.node.nodeName,
        Date.now(),
        dropElement?dropElement._name:drop.node.id||drop.node.className||drop.node.nodeName,
      ]);
    });
    this._drags = [];
    this._drops = [];
    this._dragging = null;
    this._handlers = {
      mousedown: e=>{
        // First make sure that any element being dragged goes back to its initial location
        cancelDragging.call(this,(this.dragging||{destination:undefined}).drop);
        this._dragging = this._drags.find(v=>v.node===e.target);
        if (this._dragging===undefined) return;
        this._dragging.dragging = true;
        this._dragging.oldStyle = {
          position: this._dragging.node.style.position,
          top: this._dragging.node.style.top, left: this._dragging.node.style.left,
          'margin-left': this._dragging.node.style['margin-left'],
          'margin-top': this._dragging.node.style['margin-top'],
        };
        // Create the placholder before affecting the target node
        this._dragging.placeholder = this._dragging.node.cloneNode(true);
        this._dragging.placeholder.style.visibility = 'hidden';
        // Get the BCR before changing style
        const bcr = e.target.getBoundingClientRect();
        this._dragging.offset = {x: e.pageX - (bcr.left+window.scrollX), y: e.pageY - (bcr.top+window.scrollY)};
        this._dragging.node.style.position = 'absolute';
        this._dragging.node.style.top = bcr.top+window.scrollY;
        this._dragging.node.style.left = bcr.left+window.scrollX;
        this._dragging.node.style['pointer-events'] = 'none';
        // Insert placholder before changing the target node's parent
        this._dragging.node.parentElement.insertBefore(this._dragging.placeholder,this._dragging.node);
        document.documentElement.append(this._dragging.node);
      },
      mousemove: e=>{
        if (this._dragging == null) return;
        if (this._dragging.node instanceof Node) {
          this._dragging.node.style.top = e.pageY - this._dragging.offset.y;
          this._dragging.node.style.left = e.pageX - this._dragging.offset.x;
        }
      },
      mouseup: e=>{
        if (this._dragging == null) return;
        const drop = this._drops.find(v=>v.node===e.target);
        if (drop===undefined) cancelDragging.call(this);
        else dropOn.call(this,this._dragging,drop);
      }
    };
    document.documentElement.addEventListener("mousedown", this._handlers.mousedown);
    document.documentElement.addEventListener("mousemove", this._handlers.mousemove);
    document.documentElement.addEventListener("mouseup", this._handlers.mouseup);
    r();
  }
  this.end = async function(){ 
    document.documentElement.removeEventListener("mousedown", this._handlers.mousedown);
    document.documentElement.removeEventListener("mousemove", this._handlers.mousemove);
    document.documentElement.removeEventListener("mouseup", this._handlers.mouseup);
    if (!this._log || this._events.length==0) return;
    for (let i = 0; i < this._events; i++) this.log(...this.events[i]);
  }
  this.value = async function () { return this._name; }
  this.actions = {
    $addDrag: async function(r,...els) { await addWhatCommand.call(this,'_drags', els); r(); },
    $addDrop: async function(r,...els) { await addWhatCommand.call(this,'_drops', els); r(); },
    $callback: function(r,...c) {
      this.addEventListener("drop", async() => {
        for (let i = 0; i < c.lengths; i++)
          if (c instanceof Function) await c.call();
      });
      r();
    },
    $removeDrag: async function(r,...els){ await removeWhat.call(this,'_drags', els); r(); },
    $removeDrop: async function(r,...els){ await removeWhat.call(this,'_drops', els); r(); },
    $wait: function(r,t) {
      this.addEventListener("drop", async() => {
        if (t===undefined || (await t.call())) r(t=undefined);
      });
    }
  }
  this.settings = {
    bungee: function(r,yes){ this._bungee = (yes===undefined || yes); r(); },
    $offset: async function(r,...args) { 
      const offset = {x:undefined,y:undefined}, drops = [];
      for (let i = 0; i < args.length; i++) {
        const v = args[i];
        if (v instanceof PennEngine.Commands) {
          await v.call();
          v = this._drops.find(w=>(v._element._nodes||{main:undefined}).main===w.node);
        }
        else if (v instanceof Function)
          v = await v.call();
        if (v instanceof Node){
          const d = this._drops.find(w=>w.node==v);
          if (d) drops.push(d);
        }
        else if (typeof(v)=="string"||typeof(v)=="number") {
          if (offset.x===undefined) offset.x = v;
          else if (offset.y===undefined) offset.y = v;
        }
      };
      if (drops.length==0) drops.push(...this._drops);
      if (offset.x!==undefined) drops.forEach(d=>d.offset = {x: offset.x, y: offset.y});
      r();
    },
    single: function(r,yes){ this._single = (yes===undefined || yes); r(); },
    swap: function(r,yes){ this._swap = (yes===undefined || yes); this._single = this._swap || this._single; r(); }
  }
  this.test = {
    $dropped: async function(...args){
      if (args.length==0) return this._drops.find(v=>v.drag.length>0);
      const drags = [], drops = [];
      for (let i = 0; i < args.length; i++){
        let e;
        if (args[i] instanceof PennEngine.Commands){
          await args[i].call();
          e = (args[i]._element._nodes||{main:undefined}).main;
        }
        else if (args[i] instanceof Function)
          e = await args[i].call(this);
        if (!(e instanceof Node)) continue;
        const drag = this._drags.find(v=>v.node==e), drop = this._drops.find(v=>v.node==e);
        if (drag) drags.push(drag);
        else if (drop) drops.push(drop);
      }
      if (drags.length) {
        if (drops.length) // Test whether all passed dragged elements are on one of the passed dropzones
          return drags.map(v=>drops.indexOf(v.drop)>=0).reduce((a,b)=>a&&b);
        else    // Test whether all passed dragged elements have been dropped somewhere
          return drags.map(v=>v.drop!==undefined).reduce((a,b)=>a&&b);
      }
      else if (drops.length)  // Test whether all passed dropzones have at least one element on them
        return drops.map(v=>v.drag.length>0).reduce((a,b)=>a&&b);
      else  // Test whether at least one dropzone has at least one element on it
        return this._drops.find(v=>v.drag.length>0);
    }
  }
});
