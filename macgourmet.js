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
  .description( "" )
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
  /*
  db.each('select * from item_list_join INNER JOIN recipe ON item_list_join.item_id = recipe.recipe_id where item_list_join.list_id = 26', function(err, row) {
    if (err) throw err;
    cache.push({
      id: row.recipe_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page
    });

  }, function(err, num) {
    if (err) throw err;

      async.forEachSeries(cache, function(row, next) {
        var source = row.source;
        if (source && source == 'n/a') {
          source = '';
        }
        if (source) {
          source = source.replace(/"/g, '""');
        }
        var updateSql = 'UPDATE recipe SET source="LA Times", publication_page="' + source + '" WHERE recipe_id="' + row.id + '"';
        db.exec(updateSql, next);
      },
      function(data) {
        verbose('all done..');
      });
  });
  */
  /*
  db.each('SELECT * FROM recipe INNER JOIN direction ON recipe.recipe_id = direction.recipe_id WHERE recipe.source LIKE "LA Times"', function(err, row) {
    if (err) throw err;
    cache.push({
      recipeId: row.recipe_id,
      directionId: row.direction_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page,
      text: row.directions_text
    });
  }, function(err, num) {
    if (err) {throw err; }
      // 'Source    :   blah blah blah'.match(/^(Source)(?:\s?)+:(?:\s?)+(.*)/)
      // '"The Los Angeles Times, 07-21-1999"'.match(/^(?:")(The Los Angeles Times, \d{2}-\d{2}-\d{4})(?:")/)
      var reg = new RegExp('^(Source)(?:\\s?)+:(?:\\s?)+(.*)'),
          reg2 = new RegExp('^(?:")(The Los Angeles Times, \\d{2}-\\d{2}-\\d{4})(?:")');

      _.each(cache, function(row) {
        var match = reg.exec(row.text),
            pub = row.pub;

        if (match) {
          var kind = match[1];

          var match2 = reg2.exec(match[2]);
          if (match2) {
            if (pub) {
              pub += ', ' + match2[1];
            } else {
              pub = match2[1];
            }
          } else {
            if (pub) {
              pub += ', ' + match[2];
            } else {
              pub = match[2];
            }
          }

          if (pub) {
            pub = pub.replace(/"/g, '""');
          }

          var updateSql = 'UPDATE recipe SET publication_page="' + pub + '" WHERE recipe_id="' + row.recipeId + '";';
          console.log(updateSql);
          var deleteSql = 'DELETE FROM direction WHERE direction_id="' + row.directionId + '";';
          console.log(deleteSql);
        }
      });
  });
  */
  /*
  db.each('SELECT * FROM recipe INNER JOIN recipe_note ON recipe.recipe_id = recipe_note.recipe_id WHERE recipe.source LIKE "LA Times"', function(err, row) {
    if (err) throw err;
    cache.push({
      recipeId: row.recipe_id,
      recipeNoteId: row.recipe_note_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page,
      text: row.note_text
    });

  }, function(err, num) {
    if (err) throw err;
    var reg = new RegExp('^(NOTES)(?:\\s?)+:(?:\\s?)+(.*)_{5}'),
        reg2 = new RegExp('^(Source)(?:\\s?)+:(?:\\s?)+(.*)');

    _.each(cache, function(row) {
      var match = reg.exec(row.text),
          pub = row.pub;

      if (match) {
        var text = match[2]; // strip NOTES and _____
        if (text) {
          text = text.replace(/"/g, '""');
        }

        var updateSql = 'UPDATE recipe_note SET note_text="' + text + '" WHERE recipe_note_id="' + row.recipeNoteId+ '";';
        console.log(updateSql);
      }
    });
  });
  */
  /*
  db.each('SELECT recipe_id, source, publication_page, name FROM recipe WHERE source LIKE "Cooking Light%"', function(err, row) {
    if (err) throw err;
    cache.push({
      recipeId: row.recipe_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page
    });

  }, function(err, num) {
    if (err) throw err;
      var reg = new RegExp('^(Cooking Light)(?:\\s?)+(?:,?)+(?:\\s?)+(.*)'),
          // ["Cooking Light",                    "Cooking Light", ""]
          // ["Cooking Light, Oct 1993, page 62", "Cooking Light", "Oct 1993, page 62"]
          reg2 = new RegExp('^(Source)(?:\\s?)+:(?:\\s?)+(.*)');

      _.each(cache, function(row) {
        var match = reg.exec(row.source),
            pub = row.pub,
            updateSql;

        if (match) {
          if (match.length > 2) {
            var text = match[2].replace(/"/g, '""');
            updateSql = 'UPDATE recipe SET source="Cooking Light", publication_page="' + text + '" WHERE recipe_id="' + row.recipeId+ '";';
          } else {
            // Just "Cooking Light"
            updateSql = 'UPDATE recipe SET source="Cooking Light" WHERE recipe_id="' + row.recipeId + '";';
          }

          console.log(updateSql);
        }
      });
  });
  */

  db.each('SELECT * FROM recipe INNER JOIN recipe_note ON recipe.recipe_id = recipe_note.recipe_id', function(err, row) {
    if (err) throw err;
    cache.push({
      recipeId: row.recipe_id,
      recipeNoteId: row.recipe_note_id,
      source: row.source,
      name: row.name,
      pub: row.publication_page,
      text: row.note_text
    });
  }, function(err, num) {
    if (err) { throw err; }
    var reg = new RegExp('^(NOTES)(?:\\s?)+:(?:\\s?)+(.*)_{5}', 'mi'),
        reg2 = new RegExp('(.*)_{5}$', 'mi'),
        reg3 = new RegExp('^(NOTES)(?:\\s?)+:(?:\\s?)+(.*)', 'mi');

    _.each(cache, function(row) {
      var match = reg.exec(row.text),
          pub = row.pub,
          text,
          updateSql;

      if (!match) {
        match = reg.exec(row.text.replace(/\n/m, ''));
      }

      if (match) {
        text = match[2]; // strip NOTES and _____
        if (text) {
          text = text.replace(/"/g, '""');
        }

        updateSql = 'UPDATE recipe_note SET note_text="' + text + '" WHERE recipe_note_id="' + row.recipeNoteId + '";';
        //console.log(updateSql);
      }

      var match2 = reg2.exec(row.text);
      if (match2) {
        //text = match2[1]; // strip _____
        text = row.text.replace('_____','')
        if (text) {
          text = text.replace(/"/g, '""');
        }

        updateSql = 'UPDATE recipe_note SET note_text="' + text + '" WHERE recipe_note_id="' + row.recipeNoteId + '";';
        //console.log(updateSql);
      }

      var match3 = reg3.exec(row.text);
      if (match3) {
        text = match3[2]; // strip NOTES
        if (text) {
          text = text.replace(/"/g, '""');
        }

        updateSql = 'UPDATE recipe_note SET note_text="' + text + '" WHERE recipe_note_id="' + row.recipeNoteId + '";';
        console.log(updateSql);
      }

    });
  });
});

