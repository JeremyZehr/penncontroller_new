const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'PennController.js',
    path: path.resolve(__dirname, 'dist/js_includes'),
  },
};
