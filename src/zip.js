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
  debug.log("Fetching "+url+"...");
  const response = await fetch(url);
  debug.log("Download of "+url+" complete");
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
}
