window.PennController._AddElementType('Button', function (PennEngine){
  this.immediate = function(name,text){ 
    if (name===undefined) name = "Button";
    if (text===undefined) text = name;
    this._initialText = text;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("BUTTON")};
    this._nodes.main.innerText = this._initialText;
    this._clicks = [];
    this._nodes.main.addEventListener("click", e=>this._clicks.push(Date.now()));
    r();
  }
  this.end = async function(){ 
    if (!this._log) return;
    this._clicks.forEach(c=>this.log("Click", "Click", c));
  }
  this.value = async function () { return (this._nodes||{main:{}}).main.innerText; }
  this.actions = {
    $callback: function(r,...rest) {
      this._nodes.main.addEventListener("click", async e=>{
        for (let i = 0; i < rest.length; i++)
          if (rest[i] instanceof Function) await rest[i].call();
      });
      r();
    },
    click: function(r) { this._nodes.main.click(); r(); },
    text: function (r,text) { r(this._nodes.main.innerText = text); },
    $wait: function(r,t) { 
      let waited = false;
      this._nodes.main.addEventListener('click',async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      });
    },
  }
  this.test = {
    clicked: async function(t){ return this._clicks.length>0; }
  }
});
