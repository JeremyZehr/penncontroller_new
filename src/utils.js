// let preRunningFunctions = [];
// // ibex_controller_set_properties is called on SendResults shortly before the running order is computed
// const old_ibex_controller_set_properties = window.ibex_controller_set_properties;
// window.ibex_controller_set_properties = function (name, options) {
//     const r = old_ibex_controller_set_properties(name, options);
//     if (name!="__SendResults__") return r;  // Run after __SendResults__
//     preRunningFunctions.forEach( f => f instanceof Function && f.apply(this, [name,options]) );
// }
// export const prerun = (f,position=-1)=>{
//   const l = preRunningFunctions.length;
//   if (position<0||position>l) position = l;
//   preRunningFunctions.splice(position,0,f); // Add f at POSITION
//   return preRunningFunctions;
// }
export const waitUntil = condition => new Promise(r=>{
  const check = ()=> condition()&&r() || window.requestAnimationFrame(check);
  check();
});

export const addStylesheet = css => {
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.type = 'text/css';
  const cssblob = new Blob([css], {type: 'text/css'});
  link.href = URL.createObjectURL(cssblob);
  document.head.appendChild(link);
  return link;
}

export const fullKey = e=>`${e.ctrlKey?'Ctrl':''}${e.altKey?'Alt':''}${e.shiftKey?'Shift':''}${e.key.toUpperCase()}`;

export const keyMatch = (e,keys) => {
  let idx = keys.indexOf("");
  if (idx<0) idx = keys.indexOf(e.key);
  if (idx<0) idx = keys.findIndex(k=>typeof(k)=="string" && k.match(/^([A-Z]+|[a-z]+)$/) &&
                                     k.toUpperCase().indexOf(e.key.toUpperCase())>=0);
  if (idx<0) idx = keys.findIndex(k=>typeof(k)=="number" && k==e.which);
  if (idx<0 && (e.ctrlKey||e.altKey||e.shiftKey)) idx = keyMatch({key:fullKey(e)},keys);
  return idx;
};

export async function upload(url,filename,file,mimeType){
  let presignedPostData;
  try {
      presignedPostData = await new Promise((resolve,reject) => {
          const xhr = new XMLHttpRequest();
          const addParamCharacter = (url.match(/\?/) ? "&" : "?");
          xhr.open("GET", url+addParamCharacter+"filename="+encodeURIComponent(filename)+"&mimetype="+encodeURIComponent(mimeType), true);
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.onerror = e=>reject("Could not GET "+url+";");
          xhr.onload = function() {
              let obj = null;
              try{ obj = JSON.parse(this.responseText); }
              catch { obj = this.responseText; }
              console.log("response",obj);
              resolve(obj);
          };
          console.log("before sending xhr");
          xhr.send();
          console.log("after sending xhr");
      });
  } catch (e){ return new Promise((resolve,reject)=>reject(e)); }
  console.log("presignedPostData",presignedPostData);
  const formData = new FormData();
  if (presignedPostData===undefined || typeof presignedPostData=="string"){
      formData.append('fileName', filename);
      formData.append('mimeType', mimeType);
      formData.append('file', file);
  }
  else{
      Object.keys(presignedPostData).forEach(key => {
          if (key=="url")
              url = presignedPostData.url;
          else
              formData.append(key, presignedPostData[key]) 
      });
      // Actual file has to be appended last.
      formData.append("file", file);
      if (presignedPostData.key)
          filename = presignedPostData.key;
  }
  return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.onload = () => resolve(filename);
      xhr.onerror = () => reject(xhr.responseText);
      try { xhr.send(formData); } 
      catch (e){ return reject("Could not POST to "+url+"; "+e); }
  });
}

const su = () => (((1+Math.random())*0x10000) | 0).toString(16).substring(1);
export const uuid = ()=> [su(),su(),'-',su(),'-4',su().substr(0,3),'-',su(),'-',su(),su(),su()].join('').toLowerCase();
