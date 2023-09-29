#!/bin/bash

version=$(head -1 ./src/version.js)
version="${version:3}"
timestamp=$(date +%s)
echo "Version: $version.$timestamp"

echo "// $version
export const VERSION = '$version.$timestamp';" > ./src/version.js

cp ./src/elements/PennElement_*.js ./dist/js_includes/

npx webpack --mode=production

cp ./dist/js_includes/PennController.js ./beta/

sed -i "1s|^|// PennController v$version.$timestamp\n|" ./beta/PennController.js

npx webpack --mode=development

git add .
git commit -m "Build version $version.$timestamp"

git push
