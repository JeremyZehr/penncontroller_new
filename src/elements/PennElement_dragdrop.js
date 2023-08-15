/**
 * The DragDrop element lets you make some elements draggable and turn some elements into drop zones.
 * @namespace DragDrop
 */
window.PennController._AddElementType('DragDrop', function (PennEngine){

  const pauseEvent = e=>{
    if(e.stopPropagation) e.stopPropagation();
    if(e.preventDefault) e.preventDefault();
    e.cancelBubble=true;
    e.returnValue=false;
    return false;
  }
  const nodeAtXY = (n,x,y) => {
    const bcr = n.getBoundingClientRect();
    return bcr.left<=x && x<=bcr.right && bcr.top<=y && y<=bcr.bottom;
  }
  const trialElementMatchingNode = node => {
    const elements = PennEngine.trials.current._elements;
    const dummy = document.createElement("DIV");
    for (let i=0; i<elements.length; i++){
      const n = (elements[i]._nodes||{main:dummy}).main;
      if (n===node) return elements[i];
    }
    return undefined;
  }
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
      d.offset = {x: this._offset.x, y: this._offset.y};
      // Need to turn position to relative to properly place the dropped elements
      if (node instanceof Node && document.body.contains(node) && !{absolute:1,relative:1}[node.style.position])
        node.style.position = "relative";
    }
    this[what].push(d);
    return d;
  }
  const addWhatCommand = async function(what, els) {  // what in ['_drags','_drops']
    for (let i = 0; i < els.length; i++){
      if (els[i] instanceof PennEngine.Commands){
        await els[i].call();
        const node = (els[i]._element._nodes||{main: undefined}).main;
        if (node===undefined) els[i]._element.addEventListener("print", ()=>PennEngine.utils.parallel(addWhat.call(this,what,els[i]._element._nodes.main)));
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
    // const dragElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==d.node);
    const dragElement = trialElementMatchingNode(d.node);
    if (dragElement===undefined) return;
    this._events.push(["Cancel",dragElement?dragElement._name:d.node.id||d.node.className||d.node.nodeName,Date.now()]);
    d.dragging = false;
    d.node.style['pointer-events'] = 'unset';
    if (d.placeholder instanceof Node){
      if (this._bungee) {
        d.placeholder.parentElement.insertBefore(d.node,d.placeholder);
        d.node.style.position = d.oldStyle.position;
        d.node.style.top = d.oldStyle.top;
        d.node.style.left = d.oldStyle.left;
        d.node.style['margin-left'] = d.oldStyle['margin-left'];
        d.node.style['margin-top'] = d.oldStyle['margin-top'];
      }
      d.placeholder.remove();
      d.placeholder = undefined;
    }
    d.drop = destination;
    this._dragging = null;
  }
  const dropOn = function(d,destination) {
    d.dragging = false;
    if (this._single && destination.drag.length>0){
      if (!this._swap || destination.drag.indexOf(d)>=0) 
        return cancelDragging.call(this,this._dragging.drop); // Back to original location
      const alreadyAtDestination = destination.drag.shift();
      d.placeholder.parentElement.insertBefore(alreadyAtDestination.node,d.placeholder);
      alreadyAtDestination.drop = d.drop;
      if (d.drop) d.drop.drag.push(alreadyAtDestination);
      const styleAttributes = ['display','position','top','left'];
      styleAttributes.forEach(s=>alreadyAtDestination.node.style[s]=d.oldStyle[s]||'unset');
      const alreadyAtDestinationStyle = styleAttributes.map(s=>alreadyAtDestination.node.style[s]||'unset');
      styleAttributes.forEach(s => d.node.style[s] = alreadyAtDestinationStyle[s]);
    }
    d.node.style['pointer-events'] = 'unset';
    if (d.drop && d.drop.drag) d.drop.drag = d.drop.drag.filter(v=>v.node != d.node);
    d.drop = destination;
    destination.drag.push(d);
    // if (this._bungee) {
    //   destination.node.append(d.node);
    //   d.node.style.position = d.oldStyle.position;
    //   d.node.style.top = d.oldStyle.top;
    //   d.node.style.left = d.oldStyle.left;
    //   d.node.style['margin-left'] = d.oldStyle['margin-left'];
    //   d.node.style['margin-top'] = d.oldStyle['margin-top'];
    // }
    const dragBCR = d.node.getBoundingClientRect(), destinationBCR = destination.node.getBoundingClientRect();
    destination.node.append(d.node);
    d.node.style.position = 'absolute';
    d.node.style.left = destination.offset.x!==undefined ? destination.offset.x : dragBCR.x - destinationBCR.x;
    d.node.style.top = destination.offset.y!==undefined ? destination.offset.y : dragBCR.y - destinationBCR.y;
    // d.node.style.top = 'unset';
    // d.node.style.left = 'unset';
    // d.node.style.position = "static";
    // if (destination.offset.x!==undefined) {
    //   d.node.style['margin-left'] = destination.offset.x;
    //   d.node.style['margin-top'] = destination.offset.y;
    // }
    // else {
    //   d.node.style['margin-left'] = dragBCR.x-destinationBCR.x;
    //   d.node.style['margin-top'] = dragBCR.y-destinationBCR.y;
    // }
    if (d.placeholder instanceof Node) d.placeholder.remove();
    d.placeholder = undefined;
    this._dragging = null;
    this.dispatchEvent("drop", d, destination);
  }

  /**
   * Creates a new Canvas element of the specified dimensions
   * @function newDragDrop
   * @param {string} [name] - The name of the element
   * @param {string} [bungee] - Passing `"bungee"` will make dragged elements go back to their initial position when dropped out of a drop zone
   * @param {string} [single] - Passing `"single"` will only allow one element per drop zone
   * @param {string} [swap] - Passing `"swap"` will make an element dragged onto an occupied drop zone switch its place with the other element
   * @example
   * // Creates a DragDrop element named "dd" with two draggable elements and two drop zones.
   * // Elements dropped out of a drop zone will go back to their start position (bungee)
   * // Dropping one element on a zone occupied by the other element will make them switch their positions (swap)
   * newDragDrop("dd", "bungee", "swap")
   *   .addDrag( newText("Cat").print() , newText("Dog").print() )
   *   .addDrop(
   *       newCanvas("like",100,100).color("cyan").add(25, 25, "Like").print(),
   *       newCanvas("dislike",100,100).color("pink").add(25, 25, "Dislike").print(),
   *   )
   * @global
   * @see DragDrop
   */
  this.immediate = function(name,...params){ 
    if (name===undefined) name = "DragDrop";
    for (let v of [name,...params]) {
      if (typeof(v) !== "string") continue;
      this['_initial'+v[0].toUpperCase()+v.substring(1,).toLowerCase()] = true;
    };
  }
  this.uponCreation = async function(r){
    this._bungee = this._initialBungee;
    this._swap = this._initialSwap;
    this._single = this._swap || this._initialSingle;
    this._offset = {x: undefined, x: undefined};
    this._events = [];
    this.addEventListener("drop", (drag,drop)=>{
      if (this._disabled) return;
      // const dragElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==drag.node);
      // const dropElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==drop.node);
      const dragElement = trialElementMatchingNode(drag.node);
      const dropElement = trialElementMatchingNode(drop.node);
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
        if (this._dragging) cancelDragging.call(this,(this._dragging||{destination:undefined}).drop);
        if (this._disabled) return;
        this._dragging = this._drags.find(v=>nodeAtXY(v.node,e.clientX,e.clientY));
        // this._dragging = this._drags.find(v=>v.node===e.target);
        if (this._dragging===undefined) return;
        const node = this._dragging.node;
        const dragElement = PennEngine.trials.current._elements.find(e=>(e._nodes||{main:undefined}).main==node);
        this._events.push(["Drag",dragElement?dragElement._name:node.id||node.className||node.nodeName,Date.now()]);
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
        const bcr = node.getBoundingClientRect(), scrollX = window.scrollX, scrollY = window.scrollY;
        this._dragging.offset = {x: e.pageX - (bcr.left+scrollX), y: e.pageY - (bcr.top+scrollY)};
        this._dragging.node.style.position = 'absolute';
        this._dragging.node.style.top = bcr.top+scrollY;
        this._dragging.node.style.left = bcr.left+scrollX;
        this._dragging.node.style.margin = 0;
        this._dragging.node.style['pointer-events'] = 'none';
        // Insert placholder before changing the target node's parent
        this._dragging.node.parentElement.insertBefore(this._dragging.placeholder,this._dragging.node);
        document.documentElement.append(this._dragging.node);
        // prevent selection
        return pauseEvent(e);
      },
      mousemove: e=>{
        if (this._disabled || this._dragging == null) return;
        if (this._dragging.node instanceof Node) {
          this._dragging.node.style.top = e.pageY - this._dragging.offset.y;
          this._dragging.node.style.left = e.pageX - this._dragging.offset.x;
          // prevent selection
          return pauseEvent(e);
        }
      },
      mouseup: e=>{
        if (this._disabled || this._dragging == null) return;
        // const drop = this._drops.find(v=>v.node===e.target);
        const drop = this._drops.find(v=>nodeAtXY(v.node,e.clientX,e.clientY));
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
    if (this._handlers){
      document.documentElement.removeEventListener("mousedown", this._handlers.mousedown);
      document.documentElement.removeEventListener("mousemove", this._handlers.mousemove);
      document.documentElement.removeEventListener("mouseup", this._handlers.mouseup);
    }
    if (!this._log || !this._events || this._events.length==0) return;
    /**
     * @summary Adds a line to the results file for dragging, dropping and cancel events.
     * @description
     * The timestamp for a dragging event reports when dragging _started_. 
     * The timestamp for a dropping event reports when the element was dropped (when dragging successfully _ended_).
     * The timestamp for a cancel event reports when the dragging _stopped_ without the element being dropped onto a valid target.
     * @example
     * newDragDrop("dd")
     *   .addDrag(newText("Drag me!").print())
     *   .addDrop(newCanvas("dropzone",100,100).color('red').print())
     *   .log()
     *   .wait()
     * // ...,PennElementName,PennElementType,Parameter,Value,EventTime,Comments
     * // ...,dd,DragDrop,Drag,Drag me!,1688484998953,NULL
     * // ...,dd,DragDrop,Cancel,Drag me!,1688484999557,NULL
     * // ...,dd,DragDrop,Drag,Drag me!,1688485001842,NULL
     * // ...,dd,DragDrop,Drop,Drag me!,1688485002393,dropzone
     * @function log
     * @memberof DragDrop
     * @instance
     */
    for (let e of this._events) this.log(...e);
  }
  this.value = async function () { return this._name; }
  this.actions = {
    /**
     * Makes one or more elements draggable
     * @function addDrag
     * @param  {Element} element - An element to make draggable
     * @param  {...Element} [element] - More elements to make draggable
     * @example
     * // (Prints and) makes the Text elements "Cat" and "Dog" draggable
     * newDragDrop("dd")
     *   .addDrag( newText("Cat").print() , newText("Dog").print() )
     *   .addDrop(
     *       newCanvas("like",100,100).color("cyan").add(25, 25, "Like").print(),
     *       newCanvas("dislike",100,100).color("pink").add(25, 25, "Dislike").print(),
     *   )
     * @memberof DragDrop
     * @instance
     */
    $addDrag: async function(r,...els) { await addWhatCommand.call(this,'_drags', els); r(); },
    /**
     * Turns one or more elements into drop zones
     * @function addDrag
     * @param  {Element} element - An element to turn into a drop zone
     * @param  {...Element} [element] - More elements to turn into drop zones
     * @example
     * // (Prints and) turns the Canvas elements "like" and "dislike" into drop zones
     * newDragDrop("dd")
     *   .addDrag( newText("Cat").print() , newText("Dog").print() )
     *   .addDrop(
     *       newCanvas("like",100,100).color("cyan").add(25, 25, "Like").print(),
     *       newCanvas("dislike",100,100).color("pink").add(25, 25, "Dislike").print(),
     *   )
     * @memberof DragDrop
     * @instance
     */
    $addDrop: async function(r,...els) { await addWhatCommand.call(this,'_drops', els); r(); },
    /**
     * Executes commands/functions when an element is dropped into a drop zone
     * @function callback
     * @param  {Command} command - The command (or function) to execute upon dropping
     * @param  {...Command} [commands] - More commands/functions to execute
     * @example
     * // Will turn the canvas pink when the text is dropped on it
     * newDragDrop("dd")
     *   .addDrag( newText("Drop me!").print() )
     *   .addDrop( newCanvas("dropzone",100,100).color("cyan").add(0,0,"Drop here!").print() )
     *   .callback( getCanvas("dropzone").color("pink") )
     * @memberof DragDrop
     * @instance
     */
    $callback: function(r,...cs) {
      this.addEventListener("drop", PennEngine.utils.parallel(async() => {
        if (this._disabled) return;
        for (let c of cs)
          if (c instanceof Function) await c.call();
      }));
      r();
    },
    /**
     * @summary Programmatically drops an element into a drop zone.
     * @description
     * The order of the references does not matter: the command will automatically determine which is the drop zone.
     * @function drop
     * @param  {Element} element1 - The element to drop or the drop zone
     * @param  {Element} element2 - The element to drop or the drop zone
     * @example
     * // Immediately drops the text at 20*20px in the canvas
     * newDragDrop("dd")
     *   .addDrag( newText("Drop me!").print() )
     *   .addDrop( newCanvas("dropzone", 100,100).color("cyan").add(0,0,"Drop here").print() )
     *   .offset(20,20)
     *   .drop( getText("Drop me!") , getCanvas("dropzone") )
     * @memberof DragDrop
     * @instance
     */
    $drop: async function(r,x,y){
      const drag = this._drags.find(v=>[x,y].find(z=>(z instanceof PennEngine.Commands&&(z._element._nodes||{main:0}).main==v.node)));
      const drop = this._drops.find(v=>[x,y].find(z=>(z instanceof PennEngine.Commands&&(z._element._nodes||{main:0}).main==v.node)));
      if (drag && drop) dropOn.call(this,drag,drop);
      r();
    },
    /**
     * @summary Makes one or more elements no longer draggable
     * @function removeDrag
     * @param  {Element} element - An element to make non-draggable
     * @param  {...Element} [element] - More elements to make non-draggable
     * @example
     * // Makes the element that was just dropped no longer draggable
     * newDragDrop("dd")
     *   .addDrag( newText("A").print() , newText("B").print() )
     *   .addDrop( newCanvas("dropzone", 100,100).color("cyan").print() )
     *   .wait()
     *   .test.dropped( getText("A") )
     *   .success( self.removeDrag(getText("A")) )
     *   .failure( self.removeDrag(getText("B")) )
     * @memberof DragDrop
     * @instance
     */
    $removeDrag: async function(r,...els){ await removeWhat.call(this,'_drags', els); r(); },
    /**
     * @summary Turns one or more elements back into not being dropzones
     * @function removeDrop
     * @param  {Element} element - An element to turn back into a non-dropzone
     * @param  {...Element} [element] - More elements to turn into non-dropzones
     * @example
     * // Makes the canvas that was just dropped into no longer a dropzone
     * newDragDrop("dd", "bungee")
     *   .addDrag( newText("A").print() , newText("B").print() )
     *   .addDrop( 
     *     newCanvas("dropzone1", 100,100).color("cyan").print(),
     *     newCanvas("dropzone2", 100,100).color("pink").print() 
     *   )
     *   .wait()
     *   .test.dropped( getCanvas("dropzone1") )
     *   .success( self.removeDrop(getCanvas("dropzone1")) )
     *   .failure( self.removeDrop(getCanvas("dropzone2")) )
     * @memberof DragDrop
     * @instance
     */
    $removeDrop: async function(r,...els){ await removeWhat.call(this,'_drops', els); r(); },
     /**
     * Halts the script until an element is dropped into a dropzone
     * @function wait 
     * @param  {Command} [test] - Resumes the script only if the test is successful
     * @example
     * // Halts the script until "A" is in canvas 1 and "B" in canvas 2
     * newDragDrop("dd", "bungee")
     *  .addDrag( newText("A").print() , newText("B").print() )
     *  .addDrop( 
     *      newCanvas("dropzone1", 100,100).color("cyan").print(),
     *      newCanvas("dropzone2", 100,100).color("pink").print() 
     *  )
     *  .wait(
     *      self.test.dropped(getText("A"),getCanvas("dropzone1"))
     *      .and( self.test.dropped(getText("B"),getCanvas("dropzone2")) )
     *      .failure( newText("Keep trying").print() )
     *  )
     * @memberof DragDrop
     * @instance
     */
    $wait: function(r,t) {
      this.addEventListener("drop", PennEngine.utils.parallel(async() => {
        if (this._disabled) return;
        if (t===undefined || (await t.call())) r(t=undefined);
      }));
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
      if (drops.length==0) {
        drops.push(...this._drops);
        this._offset.x = offset.x;
        this._offset.y = offset.y===undefined?offset.x:offset.y;
      }
      if (offset.x!==undefined) {
        if (offset.y===undefined) offset.y = offset.x;
        drops.forEach(d=>d.offset = {x: offset.x, y: offset.y});
      }
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
