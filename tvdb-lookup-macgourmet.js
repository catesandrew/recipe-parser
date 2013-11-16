#!/usr/bin/env node

var async = require('async'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeio = require('node.io'),
    plist = require('plist'),
    program = require('commander'),
    util = require('util'),
    sqlite3 = require('sqlite3').verbose(),
    utils = require('./utils.js').utils;

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

var cache = [];
var db = new sqlite3.Database('macgourmet.sql3', sqlite3.OPEN_READWRITE, function(error, data) {
  db.each('select recipe_id, source, publication_page, name from recipe where source like "Good Eats%"', function(err, row) {
    if (err) throw err;

    //console.log(row.recipe_id + ": " + row.source);
    cache.push({
      id: row.recipe_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page
    });

  }, function(err, num) {
    if (err) throw err;

    var seriesId = '73067';
    utils.getSeriesInfo(function(err, result) {
      if (err) throw err;

      var regexp = new RegExp('^(?:(.+?)[ \\._\\-])?\\[?\\(?[Ss]([0-9]+)[ ]?[\\._\\- ]?[ ]?[Ee]?([0-9]+)\\)?\\]?[^\\/]*$');
      async.forEachSeries(cache, function(row, next) {
        /*
        var title = /(?:Good Eats)(?:(?:\s+\-\s+)([^\(]+)\(([^\)]+))?/.exec(row.source);
        if (title && title[1]) {
          var levs = [], str_nears, obj_nears;
          title = title[1];

          // calculate all the levenshtein
          _.each(result.episodes, function(episode) {
            var left = ( episode.EpisodeName || '' ).toLowerCase(),
                right = ( title || '' ).toLowerCase(),
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

            str_nears.push('Continue without renaming');
            obj_nears.push({});

            _.each(levs, function(obj) {
              if ( Math.abs(obj.lev - lev_val) < 6) {
                str_nears.push('Lev: ' + obj.lev + ', ' + obj.episode + ', EpisodeName: ' + obj.episode.EpisodeName);
                obj_nears.push(obj);
              }
            });

            console.log('Choose the closest match: [ "' + title + '" ]');
            program.choose(str_nears, function(i) {
              if (i === 0) {
                verbose('You chose to continue');
                next();
              } else {
                var episode = obj_nears[i].episode || {};
                verbose('You chose %d "%s"', i, episode.EpisodeName);

                //var updateSql = 'UPDATE recipe SET source="Good Eats", publication_page="'+ episode.EpisodeName + ' - ' + episode.toEpiSeaString() + '" WHERE recipe_id="' + row.id + '"';
                var updateSql = 'UPDATE recipe SET name="' + episode.toEpiSeaString() + ' - ' + row.name + '" WHERE recipe_id="' + row.id + '"';
                //console.log(updateSql);
                db.exec(updateSql, next);
              }
            });
          } else {
            next();
          }

        } else {
          next();
        }
        */

        var title = regexp.exec(row.pub);
        var rowName = (row.name || '').replace(/"/g,'""')
        if (title && title[2] && title[3]) {
          var updateSql = 'UPDATE recipe SET name="S' + title[2] + 'E' + title[3] + ' - ' + rowName + '" WHERE recipe_id="' + row.id + '"';
          db.exec(updateSql, next);
          //console.log(updateSql);
          next();

        } else {
          console.log('not able to find: ' + row.pub);
          next();
        }
      },
      function(data) {
        verbose('all done');
        process.stdin.destroy();
      });
    }, seriesId);

  });
});

