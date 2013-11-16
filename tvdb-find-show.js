#!/usr/bin/env node

var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , plist = require('plist')
  , program = require('commander')
  , util = require('util');

var utils = require('./utils.js').utils;
program
  .version('0.1')
  .description('Search for a series from the one supplied.')
  .option('-n, --series-name <id>', 'tvdb series name')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

if (program.seriesName) {
  var seriesName = program.seriesName;

  utils.findTvShow(function(err, tvshows) {
    if (err) { 
      console.error(err);
    }
    else {
      console.log(tvshows);
    }
  }, seriesName);
}
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
