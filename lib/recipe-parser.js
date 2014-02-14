/*!
 * recipe-parser
 * Copyright(c) 2014 Andrew Cates <catesandrwe@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var CooksIllustratedRecipeParser = require('./cooks-illustrated-parser'),
    CooksIllustratedScraper = require('./scrub-cooks-illustrated'),
    SeriousEatsRecipeParser = require('./serious-eats-parser'),
    SeriousEatsScraper = require('./scrub-serious-eats'),
    FoodNetworkRecipeParser = require('./food-network-parser'),
    FoodNetworkScraper = require('./scrub-food-network'),
    MacGourmetExport = require('./mac-gourmet-export');

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

RecipeParser.prototype.getParser = function(name) {
  switch (name) {
    case 'se':
      return new SeriousEatsRecipeParser();
    case 'ci':
    case 'atk':
    case 'cc':
      return new CooksIllustratedRecipeParser();
    case 'fn':
      return new FoodNetworkRecipeParser();
  }
};

RecipeParser.prototype.getScraper = function(name) {
  switch (name) {
    case 'se':
      return SeriousEatsScraper;
    case 'ci':
    case 'atk':
    case 'cc':
      return CooksIllustratedScraper;
    case 'fn':
      return FoodNetworkScraper;
  }
};

RecipeParser.prototype.getExporter = function(name) {
  switch (name) {
    case 'mgd':
      return new MacGourmetExport();
  }
};
