window.PennController._AddElementType('Tooltip', function (PennEngine){
  this.immediate = function(name,text,label){ 
    if (text===undefined) text = name;
    this._initialText = text;
    this._initialLabel = label;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    this._text = document.createElement("DIV");
    this._text.innerHTML = this._initialText;
    this._nodes.main.append(this._text);
    this._clicksEnabled = true;
    this._label = document.createElement("DIV");
    this._label.innerHTML = this._initialLabel||"OK";
    this._label.style.width = "fit-content";
    this._label.style.float = "right";
    this._label.addEventListener("click", ()=>this._clicksEnabled && this.dispatchEvent("validate"));
    this.addEventListener("validate", ()=>this._nodes && this._nodes.parent instanceof Node && this._nodes.parent.remove());
    this._keys = undefined;
    document.body.addEventListener("keydown", e=>{
      if (!this._nodes || !(this._nodes.main instanceof Node) || !document.documentElement.contains(this._nodes.main)) return;
      if (this._keys && PennEngine.utils.keyMatch(e,this._keys)>=0) this.dispatchEvent("validate");
    });
    this._prints = [];
    this.addEventListener("print", (...args)=>this._prints.push({date: Date.now(), args: args}) );
    this._position = "bottom right";
    let lastPrint;
    this._refreshDisplay = async (print,initialStyle,lastBCR,lastTarget) => {
      if (print!=lastPrint || this._nodes===undefined || !document.documentElement.contains(this._nodes.parent)) return;
      if (this._label.innerText) {
        if (!this._nodes.main.contains(this._label)) this._nodes.main.append(this._label);
        if (this._clicksEnabled) this._label.style.cursor = "pointer";
        else this._label.style.cursor = "unset";
      }
      else this._label.remove();
      let target = print.find(v=>v instanceof Node);
      if (target===undefined) target = print.find(v=>v instanceof PennEngine.Commands);
      if (target instanceof PennEngine.Commands) target = (target._element._nodes||{main:undefined}).main;
      if (target===undefined) target = print.find(v=>v instanceof Function);
      if (target instanceof Function) target = await target.call();
      if (!(target instanceof Node)) return;
      const targetBCR = target.getBoundingClientRect(), jsonTargetBCR = JSON.stringify(targetBCR);
      if (lastBCR===undefined || lastTarget===undefined || target!=lastTarget || jsonTargetBCR!=lastBCR) {
        lastTarget = target;
        lastBCR = jsonTargetBCR;
        this._nodes.parent.style.position = 'absolute';
        this._nodes.parent.style.overflow = 'visible';
        this._nodes.parent.style.top = targetBCR.top+window.scrollY;
        this._nodes.parent.style.left = targetBCR.left+window.scrollX;
        this._nodes.parent.style.width = targetBCR.width;
        this._nodes.parent.style.height = targetBCR.height;
        document.documentElement.append(this._nodes.parent);
        if (initialStyle===undefined){
          initialStyle = {};
          const style = this._nodes.main.style;
          for (let s of style) initialStyle[s] = style[s];
        }
        this._nodes.main.style.position = 'absolute';
        let transform = [];
        if (this._position.match(/top/i)) transform.push("translateY(-100%)");
        else if (this._position.match(/middle/i)) {
          this._nodes.main.style.top = targetBCR.height/2;
          transform.push("translateY(-50%)");
        }
        else /*(this._position.match(/bottom/i))*/ this._nodes.main.style.top = targetBCR.height;

        if (this._position.match(/left/i)) {
          transform.push("translateX(-100%)");
          this._nodes.main.style.width = targetBCR.left;
        }
        else if (this._position.match(/center/i)) {
          this._nodes.main.style.left = targetBCR.width/2;
          transform.push("translateX(-50%)");
          this._nodes.main.style.width = window.innerWidth;
        }
        else /* (this._position.match(/right/i)) */ {
          this._nodes.main.style.left = targetBCR.width;
          this._nodes.main.style.width = window.innerWidth - targetBCR.right;
        }
        this._nodes.main.style.transform = transform.join(" ");
        this._nodes.main.style['max-width'] = "max-content";
        for (let s in initialStyle) this._nodes.main.style[s] = initialStyle[s];
        if (this._frameStyle){
          this._nodes.parent.style.border = this._frameStyle;
          const w = this._nodes.parent.style['border-width'];
          this._nodes.parent.style['margin-left'] = "-"+w;
          this._nodes.parent.style['margin-top'] = "-"+w;
          this._nodes.parent.style['pointer-events'] = 'none';
          this._nodes.main.style['pointer-events'] = 'initial';
        }
        this._nodes.parent.style.visibility = 'visible';
      }
      window.requestAnimationFrame(()=>this._refreshDisplay(print,initialStyle,lastBCR,lastTarget));
    }
    this.addEventListener("print", async (...args)=>{
      lastPrint = [...args];
      if (args.length==1 && (args[0] instanceof PennEngine.Commands || args[0] instanceof Node)) {
        this._nodes.parent.style.visibility = 'hidden';
        this._refreshDisplay(lastPrint);
      }
      else{
        this._nodes.parent.style.width = "auto";
        if (args.length==0){
          this._nodes.parent.style.position = "static";
          this._nodes.main.style.width = "auto";
          this._nodes.main.style.position = "static";
        }
      }
    });
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    if (!(this._prints instanceof Array) || this._prints.length==0) this.log("Print", "", null, "Never printed");
    for (let i = 0; i < this._prints; i++)
      this.log("Print","NA",this._prints[i].date,encodeURIComponent(this._prints[i].args.join(' ')));
  }
  this.value = async function () { return (this._nodes||{main: {innerText:""}}).main.innerText; }
  this.actions = {
    $wait: async function(r,t){
      let waited = false;
      this.addEventListener("validate",async ()=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        waited = true;
        this.dispatchEvent("waited");
        r();
      });
    }
  }
  this.settings = {
    frame: function(r,style){
      this._frameStyle = style || "dotted 1px grey";
      r();
    },
    key: function(r,keys,noclick){
      if (keys==undefined) keys="";
      this._keys = [keys];
      if (noclick) {
        this._clicksEnabled = false;
        if (!this._initialLabel) this._label.innerText = "";
      }
      r();
    },
    label: function(r,text) { this._label.innerHTML = text; r(); },
    position: function(r,p) { this._position = p; r(); },
    text: function(r,text) { this._text.innerHTML = text; r(); }
  }
  this.test = { }
});
