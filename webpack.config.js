const path = require('path');

module.exports = (env,argv) => {
  console.log(argv.mode);
  return { 
    entry: argv.mode=='production'?'./src/index.prod.js':'./src/index.dev.js',
    output: {
      filename: 'PennController.js',
      path: path.resolve(__dirname, 'dist/js_includes'),
    },
  };
};
