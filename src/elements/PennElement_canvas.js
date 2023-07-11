/**
 * The Canvas element lets you place elements at X,Y coordinates on a surface
 * @namespace Canvas
 */
window.PennController._AddElementType('Canvas', function (PennEngine){
  /**
   * Creates a new Canvas element of the specified dimensions
   * @function newCanvas
   * @param {string} [name] - The name of the element
   * @param {number} width - The width, in pixels, of the Canvas element
   * @param {number} height - The height, in pixels, of the Canvas element
   * @example
   * // Creates a Canvas element named "myCanvas" of 300*200px
   * newCanvas("myCanvas", 300, 200)
   * @global
   * @see Canvas
   */
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
    const w = this._nodes.main.style.width, h = this._nodes.main.style.height;
    /**
     * @summary Adds a line to the results file reporting when the canvas was printed
     * @description
     * This will _not_ report one line for each contained element printed along with the canvas.
     * The timestamp in the EventTime column corresponds to when the canvas appeared on the page.
     * The Value column reports the size of the canvas in pixels at the time of printing (`width;height`)
     * @example
     * newCanvas("myCanvas", 300,200).log().print()
     * // ...,PennElementName,PennElementType,Parameter,Value,EventTime,Comments
     * // ...,myCanvas,Canvas,Print,300;200,1686316599815,NULL
     * @function log
     * @memberof Canvas
     * @instance
     */
    for (let i=0; i<this._prints.length; i++)
      this.log("Print",w+";"+h,this._prints[i].date,this._prints[i].args.join(' '));
  }
  this.value = async function () { return this._name; }
  this.settings = {
    /**
     * Executes commands/functions when the button is clicked
     * @function add
     * @param  {(Coordinate)} x - The X coordinate of the added element
     * @param  {(Coordinate)} y - The Y coordinate of the added element
     * @param  {Element} element - The element to add
     * @example <caption>Passing pixel coordinates</caption>
     * // Add a Button element at 100*50px from the top-left corner of the Canvas element
     * newCanvas("myCanvas", 750,300)
     *   .add( 100 , 50 , newButton("Click me!") )
     * @example <caption>Passing expressions as coordinates</caption>
     * // Add a Button element at the bottom-right corner of a 750*300px Canvas element
     * newCanvas("myCanvas", 750,300)
     *   .add( "right at 100%" , "bottom at 100%" , newButton("Click me!") )
     * @memberof Canvas
     * @instance
     */
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
    /**
     * Sets the background color of the canvas
     * @function color
     * @param  {string} color - A string representing the background color
     * @example <caption>Passing a color name</caption>
     * // Paint the background of the Canvas element in green
     * newCanvas("myCanvas", 750,300)
     *   .color( "green" )
     * @example <caption>Passing an RGB value</caption>
     * // Paint the background of the Canvas element using the RGB value 100,150,125
     * newCanvas("myCanvas", 750,300)
     *   .color( "rgb(100,150,125" )
     * @memberof Canvas
     * @instance
     */
    color: function(r,c){ 
      if (this._nodes && this._nodes.main instanceof Node) this._nodes.main.style['background-color']=c;
      else this.addEventListener("print",()=>this._nodes.main.style['background-color']=c);
      r();
    }
  }
});
