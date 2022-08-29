window.PennController._AddElementType('Scale', function (PennEngine){

  const buildScale = async function(){
    [...this._cells.children].forEach(e=>e.remove());
    this._cells.remove();
    this._value = (this._value===undefined?this._default:this._value);
    if (this._nPoints<=0) return;
    if (this._scaleType != "slider")
      for (let i = 0; i < this._nPoints; i++){
        const cell = document.createElement("DIV");
        const label = document.createElement("DIV");
        label.append(this._labels.length>i?this._labels[i]:i);
        const v = this._values.length>i?this._values[i]:i;
        const input = document.createElement("INPUT");
        input.name = 'PennController-'+this._type+'-'+this._name;
        input.value = (typeof(v)=="string"||typeof(v)=="number")?v:i;
        input.type = this._scaleType;
        if (input.value==this._value && (this._scaleType=="radio"||this._scaleType=="checkbox")) input.checked = true;
        input.onclick = ()=>this.dispatchEvent("select", input.value, this._scaleType=='checkbox'?input.checked:undefined);
        cell.append(input);
        cell.style.display = 'flex';
        if (["right","left"].indexOf(this._labelsPosition)>=0) cell.style['flex-direction'] = 'row';
        else if (["top","bottom"].indexOf(this._labelsPosition)>=0) cell.style['flex-direction'] = 'column';
        if (["right","bottom"].indexOf(this._labelsPosition)>=0) cell.append(label);
        else if (["left","top"].indexOf(this._labelsPosition)>=0) {
          cell.style['justify-content'] = 'space-between';
          cell.prepend(label);
        }
        this._cells.append(cell);
      }
    else {
      const slider = document.createElement("INPUT");
      slider.type = "range";
      slider.min = 0;
      slider.max = this._nPoints-1;
      slider.value=(slider.max+slider.min)/2;
      let mousedown = undefined;
      slider.onmousedown = e=>mousedown=Date.now();
      slider.onmouseup = e=>{
        if (mousedown) this.dispatchEvent("select", slider.value, mousedown)
        mousedown = undefined;
      }
      this._cells.append(slider);
    }
    if (this._orientation=="horizontal") {
      this._nodes.main.style.display = "inline-block";
      this._cells.style["flex-direction"] = "row";
    }
    else if (this._orientation=="vertical") {
      this._nodes.main.style.display = "flex";
      this._cells.style["flex-direction"] = "column";
    }
    this._nodes.main.append(this._cells);
  }

  this.immediate = function(name,...args){ 
    if (name===undefined) name = "Scale";
    this._initialScaleType = 'radio';
    if (args.length==0) args[0] = name;
    if (args.length==1 && typeof(args[0])=="number") this._initialNPoints = args[0];
    else {
      this._initialLabelsPosition = 'top';
      this._initialValues = args;
    }
  }
  this.uponCreation = async function(r){
    this._scaleType = this._initialScaleType;
    this._values = this._initialValues||[];
    this._labels = [...this._values];
    this._nPoints = this._initialNPoints||this._values.length;
    this._nodes = {main: document.createElement("DIV")};
    this._cells = document.createElement("DIV");
    this._cells.style.display = 'flex';
    this._cells.style["justify-content"] = 'space-between';
    this._labelsPosition = this._initialLabelsPosition;
    this._orientation = "horizontal";
    this._selects = [];
    this.addEventListener("print", ()=>buildScale.call(this));
    this.addEventListener("select", (v,d)=>{
      const dn = Date.now();
      const toPush = [v,dn]
      this._value=v;
      if (typeof(d)==="number") toPush.push(dn-d);
      else if (typeof(d)=="boolean") {
        toPush.push(`${d?'':'un'}checked`);
        this._value = d?v:undefined;
      }
      this._selects.push(toPush);
    });
    this._keys = [];
    this._keysHandler = e=>{
      const idx = PennEngine.utils.keyMatch(e,this._keys);
      if (idx<0) return;
      const v = this._values[idx];
      if (v===undefined) return;
      if (this._scaleType=="checkbox" && [...this._cells.querySelectorAll("input")].find(i=>i.value==v&&i.checked))
        this._commands.unselect(v,).call();
      else
        this._commands.select(v,"active").call();
    };
    document.body.addEventListener("keydown", this._keysHandler);
    r();
  }
  this.end = async function(){ 
    document.body.removeEventListener("keydown", this._keysHandler);
    if (!this._log) return;
    this._selects.forEach(s=>this.log("Select", ...s));
  }
  this.value = async function () { return this._value; }
  this.actions = {
    $callback: function(r,...rest) {
      this._nodes.main.addEventListener("select", async v=>{
        for (let i = 0; i < rest.length; i++)
          if (rest[i] instanceof Function) await rest[i].call(PennEngine.trials.current,v);
      });
      r();
    },
    select: async function(r,v,o){
      this._value = v;
      let checkboxesToKeepSelected = [];
      if (v!==undefined && this._scaleType=="checkbox")
        checkboxesToKeepSelected = [...this._cells.querySelectorAll("input")].filter(i=>i.checked).map(i=>i.value);
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      [...this._cells.querySelectorAll("input")].forEach(i=>checkboxesToKeepSelected.indexOf(i.value)>=0 && (i.checked=true));
      if (o!==undefined) this.dispatchEvent("select", v);
      r();
    },
    unselect: async function(r,v){
      this._default = undefined;
      this._value = undefined;
      let checkboxesToKeepSelected = [];
      if (v!==undefined && this._scaleType=="checkbox")
        checkboxesToKeepSelected = [...this._cells.querySelectorAll("input")].filter(i=>i.value!=v && i.checked).map(i=>i.value);
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      [...this._cells.querySelectorAll("input")].forEach(i=>checkboxesToKeepSelected.indexOf(i.value)>=0 && (i.checked=true));
      r();
    },
    $wait: function(r,t) { 
      let waited = false;
      this.addEventListener("select",async v=>{
        if (waited || (t instanceof Function && !(await t.call(PennEngine.trials.current,v)))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      });
    },
  }
  this.settings = {
    button: async function (r){
      this._scaleType = "button";
      this._labelsPosition = undefined;
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      r();
    },
    checkbox: async function (r){
      this._scaleType = "checkbox";
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      r();
    },
    default: function (r,d){ this._default = d; r(); },
    horizontal: function(r){ this._orientation = "horizontal"; r(); },
    keys: function(r,...keys) { this._keys = keys; r(); },
    $label: async function(r,n,l) {
      if (l instanceof PennEngine.Commands) {
        this._labels[n] = document.createElement("DIV");
        await l.call();
        this.addEventListener("print", ()=>l._element._commands.center().print(this._labels[n]).call());
      }
      else if (l instanceof Function)
        this._labels[n] = await l.call();
      else
        this._labels[n] = l;
      if (document.body.contains(this._labelsElement)) {
        await buildScale.call(this);
        if (l instanceof PennEngine.Commands) l._element._commands.center().print(this._labels[n]).call()
      }
      r();
    },
    labelsPosition: async function (r,p){ 
      this._labelsPosition = p; 
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      r(); 
    },
    radio: async function (r){
      this._scaleType = "radio";
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      r();
    },
    slider: async function (r){
      this._scaleType = "slider";
      this._labelsPosition = undefined;
      if (document.body.contains(this._nodes.main)) await buildScale.call(this);
      r();
    },
    vertical: function(r){ this._orientation = "vertical"; r(); }
  }
  this.test = {
    $selected: async function(t){
      if (t===undefined) {
        if (this._scaleType=="checkbox") return [...this._cells.querySelectorAll("input")].find(i=>i.checked);
        else return this._value!==undefined;
      }
      const checkedValues = [...this._cells.querySelectorAll("input")].filter(i=>i.checked).map(i=>i.value);
      if (t instanceof PennEngine.Commands){
        await t.call();
        t = await t._element.value;
      }
      else if (t instanceof Function) {
        if (this._scaleType=="checkbox") return await t.call(this,checkedValues)
        else return await t.call(this,this._value);
      }
      if (this._scaleType=="checkbox") return checkedValues.indexOf(t)>=0;
      else return t==this._value;
    }
  }
});
