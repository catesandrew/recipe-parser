'use strict';

// Nodejs libs.
var path = require('path');

// The module to be exported.
var main = module.exports = {};

// Expose internal libs.
function mRequire(name, file) {
  return main[name] = require('./lib/' + file);
}

var util = mRequire('util', 'util');
var cooksIllustratedParser = mRequire('cooksIllustratedParser', 'cooks-illustrated-parser');

// Expose some metadata.
main.package = require('./package.json');
main.version = main.package.version;
