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

// returns a non-async version of the function that will run it in parallel to the local thread
export const parallel = fn => ()=>{ fn instanceof Function ? fn() : 0; 1; }

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
              console.log("response",obj,"status", this.status, "this", this);
              if (this.status>=200 && this.status<300)
                resolve(obj);
              else
                reject(this.statusText);
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

export const get_encrypted_blob = async (str,exported_key) => {
  if (exported_key===undefined) return new Blob([str], { type: "text/plain" });
  if (!window.crypto || !window.crypto.subtle || 
      !window.crypto.subtle.importKey || !window.crypto.subtle.exportKey || !window.crypto.subtle.generateKey || 
      !window.crypto.subtle.encrypt || !window.crypto.getRandomValues) 
    return new Blob([str], { type: "text/plain" });
  if ( typeof(exported_key.alg) != "string" || typeof(exported_key.e) != "string" ||
       typeof(exported_key.kty) != "string" || typeof(exported_key.n) != "string" ||
       typeof(exported_key.ext) != "boolean" || !(exported_key.key_ops instanceof Array) ) {
    window.console.error("Invalid public key passed for encryption");
    return new Blob([str], { type: "text/plain" });
  }
  const public_rsa = await window.crypto.subtle.importKey(
    "jwk", exported_key,
    {name: "RSA-OAEP",modulusLength: 4096,publicExponent: new Uint8Array([1, 0, 1]),hash: "SHA-256",},
    true, ["encrypt"]
  );
  const aes = await window.crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt", "decrypt"]);
  const exported_aes = await window.crypto.subtle.exportKey("raw", aes);
  const encrypted_aes = await window.crypto.subtle.encrypt({name: "RSA-OAEP"},public_rsa,exported_aes);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const message = await window.crypto.subtle.encrypt({name: "AES-GCM",iv:iv},aes,new TextEncoder().encode(str));
  const concat_array = new Uint8Array(iv.length + encrypted_aes.byteLength + message.byteLength);
  concat_array.set(new Uint8Array(iv), 0); // = 12
  concat_array.set(new Uint8Array(encrypted_aes), iv.byteLength); // = 512
  concat_array.set(new Uint8Array(message),iv.byteLength + encrypted_aes.byteLength);
  return new Blob([concat_array], { type: "application/octet-stream" });
}
