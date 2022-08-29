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
      if (!this._nodes || !(this._nodes.main instanceof Node) || !document.body.contains(this._nodes.main)) return;
      if (this._keys && PennEngine.utils.keyMatch(e,this._keys)>=0) this.dispatchEvent("validate");
    });
    this._prints = [];
    this._position = "bottom right";
    this._refreshDisplay = token => {
      if (token!=lastPrint || this._nodes===undefined || !document.body.contains(this._nodes.parent)) return;
      if (this._label.innerText) {
        if (!this._nodes.main.contains(this._label)) this._nodes.main.append(this._label);
        if (this._clicksEnabled) this._label.style.cursor = "pointer";
        else this._label.style.cursor = "unset";
      }
      else this._label.remove();
      const parent = this._nodes.parent.parentElement, parentBCR = parent.getBoundingClientRect();
      if (parent.children[0]!==this._nodes.parent) parent.prepend(this._nodes.parent);
      this._nodes.parent.style.top = "unset";
      this._nodes.parent.style.left = "unset";
      let transform = [];
      if (this._position.match(/bottom/i)) this._nodes.main.style.top = parentBCR.height;
      else if (this._position.match(/top/i)) transform.push("translateY(-100%)");
      else if (this._position.match(/middle/i)) {
        this._nodes.main.style.top = parentBCR.height/2;
        transform.push("translateY(-50%)");
      }
      if (this._position.match(/right/i)) this._nodes.main.style.left = parentBCR.width;
      else if (this._position.match(/left/i)) transform.push("translateX(-100%)");
      else if (this._position.match(/center/i)) {
        this._nodes.main.style.left = parentBCR.width/2;
        transform.push("translateX(-50%)");
      }
      this._nodes.main.style.transform = transform.join(" ");
      window.requestAnimationFrame(()=>this._refreshDisplay(token));
    }
    let lastPrint;
    this.addEventListener("print", async (...args)=>{
      lastPrint = {};
      if (args.length==1 && (args[0] instanceof PennEngine.Commands || args[0] instanceof Node)) {
        this._nodes.parent.style.width = 0;
        this._nodes.parent.style.position = 'relative';
        this._nodes.main.style.width = "max-content";
        this._nodes.main.style.position = 'absolute';
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
    if (this._prints.length==0) this.log("Print", "", null, "Never printed");
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
    key: function(r,keys,noclick){
      if (keys==undefined) return r();
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
