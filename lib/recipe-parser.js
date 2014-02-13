/*!
 * recipe-parser
 * Copyright(c) 2014 Andrew Cates <catesandrwe@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var path = require('path');

/**
 * Expose `RecipeParser`.
 */

exports = module.exports = RecipeParser;

// Expose internal libs.
function mRequire(name, file) {
  return RecipeParser[name] = require(file);
}

mRequire('util', './util');
mRequire('log', './log');

// Expose some metadata.
var pkg = mRequire('package', '../package.json');
RecipeParser.version = pkg.version;

/**
 * Expose internals.
 */
function RecipeParser(options) {
  options = options || {};
  this.options = options;
}
