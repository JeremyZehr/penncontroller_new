import { width,height,left,top } from './debug.css';

window.onerror = (msg, url, linenumber) => {
  debug.error(msg,url,linenumber);
  console.error('Error message: '+msg+'\nURL: '+url+'\nLine Number: '+linenumber);
}
window.addEventListener("unhandledrejection", function(promiseRejectionEvent) { 
  debug.error(promiseRejectionEvent.reason.message);
  console.error("Promise error:", promiseRejectionEvent);
});

const VERSION = 2.1;

const popin = document.createElement("DIV");
popin.classList.add("debugger");
const header = document.createElement("DIV");
header.classList.add("header");
header.innerText = "Debug (PennController "+VERSION+")";
let x_prev, y_prev, move_or_resize;
header.addEventListener("mousedown", e=>{ popin.style['user-select'] = 'none'; move_or_resize = 'move'; });
document.addEventListener("mouseup", ()=>{ move_or_resize=undefined; popin.style['user-select'] = 'unset'; });
document.addEventListener("mousemove", e=>{ 
  if (move_or_resize=="move"){
    popin.style.left = parseInt(window.getComputedStyle(popin).left) + e.clientX - x_prev;
    popin.style.top = parseInt(window.getComputedStyle(popin).top) + e.clientY - y_prev;
  }
  else if (move_or_resize=="resize"){
    popin.style.width = parseInt(window.getComputedStyle(popin).width) + e.clientX - x_prev;
    popin.style.height = parseInt(window.getComputedStyle(popin).height) + e.clientY - y_prev;
  }
  x_prev = e.clientX;
  y_prev = e.clientY;
});
const arrow = document.createElement("DIV");
arrow.classList.add("arrow");
arrow.innerText = "▾";
const switch_fold = (overwrite=undefined)=>{
  if (overwrite=='unfold'||(overwrite!='fold'&&popin.classList.contains("folded"))) {
    popin.classList.remove("folded");
    arrow.innerText = "▾";
  }
  else {
    arrow.innerText = '▸';
    popin.classList.add("folded");
  }
}
arrow.addEventListener("click", switch_fold);
header.prepend(arrow);
const cross = document.createElement("DIV");
cross.classList.add("cross");
cross.innerText = "X";
cross.addEventListener("click", ()=>popin.remove());
header.append(cross);
popin.append(header);
const tabtitles = document.createElement("DIV");
tabtitles.classList.add("tabtitles");
tabtitles.addEventListener('mousemove',e=>{
  const bcr = tabtitles.getBoundingClientRect();
  if (e.pageX-bcr.x < 10) tabtitles.scrollBy(-10,0);
  else if ((bcr.x+bcr.width)-e.pageX < 10) tabtitles.scrollBy(10,0);
}, false);
const resize = document.createElement("DIV");
resize.classList.add("resize")
resize.addEventListener("mousedown", e=>{ popin.style['user-select'] = 'none'; move_or_resize='resize'; });
popin.append(resize);
popin.append(tabtitles);

const tabs = {};
const showTab = name => {
  if (tabs[name]===undefined) return;
  popin.querySelectorAll(".tabtitles .title").forEach( t=>t.classList.remove("active") );
  popin.querySelectorAll(".tab").forEach( t=>t.classList.remove("active") );
  tabs[name].title.classList.add("active");
  tabs[name].tab.classList.add("active");
} 

const addTab = (name,content) => {
  const title = document.createElement("DIV");
  title.classList.add("title");
  title.innerText = name;
  title.addEventListener('click', ()=>showTab(name));
  tabtitles.append(title);
  const tab = document.createElement("DIV");
  tab.classList.add("tab");
  tab.classList.add(name.replace(/\W+/,'_'));
  if (content) tab.append(content);
  popin.append(tab);
  if (!popin.querySelector(".tab.active")){
    title.classList.add("active");
    tab.classList.add("active");
  }
  tabs[name] = {title: title, tab: tab};
  return tab;
}

// const infoTab = addTab('Info');
// infoTab.innerHTML = "<em>No trial currently running</em>";
const sequenceTab = addTab('Sequence');
sequenceTab.innerHTML = "<em>Sequence not generated yet</em>";
const warningsTab = addTab('Warnings');
warningsTab.innerHTML = "<em>No warnings</em>";
const errorsTab = addTab('Errors');
errorsTab.innerHTML = "<em>No errors detected</em>";
const logsTab = addTab('Logs');
const logsMessages = document.createElement("DIV");
logsMessages.classList.add("messages");
logsTab.append(logsMessages);
showTab('Logs');  // Start with Logs tab open

const message = (msg,tab) => {
  const dt = new Date();
  const line = document.createElement("DIV");
  line.innerHTML = `<strong>[${dt.toTimeString().split(' ')[0]}]</strong> ${msg}`;
  tab.prepend(line);
};
export const debug = {
  node: popin,
  tabs: tabs,
  on: true,
  show: ()=>{
    if (!debug.on) return;
    popin.style.left = left; popin.style.top = top;
    popin.style.width = width; popin.style.height = height;
    document.body.append(popin);
  },
  switch: (on=true) => {
    debug.on=on;
    if (on) debug.show();
    else popin.remove();
  },
  switch_fold: switch_fold,
  fold: ()=>switch_fold('fold'),
  unfold: ()=>switch_fold('unfold'),
  show_tab: showTab,
  log: msg => message(msg,logsMessages),
  error: (msg,url,linenumber) => {
    if (errorsTab.innerHTML=="<em>No errors detected</em>") errorsTab.innerHTML = "";
    tabs.Errors.title.style.color = 'red';
    if (msg.match(/expected expression, got ','/)) msg += " -- Tip: do you have two commas in a row?";
    if (url && linenumber) {
      url = url.split(' ');
      msg += ` <a href='${url[0]}'>line ${linenumber} ${url.length>0?url.join(' '):''}</a>`;
    }
    message(msg,errorsTab);
    showTab("Errors");
    return debug;
  },
  warning: (msg,url,linenumber) => {
    if (warningsTab.innerHTML=="<em>No warnings</em>") warningsTab.innerHTML = "";
    tabs.Warnings.title.style.color = 'orange';
    message(msg,warningsTab);
    showTab("Warnings");
    return debug;
  },
};

document.addEventListener('DOMContentLoaded', debug.show);
document.addEventListener('keydown', e=>{
  if (debug.on && e.ctrlKey && e.key=='d'){
    e.preventDefault();
    e.stopPropagation();
    debug.show();
    return false;
  }
});
