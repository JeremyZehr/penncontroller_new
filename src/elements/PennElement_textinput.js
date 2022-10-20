window.PennController._AddElementType('TextInput', function (PennEngine){
  this.immediate = function(name,text){ 
    if (name===undefined) name = "TextInput";
    if (text===undefined) text = name;
    this._initialText = text;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("TEXTAREA")};
    this._nodes.main.value = this._initialText;
    this._log = false;
    this._values = [];
    this._lines = 1;
    this._firstKeypress = undefined;
    this._lastKeypress = undefined;
    let keydownAfterPrint = false; // Prevent keypresses from adding characters when started before printing
    ['change','keydown','keypress','keyup'].forEach(t=>this._nodes.main.addEventListener(t,e=>{
      if (t=="keypress" && !keydownAfterPrint) return e.preventDefault();
      else if (t=="keydown") keydownAfterPrint = true;
      if (this._lines<=0) return;
      if (this._firstKeypress===undefined) this._firstKeypress = {key:e.key,time:Date.now()};
      this._lastKeypress = {key:e.key,time:Date.now()};
      const lineCount = this._nodes.main.value.split('\n').length;
      if (e.key=="Enter" && lineCount >= this._lines) e.preventDefault();
    }));
    this._nodes.main.addEventListener('paste', e=>{
      e.preventDefault();
      let paste = (e.clipboardData || window.clipboardData).getData('text');
      const field = this._nodes.main, start = field.selectionStart, end = field.selectionEnd;
      const left = field.value.substring(0,start),
            right = field.value.substring(end,);
      const lineCountLeft = left.split('\n').length - 1,
            lineCountPaste = paste.split('\n').length,
            lineCountRight = right.split('\n').length - 1,
            lineCount = lineCountLeft+lineCountPaste+lineCountRight;
      if (this._lines>0 && lineCount>this._lines) 
        paste = paste.split('\n',this._lines-(lineCountLeft+lineCountRight)).join("\n");
      field.value = left+paste+right;
      field.setSelectionRange(start+paste.length,start+paste.length);
    });
    this._validateEvents = [];
    this.addEventListener("waited", ()=>this._validateEvents.push({text: this._nodes.main.innerText, time: Date.now()}));
    this.addEventListener("print", ()=>(keydownAfterPrint=false) || this._nodes.main.focus());
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    const strLog = (this._log instanceof Array?this._log:["final"]).filter(s=>typeof(s)=="string").map(s=>s.toLowerCase());
    if (strLog.indexOf("first")>=0 && this._firstKeypress)
      this.log("FirstKeyPress", encodeURIComponent(this._firstKeypress.key), this._firstKeypress.time);
    if (strLog.indexOf("last")>=0 && this._lastKeypress)
      this.log("LastKeyPress", encodeURIComponent(this._lastKeypress.key), this._lastKeypress.time);
    if (strLog.indexOf("validate")>=0 && this._validateEvents instanceof Array && this._validateEvents.length)
      this._validateEvents.forEach( e => this.log("Validate", encodeURIComponent(e.text), e.time) );
    if (strLog.indexOf("final")>=0) this.log("Value", encodeURIComponent(this._nodes.main.value), Date.now());
  }
  this.value = async function () { return (this._nodes||{main:{}}).main.value; }
  this.actions = {
    text: function (r,text) { r(this._nodes.main.value = text); },
    $wait: function(r,t) { 
      this._nodes.main.addEventListener('keydown',async e=>{
        if (e.key != "Enter") return true;
        if (t instanceof Function && !(await t.call())) return true;
        this.dispatchEvent("waited");
        r(t=undefined);
      });
    },
  }
  this.settings = {
    length: function(r,n=0) { 
      if (isNaN(parseInt(n))) throw new Error("TextInput length is not a number: "+n);
      if (n<=0) this._nodes.main.removeAttribute("maxlength");
      else this._nodes.main.maxlength = parseInt(n);
      r();
    },
    lines: function(r,n=0) {
      if (isNaN(parseInt(n))) throw new Error("TextInput lines is not a number: "+n);
      this._lines = parseInt(n);
      if (this._lines <= 0) this._nodes.main.removeAttribute("rows");
      else this._nodes.main.rows = this._lines;
      r();
    },
    log: function(r,...whats){ 
      if (whats.length==0) this._log = true; 
      else this._log = whats;
      r(); 
    },
    once: function(r){ this.addEventListener("waited", ()=>this._nodes.main.disabled=true); r(); }
  }
  this.test = {
    $text: async function(t){ 
      if (t instanceof PennEngine.Commands){ await t.call(); t = await t._element._value; }
      else if (t instanceof Function) t = await t.call(this,this._nodes.main.value);
      else t = this._nodes.main.value.match(t);
      return t;
    }
  }
});
