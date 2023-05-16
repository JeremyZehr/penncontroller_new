export const zip = require("@zip.js/zip.js");
import { debug } from './debug';

const resources = [], extractedFiles = {};

export const scanZipForResource = resource => {
  if (resource._status=='loaded') return;
  resources.push(resource);
  if (extractedFiles[resource._name])
    extractedFiles[resource._name].forEach( blobURL => resource._preloader(blobURL).then(r=>resource._r(r)) );
}
export const preloadZip = async url => {
  if (!url || typeof(url)!="string") return debug.warning("Invalid URL passed to PreloadZip ("+url+")");
  let response;
  debug.log("Fetching "+url+"...");
  try {
    response = await fetch(url);
    if (!response.ok) return debug.warning("Download of "+url+" failed: "+response.statusText);
    debug.log("Download of "+url+" complete");
  } catch (e) {
    let msg = "Could not download "+url+": "+e;
    if (msg.match(/NetworkError/)) msg += " Did you set up the CORS permissions correctly?";
    debug.warning(msg);
    return;
  }
  try {
    const zipBlob = await response.blob();
    const zipReader = new zip.ZipReader(new zip.BlobReader(zipBlob));
    const entries = await zipReader.getEntries();
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.directory) continue;
        const filename = entry.filename.split('/').pop();
        if (filename.startsWith(".")) continue; // hidden file
        const entryBlob = await entry.getData(new zip.BlobWriter());
        const entryURL = URL.createObjectURL(entryBlob);
        extractedFiles[filename] = [...(extractedFiles[filename]||[]),entryURL];
        resources.forEach( resource => {
          if (resource._name==filename && resource._status=='unloaded') resource._preloader(entryURL).then( r=>resource._r(r) );
        });
    }
    await zipReader.close();
    debug.log("All "+entries.length+" files found in "+url+" were successfully extracted");
  }
  catch (e) {
    debug.error("There was a problem trying to extract "+url+": "+e);
  }
}
