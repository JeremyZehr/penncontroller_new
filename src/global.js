import { header, footer, newTrial, checkpreloaded, sendResults, encryptResults } from './trial';
import { addTable, getTable, template } from './template';
import { addElementType, elements } from './element';
import { preloadZip } from './zip';
import { sequence } from './order';
import { debug } from './debug';

export const hosts = [];
const addHost = host => hosts.push(host);
const getURLParameter = p => (new URLSearchParams(window.location.search)).get(p)

const PennController = newTrial;

const setCounter = (...args)=>{
  let label = "setCounter", number, incOrSet;
  if (args.length==3){
    label = args[0]; incOrSet = args[1]; number = args[2];
  }
  else if (args.length==2) {
    if (args[0]=="inc"||args[0]=='set') incOrSet = args[0];
    else label = args[0];
    number = args[1];
  }
  else if (args.length == 1) {
    if (args[0]=='inc'||args[0]=='set') incOrSet = args[0];
    else if (isNaN(Number(args[0]))) label = args[0];
    else number = args[0];
  }
  const options = {};
  if (incOrSet=='inc'||incOrSet=='set') options[incOrSet] = (number||1);
  else if (number) options.set = number;
  window.items = [[label, "__SetCounter__", options]];
}

const Global = {
  _AddElementType: addElementType,
  AddHost: addHost,
  AddTable: addTable,
  CheckPreloaded: checkpreloaded,
  Debug: ()=>debug.switch(/*on=*/true),
  DebugOff: ()=>debug.switch(/*on=*/false),
  Elements: elements,
  EncryptResults: encryptResults,
  Footer: footer,
  GetTable: getTable,
  GetURLParameter: getURLParameter,
  Header: header,
  newTrial: newTrial,
  PreloadZip: preloadZip,
  SendResults: sendResults,
  Sequence: sequence,
  SetCounter: setCounter,
  Template: template
}

for (let g in Global) Object.defineProperty(PennController,g,{get(){ return Global[g]; }});

PennController.ResetPrefix = prefix => {
  if (prefix && window[prefix] !== undefined) throw Error("Attempted to use a reserved prefix ("+prefix+")");
  let o = window;
  if (prefix) o = (window[prefix]={});
  else
    for (let e in elements) Object.defineProperty(o,e,{get(){ return elements[e]; }});
  for (let g in Global) Object.defineProperty(o,g,{get(){ return Global[g]; }});
}

window.PennController = new Proxy(PennController, {
  get(t,p){return PennController[p];},
  set(){throw Error("PennController is read-only")}
});
