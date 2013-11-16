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
  .description('Lookup episodes from tvdb for a given series id')
  .option('-i, --series-id <id>', 'tvdb series id', parseInt)
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

if (program.seriesId) {
  var seriesId = program.seriesId;
  utils.getSeriesInfo(function(err, result) {
    if (err) { 
      console.error(err);
    }
    else {
      _.each(result.episodes, function(episode) {
        console.log(episode.toPlist());
      });
    }
  }, seriesId);
} 
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
