window.PennController._AddElementType('Text', function (PennEngine){
  this.immediate = function(name,text){ 
    if (name===undefined) name = "Text";
    if (text===undefined) text = name;
    text = String(text).replace(/(^\s+|\s+$)/g,m=>[...Array(m.length)].map(v=>"&nbsp;").join(''));
    this._initialText = text;
  }
  this.uponCreation = async function(r){
    this._text = this._initialText;
    this._nodes = {main: document.createElement("DIV")};
    this._nodes.main.innerHTML = this._text;
    this._log = false;
    this._prints = [];
    this.addEventListener("print", (...args)=>this._prints.push({date: Date.now(), text: this._text, args: args}) );
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    if (!(this._prints instanceof Array) || this._prints.length==0) this.log("Print", "", null, "Never printed");
    for (let i = 0; i < this._prints.length; i++)
      this.log("Print",this._prints[i].text,this._prints[i].date,this._prints[i].args.join(';'));
  }
  this.value = async function () { return this._text; }
  this.actions = {
    text: function (r,text) {
      this._text = String(text).replace(/(^\s+|\s+$)/g,m=>[...Array(m.length)].map(v=>"&nbsp;").join(''));;
      this._nodes.main.innerHTML = this._text;
      r();
    },
    unfold: async function(r,delay) {
      if (isNaN(delay) || delay<=0) {
        PennEngine.debug.warning("Invalid value for unfold: "+delay);
        await this._commands.print().call();
        r();
        return;
      }
      this._unfolding = true;
      await this._commands.css({visiblity:"hidden","white-space":"nowrap","overflow-x":"hidden"}).print().call();
      const w = this._nodes.main.getBoundingClientRect().width;
      await this._commands.cssContainer("width", w).call();
      await this._commands.css({visiblity: "visible", width: "0em"}).call();
      let that = this, el = this._nodes.main, start;
      window.requestAnimationFrame( function upd(t){
        if (start===undefined) start = t;
        const pct = Math.min((t-start)/delay,1)
        el.style.width = w * pct;
        if (pct<1) window.requestAnimationFrame(upd);
        else{
          that._unfolding = undefined;
          that.dispatchEvent("unfolded");
          return;
        }
      });
      r();
    },
    $wait: async function(r,t){
      if (!this._unfolding) return r(PennEngine.debug.warning("Cannot wait for a non-unfolding Text element"));
      let waited = false;
      this.addEventListener("unfolded", PennEngine.utils.parallel(async ()=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        waited = true;
        this.dispatchEvent("waited");
        r();
      }));
    }
  }
  this.settings = {
    log: function(r){ this._log = true; r(); },
    size: async function(r,s){ await PennEngine.cssCommandOnNode.call(this, 'main', {'font-size': s}); r(); }
  }
  this.test = {
    $text: async function(t){ 
      if (t instanceof PennEngine.Commands){
        await t.call();
        t = await t._element._value;
      }
      else if (t instanceof Function)
        t = await t(this,this._nodes.main.value);
      else
        t = this._text.match(t);
      return t;
    }
  }
});
