window.PennController._AddElementType('Canvas', function (PennEngine){
  this.immediate = function(name,w,h){ 
    if (h===undefined && typeof(name)=="number"){ h = w; w = name; }
    if (name===undefined || typeof(name)=="number") name = "Canvas";
    this._originalWidth = w;
    this._originalHeight = h;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    this._nodes.main.style.width = this._originalWidth;
    this._nodes.main.style.height = this._originalHeight;
    this._prints = [];
    this.addEventListener("print", (...args)=>this._prints.push({date: Date.now(), args: args}) );
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    if (!this._prints || this._prints.length==0) this.log("Print", "", null, "Never printed");
    for (let i=0; i<this._prints.length; i++)
      this.log("Print",this._prints[i].text,this._prints[i].date,encodeURIComponent(this._prints[i].args.join(' ')));
  }
  this.value = async function () { return this._name; }
  this.settings = {
    $add: async function(r,x,y,e) {
      if (y===undefined && e===undefined) e = x;
      if (e instanceof PennEngine.Commands) await e.print(x,y,this._commands).call();
      else {
        if (e instanceof Function) e = await e.call();
        if (!(e instanceof Node)) { const t = e; e = document.createElement("SPAN"); e.append(t); }
        if (x && y) PennEngine.applyCoordinates(x,y,e,this._nodes.main);
        else this._nodes.main.append(e);
      }
      r();
    },
    color: function(r,c){ 
      if (this._nodes && this._nodes.main instanceof Node) this._nodes.main.style['background-color']=c;
      else this.addEventListener("print",()=>this._nodes.main.style['background-color']=c);
      r();
    }
  }
});
