/**
 * The Button element lets you print buttons on the page and wait for clicks on them
 * @namespace Button
 */
window.PennController._AddElementType('Button', function (PennEngine){
  /**
   * Creates a new Button element
   * @function newButton 
   * @memberof Button
   * @param {string} name - The name of the element
   * @param {string} [text=name] - The text of the button
   * @global
   * @example
   * // Creates a Button element named "next" with the text "Move to the next trial"
   * newButton("next", "Move to the next trial")
   * @see Button
   */
  this.immediate = function(name,text){ 
    if (name===undefined) name = "Button";
    if (text===undefined) text = name;
    this._initialText = text;
  }
  this.uponCreation = async function(r){
    this._nodes = {main: document.createElement("BUTTON")};
    this._nodes.main.innerHTML = this._initialText;
    this._clicks = [];
    this.addEventListener("click", PennEngine.utils.parallel(async e=>{
      if (this._disabled) return;
      this._clicks.push(Date.now());
      this.dispatchEvent("waited");
    }));
    this._nodes.main.addEventListener("click", e=>this.dispatchEvent("click"));
    r();
  }
  this.end = async function(){ 
    /**
     * @summary Adds a line to the results file for each click on the button.
     * @description
     * The timestamp in the EventTime column corresponds to when the click happened.
     * @example
     * newButton("Click me!").log().print().wait()
     * // ...,PennElementName,PennElementType,Parameter,Value,EventTime,Comments
     * // ...,Click me!,Button,Click,Click,1688484672562,NULL
     * @function log
     * @memberof Button
     * @instance
     */
    if (this._log && this._clicks) this._clicks.forEach(c=>this.log("Click", "Click", c));
  }
  this.value = async function () { return (this._nodes||{main:{}}).main.innerText; }
  this.actions = {
    /**
     * Executes commands/functions when the button is clicked
     * @function callback
     * @example
     * // Displays a counter and increments it by 1 with each click on the button
     * newVar("counter", 0)
     * ,
     * newText("counter display", 0).print()
     * ,
     * newButton("Increment")
     *   .callback(
     *     getVar("counter").set( v => v+1 ),
     *     getText("counter display").text( getVar("counter") )
     *   )
     *   .print()
     * @memberof Button
     * @instance
     * @param {Command} command - Command/function to run whenever the button is clicked
     * @param  {...Command} [commands] - Additional commands/functions to run
     */
    $callback: function(r,...rest) {
      this.addEventListener("click", PennEngine.utils.parallel(async e=>{
        for (let i = 0; i < rest.length; i++)
          if (rest[i] instanceof Function) await rest[i].call();
      }));
      r();
    },
    /**
     * Simulates a click on the button
     * @function click
     * @example
     * // Uses a dummy Button element to end the trial only when both scales are selected
     * newButton("dummy")
     * ,
     * newScale("scale1", 7)
     *   .callback( getButton("dummy").click() ) // click the button upon selection
     *   .print()
     * ,
     * newScale("scale2", 7)
     *   .callback( getButton("dummy").click() ) // click the button upon selection
     *   .print()
     * ,
     * getButton("dummy")
     *   .wait( // halt the script here until the button is clicked...
     *     getScale("scale1").test.selected() // ... and scale1 is selected
     *       .and( getScale("scale2").test.selected() ) // ... and scale2 is selected
     *   )
     * @memberof Button
     * @instance
     */
    click: function(r) { this._nodes.main.click(); r(); },
    /**
     * Sets the text of the button
     * @function text 
     * @example
     * // Changes the button's text to "Stop" after recording starts
     * newButton("control", "Start recording").print().wait()
     * ,
     * newMediaRecorder("audio").record()
     * ,
     * getButton("control").text("Stop").wait()
     * ,
     * getMediaRecorder("audio").stop()
     * @memberof Button
     * @instance
     * @param {string} text - The text to show on the button
     */
    text: function (r,text) { r(this._nodes.main.innerText = text); },
    /**
     * Halts the script until the button is clicked
     * @function wait 
     * @example
     * // One-click trial
     * newTrial("start"
     *   newButton("Start now")
     *     .print()
     *     .wait() // without this the trial would end immediately
     * )
     * @memberof Button
     * @instance
     * @param  {Command} [test] - Resumes the script only if the test is successful
     */
    $wait: function(r,t) { 
      let waited = false;
      this.addEventListener('click', PennEngine.utils.parallel(async e=>{
        if (waited || (t instanceof Function && !(await t.call()))) return;
        this.dispatchEvent("waited");
        r(waited=true);
      }));
    },
  }
  this.test = {
    /**
     * Tests whether the button has ever been clicked since its creation
     * @function test.clicked
     * @memberof Button
     * @instance
     */
    clicked: async function(t){ return this._clicks.length>0; }
  }
});
