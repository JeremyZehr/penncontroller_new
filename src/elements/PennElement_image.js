window.PennController._AddElementType('Image', function (PennEngine){
  this.immediate = function(name,path){ 
    if (name===undefined) name = "Image";
    if (path===undefined) path = name;
    this.addResource(path, async (uri) => {
      const image = document.createElement("IMG");
      image.src = uri;
      image.style['width'] = '100%';
      image.style['height'] = '100%';
      await new Promise(r=>image.onload = r);
      return image;
    })
    .then( o => {
      if (this._nodes && this._nodes.main && document.body.contains(this._image)){
        this._image.remove();
        this._nodes.main.append(o);
      }
      this._image = o;
    });
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    if (this._image instanceof Node) this._nodes.main.append(this._image);
    this._log = false;
    this._prints = [];
    this.addEventListener("print", (...args)=>this._prints.push({date: Date.now(), args: args}) );
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    if (!this._prints || this._prints.length==0) this.log("Print", "", null, "Never printed");
    for (let i = 0; i < this._prints; i++)
      this.log("Print","NA",this._prints[i].date,encodeURIComponent(this._prints[i].args.join(' ')));
  }
  this.value = async function () { 
    if (this._image instanceof Node) return this._image.src;
    else return ""; 
  }
  this.actions = {  }
  this.settings = { }
  this.test = { }
});
