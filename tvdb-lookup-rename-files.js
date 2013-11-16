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
  .description( "Renames tv show filenames into proper 'SeriesName - SxxEyy' format.\n"  +
    "Given a seriesId from tvdb, this script will attempt find the best\n" +
    "match for a given filename. It does this by downloading all the\n" +
    "possible episode name(s) fromm all season(s) and uses the levenshtein\n" +
    "algorithm to find the closest possible match. It takes a filename that\n" +
    "just has the episode name and renames it with the proper format above.\n" +
    "Now when you go to add tags to the file name, since the 'SxxEyy' are\n" + 
    "present in the filename, it will be tagged easily." )
  .option('-i, --series-id <id>', 'tvdb series id', parseInt)
  .option('-p, --path <dir>', 'directory path of files to rename.')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

if (program.seriesId && program.path) {
  var seriesId = program.seriesId;
  var base_dir = utils.expandHomeDir(program.path);

  utils.getSeriesInfo(function(err, result) {
    if (err) { 
      console.error(err);
    }
    else {
      //var incoming = ["13 - Bugs Bunny Gets the Boid", "13 - Rabbit Fire", "01 - Baseball Bugs", "02 - Dough for the Do-Do"];
      var incoming = fs.readdirSync(base_dir);
      async.forEachSeries(incoming, function(title, next) {
        var filename = title;
        var extension = /(?:\.([^.]+))?$/.exec(title)[0];
        if (extension) {
          title = title.split(extension)[0];
        }
        
        var levs = [], str_nears, obj_nears;

        // calculate all the levenshtein
        _.each(result.episodes, function(episode) {
          var left = ( episode.EpisodeName || "" ).toLowerCase(),
              right = ( title || "" ).toLowerCase(),
              lev = utils.levenshtein(left, right);
          if (typeof(lev) !== 'undefined') {
            levs.push({
              'lev':lev,
              'episode':episode
            });
          }
        });
        // sort all the levenshtein
        levs = _.sortBy(levs, function(obj) {
          return obj.lev;
        });

        // make your choice
        if (levs.length > 0) {
          // get the closest one
          var lev_val = levs[0].lev; 
          str_nears = [];
          obj_nears = [];

          str_nears.push("Continue without renaming");
          obj_nears.push({});

          _.each(levs, function(obj) {
            if ( Math.abs(obj.lev - lev_val) < 6) {
              str_nears.push("Lev: " + obj.lev + ", " + obj.episode.toString() + ", EpisodeName: " + obj.episode.EpisodeName);
              obj_nears.push(obj);
            }
          });

          console.log('Choose the closest match: [ "' + title + '" ]');
          program.choose(str_nears, function(i) {
            if (i === 0) {
              verbose('You chose to continue');
              next();
            } else {
              verbose('You chose %d "%s"', i, obj_nears[i].episode.EpisodeName);
              // rename the incoming title now
              fs.renameSync(base_dir + filename, base_dir + obj_nears[i].episode.toFileName() + " - " + title + extension);
              next();
            }
          });
        } else {
          next();
        }
      },
      function(data) {
        verbose('all done');
        process.stdin.destroy();
      });
    }
  }, seriesId);
}
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
