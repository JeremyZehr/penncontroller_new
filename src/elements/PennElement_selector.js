window.PennController._AddElementType('Selector', function (PennEngine){
  this.immediate = function(name){
    if (PennEngine.trials.running) PennEngine.debug.error("Cannot dynamically create a Selector element");
    if (name===undefined) name = "Selector";
    this._trial = PennEngine.trials.current;
    this._prints = new Map();
    const listenToPrints = ()=>{
      if (PennEngine.trials.current != this._trial)
        this._trial._elements.forEach(e=>e.addEventListener("print",(...args)=>this._prints.set(e,args)));
      else window.requestAnimationFrame(listenToPrints);
    }
    listenToPrints();
  }
  this.uponCreation = async function(r){
    this._events = [];
    this._clicksEnabled = true;
    this._elements = [];
    this._keys = [];
    this._selectedElement = undefined;
    this._clickHandler = e=>{
      if (!this._clicksEnabled) return;
      const element = this._elements.find(el=>e.target==(el._nodes||{main:undefined}).main);
      if (element===undefined) return;
      this.dispatchEvent("select", element);
    };
    document.body.addEventListener("click", this._clickHandler);
    this._keyHandler = e=>{
      const idx = PennEngine.utils.keyMatch(e,this._keys);
      if (idx<0 || idx>this._elements.length) return;
      this.dispatchEvent("select", this._elements[idx]);
    }
    document.body.addEventListener("keydown", this._keyHandler);
    let hoveredElement, oldCursor;
    this._mouseMoveListener = e=>{
      if (hoveredElement===undefined && this._clicksEnabled) {
        const element = this._elements.find(el=>e.target==(el._nodes||{main:undefined}).main);
        if (element===undefined) return;
        hoveredElement = element;
        oldCursor = hoveredElement._nodes.main.style.cursor;
        hoveredElement._nodes.main.style.cursor = "pointer";
      }
      else if (!this._clicksEnabled || e.target != hoveredElement._nodes.main){
        if (hoveredElement) hoveredElement._nodes.main.style.cursor = oldCursor;
        hoveredElement = undefined;
      }
    }
    document.body.addEventListener("mousemove", this._mouseMoveListener);
    this.addEventListener("select", e=>{
      this._selectedElement = e;
      this._events.push("Select", e._name, Date.now());
      this._elements.forEach(e=>e._nodes.main.classList.remove("selected"));
      e._nodes.main.classList.add("selected");
    });
    this.addEventListener("unselect", e=>{
      this._selectedElement = undefined;
      this._events.push("Unselect", e._name, Date.now());
      e._nodes.main.classList.remove("selected");
    });
    r();
  }
  this.end = async function(){ 
    if (this._frame instanceof Node) this._frame.remove();
    document.body.removeEventListener("click", this._clickHandler);
    document.body.removeEventListener("mousemove", this._mouseMoveListener);
    document.body.removeEventListener("keydown", this._keyHandler);
    if (!this._log) return;
    this._events.forEach(e=>this.log(...e));
  }
  this.value = async function () { 
    if (!(this._selectedElement instanceof PennEngine.Element)) return;
    const v = this._selectedElement.value;
    return v;
  }
  this.actions = {
    $add: async function(r,...c){
      for (let i=0; i < c.length; i++)
        if (c[i] instanceof PennEngine.Commands){
          await c[i].call();
          const element = c[i]._element;
          if (!this._elements.find(el=>el===element)) this._elements.push(element);
        }
      r();
    },
    $callback: async function(r,...c) {
      this.addEventListener("select", async ()=>{
        for (let i=0; i < c.length; i++)
          if (c[i] instanceof Function) await c[i].call();
      });
      r();
    },
    $remove: async function(r,...c) {
      if (c.length>0) {
        const cs = c.filter(cm=>cm instanceof PennEngine.Commands).map(cm=>cm._element);
        for (let i=0; i < this._elements.length; i++){
          if (cs.indexOf(this._elements[i])<0) continue;
          this._keys.splice(i,1);
          this._elements.splice(i,1);
        }
      }
      else if (this._nodes)
        for (let n in this._nodes) this._nodes[n].remove();
    },
    $select: async function(r,c) {
      if (!(c instanceof PennEngine.Commands)) return r();;
      await c.call();
      const element = this._elements.find(el=>c._element==el);
      if (element===undefined) return r();
      this.dispatchEvent("select", element);
    },
    unselect: async function(r) {
      if (this._selectedElement) this.dispatchEvent("unselect", this._selectedElement);
      r();
    },
    $wait: async function(r,t){
      let waited = false;
      this.addEventListener("select",async ()=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        waited = true;
        this.dispatchEvent("waited");
        r();
      });
    }
  }
  this.settings = {
    disableClicks: function(r){ r(this._clicksEnabled = false); },
    enableClicks: function(r){ r(this._clicksEnabled = true); },
    frame: function(r,style){
      this.addEventListener("select", e=>{
        if (this._frame instanceof Node) this._frame.remove();
        this._frame = document.createElement("DIV");
        this._frame.style.position = 'absolute';
        const bcr = e._nodes.main.getBoundingClientRect();
        this._frame.style.width = bcr.width;
        this._frame.style.height = bcr.height;
        this._frame.style.border = style;
        const w = this._frame.style['border-width'];
        this._frame.style['margin-left'] = "-"+w;
        this._frame.style['margin-top'] = "-"+w;
        this._frame.style['pointer-events'] = 'none';
        e._nodes.main.append(this._frame);
      });
      this.addEventListener("unselect", e=>this._frame instanceof Node && this._frame.remove());
      r();
    },
    keys: function(r,...keys){ r(this._keys = keys); },
    $shuffle: async function(r,...refs) {
      for (let i=0; i < refs.length; i++)
        if (refs[i] instanceof PennEngine.Commands){
          await refs[i].call();
          const idx = this._elements.findIndex(el=>el==refs[i]._element);
          if (idx>=0) refs[i] = idx;
        }
        else if (refs[i] instanceof Function)
          refs[i] = await refs[i].call();
      if (refs.length==0) refs = this._elements.map((v,i)=>i);
      refs = refs.filter( n => !isNaN(n) && n >= 0 && n < this._elements.length );
      let shuffledIndices = [...refs];
      window.fisherYates(shuffledIndices);
      const copyElements = [...this._elements], printCommands = [];
      refs.forEach( (idx,i) => {
        const original = copyElements[idx], replacer = copyElements[shuffledIndices[i]];
        this._elements[idx] = replacer;
        if (original._nodes && document.body.contains(original._nodes.main))
          printCommands.push({toPrint:replacer,args:[...this._prints.get(original)]});
      });
      refs.forEach( idx => {
        const nodes = this._elements[idx]._nodes;
        if (nodes.parent instanceof Node) nodes.parent.remove();
        else if (nodes.main instanceof Node) nodes.main.remove();
      });
      for (let i=0; i<printCommands.length; i++){
        const commandRef = printCommands[i].toPrint._commands, printArgs = printCommands[i].args;
        for (let n=0; n<printArgs.length; n++){
          if (!(printArgs[n] instanceof PennEngine.Commands)) continue;
          const ref = this._elements.indexOf(printArgs[n]._element);
          if (ref>=0) {
            const indexInShuffledIndices = shuffledIndices.indexOf(ref);
            if (indexInShuffledIndices>=0) printArgs[n] = this._elements[refs[indexInShuffledIndices]]._commands;
          }
        }
        await commandRef.print(...printArgs).call();
      }
      r();
    }
  }
  this.test = {
    $index: function(elementRef,index){
      if (!(elementRef instanceof PennEngine.Commands)) return this._elements.length>0;
      else if (index===undefined) return this._elements.find(e=>e==elementRef._element);
      else return index===this._elements.findIndex(e=>e==elementRef._element);
    },
    $selected: function(elementRef){
      if (!(elementRef instanceof PennEngine.Commands)) return this._selectedElement!==undefined;
      return this._selectedElement == elementRef._element;
    }
  }

  PennEngine.Commands.prototype.selector = function(s){
    if (typeof(s)==="string") s = getSelector(s);
    this._sequence.push( ()=>{
      if (s._element._elements===undefined) 
        PennEngine.debug.error(`Trying to add ${this.toString()} to ${s._element._name} before newSelector`);
      return s.add(this._element._commands).call() 
    });
    return this;
  }
});
