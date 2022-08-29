window.PennController._AddElementType('DropDown', function (PennEngine){

  this.immediate = function(name,defaultText){ 
    if (name===undefined) name = "DropDown";
    if (defaultText===undefined) defaultText = name;
    this._initialDefaultText = defaultText;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("SELECT")};
    if (this._initialDefaultText){
      const option = document.createElement("OPTION");
      option.innerText = this._initialDefaultText;
      option.selected = true;
      option.disabled = true;
      option.hidden = true;
      this._nodes.main.append(option);
    }
    this._nodes.main.addEventListener("change", ()=>this.dispatchEvent("select"));
    r();
  }
  this.end = async function(){ 
    if (!this._log || this._events.length==0) return;
    for (let i = 0; i < this._events; i++) this.log(...this.events[i]);
  }
  this.value = async function () { 
    if (this._nodes && this._nodes.main instanceof Node)
      return (this._nodes.main.selectedOptions[0]||{value:""}).value;
    else return "";
  }
  this.actions = {
    add: function(r,...options) {
      options.forEach(o=>{
        const option = document.createElement("OPTION");
        option.innerText = o;
        option.value = o;
        this._nodes.main.append(option);
      });
      r();
    },
    $callback: function(r,...c) {
      this.addEventListener("select", async ()=>{
        for (let i = 0; i < c.length; i++)
          if (c[i] instanceof Function) await c[i].call(PennEngine.trials.current,this._nodes.main.selectedOptions[0]);
      });
      r();
    },
    remove: function(r,...options) {
      [...this._nodes.main.children].forEach(o=>{
        if (options.indexOf(o.value)<0) return;
        o.remove();
      });
      r();
    },
    select: function(r,option){
      option = [...this._nodes.main.children].findIndex(o=>o.innerText==option);
      if (option<0) return r();
      this._nodes.main.selectedIndex = option;
      this.dispatchEvent("select");
      r();
    },
    shuffle: function(r,keepSelected){
      const options = [...this._nodes.main.children];
      window.fisherYates(options);  // fisherYates is defined by IBEX
      options.forEach(o=>this._nodes.main.append(o));
      if (keepSelected===undefined && !keepSelected)
        this._nodes.main.selectedIndex = (this._initialDefaultText?options.findIndex(o=>o.disabled):-1);
      r();
    },
    $wait: function(r,t) {
      let waited = false;
      this.addEventListener("select", async() => {
        if (waited || t===undefined || !(await t.call())) return;
         r(waited=true);
         this.dispatchEvent("waited");
      });
    }
  }
  this.test = {
    selected: async function(option){
      if (option===undefined) return this._nodes.main.selectedIndex>=0;
      option = [...this._nodes.main.children].find(o=>o.innerText==option);
      return (option||{selected:false}).selected;
    }
  }
});
