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
  .description('Try to parse a given filename')
  .option('-f, --file-name <string>', 'an arbitrary filename')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

if (program.fileName) {
  var fileName = program.fileName;
  utils.parseFile(function(err, episode_info) {
    if (err) { 
      console.error(err);
    }
    else {
      console.log(episode_info);
    }
  }, fileName);
} 
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
