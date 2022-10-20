window.PennController._AddElementType('Html', function (PennEngine){

  const incompleteFields = function(){
    const incomplete = [];
    [...this._nodes.main.querySelectorAll("input, textarea")].forEach(input=>{
      if (input.nodeName=="TEXTAREA" || input.type=="text") {
        if (input.classList.contains("obligatory") && (!input.value || input.value.match(/^\s*$/))) incomplete.push(input);
      }
      else if (input.type=="checkbox" && !input.checked && input.classList.contains("obligatory")) incomplete.push(input);
      else if (input.type=="radio"){
        if (!input.name) return;
        if (document.querySelector(`input[name=${input.name}].obligatory`)===undefined) return;
        if (document.querySelectorAll(`input[name=${input.name}].checked`)===undefined) incomplete.push(input);
      }
    });
    return incomplete;
  }

  this.immediate = function(name,url){ 
    if (name===undefined) name = "Html";
    if (url===undefined) url = name;
    this._url = url;
    this._obligatoryErrorGenerator = f =>"The \u2018" + f + "\u2019 field is obligatory.";
    this._obligatoryCheckboxErrorGenerator = f =>"You must check the \u2018" + f + "\u2019 checkbox to continue.";
    this._obligatoryRadioErrorGenerator = f =>"You must select an option for \u2018" + f + "\u2019.";
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("DIV")};
    this._results = [];
    this.addEventListener("print",()=>{
      window.addSafeBindMethodPair("Form");
      const os = {
        html: this._url.match(/\.html?/i)?{include:this._url}:this._url,
        obligatoryErrorGenerator: f=>this._obligatoryErrorGenerator(f),
        obligatoryCheckboxErrorGenerator: f=>this._obligatoryCheckboxErrorGenerator(f),
        obligatoryRadioErrorGenerator: f=>this._obligatoryRadioErrorGenerator(f),
        _finishedCallback: results=>{
          const d = Date.now();
          this._results.push(...results.map(v=>[...v.map(w=>w[1]),d]));
          this.dispatchEvent("finishedCallback");
        },
        _cssPrefix: "Message-",
        _utils: PennEngine.order.current.options._utils
      };
      for (let o in this._options) os[o] = this._options[o];
      window.jQuery(this._nodes.main).Form(os);
      if (this._eventListeners.finishedCallback===undefined)
        this._nodes.main.querySelector("a.Message-continue-link").style.display = 'none';
    });
    r();
  }
  this.end = async function(){
    if (!this._log || !this._results) return;
    this._results.forEach(r=>this.log(...r));
  }
  this.value = async function () { return undefined; }
  this.actions = {
    checkboxWarning: function(r,t){ this._obligatoryCheckboxErrorGenerator = f=>t.replace(/%name%/g,f); r(); },
    inputWarning: function(r,t){ this._obligatoryErrorGenerator = f=>t.replace(/%name%/g,f); r(); },
    radioWarning: function(r,t){ this._obligatoryRadioErrorGenerator = f=>t.replace(/%name%/g,f); r(); },
    $wait: function(r,t){
      if (this._nodes.main instanceof Node && document.documentElement.contains(this._nodes.main))
        this._nodes.main.querySelector("a.Message-continue-link").style.display = 'block';
      let waited = false;
      this.addEventListener("finishedCallback", async ()=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      });
    },
    warn: function(r) { 
      if (incompleteFields.call(this).length==0) return r();
      if (this._nodes && this._nodes.main instanceof Node && this._nodes.main.querySelector("a.Message-continue-link"))
        this._nodes.main.querySelector("a.Message-continue-link").click();
      r();
    }
  }
  this.test = {
    complete: async function(t){ return incompleteFields.call(this).length==0; }
  }
});
