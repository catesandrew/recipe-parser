/*
 * This script downloads the shows from eztv.it/showlist/
 * Its used in conjunction with tvshows app to update your show list.
 * 1) This is called first to get available shows.
 */
var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , program = require('commander')
  , nodeio = require('node.io');

var utils = require('./utils.js').utils;

program
  .version('0.1')
  .description( "This script downloads the shows from eztv.it/showlist/" )
  .option('-t, --tv-shows [file]', 'optional destination file to save tvshows plist to', '~/Library/Application Support/TVShows/TVShows.plist')
  .option('-d, --debug', 'output extra debug information');

program.on('--help', function(){
  console.log(program.description());
});

program.parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

var scrapeEZTV = function(_callback) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/showlist/', function(err, $) {
          var shows = [], href, matches;
          $("tr[name]").each(function(tr) {
            var anchor = $('.thread_link', tr);
            var font = $('.forum_thread_post font', tr);
            shows.push({
              href:anchor.attribs.href,
              text:anchor.fulltext,
              status:font.fulltext
            });
          });
          this.emit(shows);
      });
    },
    reduce:function(shows) {
      var emit = [], href, matches, obj;
      shows.forEach(function(show) {
        matches = show.href.match(/\/shows\/([0-9]+)\/([0-9a-zA-Z\-]+)/);
        // create a show
        obj = {
          ShowId: matches[1],
          HumanName: show.text,
          Status: show.status,
          Subscribed: false,
          ExactName: utils.buildExactNameForBackwardsCompatibility(show.text)
        };
        // parse it into an Episode derivative
        utils.parseShow(function(err, episode) {
          if (err) { console.error(err); }
          else {
            emit.push(episode);
          }
        }, obj);
      });
      this.emit(emit);
    },
    complete: function(callback) {
      callback();
    }
  };

  var job = new nodeio.Job({auto_retry:true, timeout:10, retries:3}, methods);
  nodeio.start(job, {}, function(err, data) {
    if (err) { callback(err); }
    _callback(null, data);
  }, true);
};

var readPlistsAndScrapeEZTV = function(callback) {
  async.parallel({
      shows: function(callback) {
        scrapeEZTV(function(err, shows) {
          if (err) { callback(err); }

          callback(null, shows);
        });
      },
      plists: function(callback) {
        utils.readPlists(function(err, plist) {
          if (err) { callback(err); }
          callback(null, plist);
        });
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

readPlistsAndScrapeEZTV(function(err, data) {
  if (err) { 
    console.error(err);
    process.exit();
  }
 
  var incoming_shows = {},
      known_shows = {};

  var shows = data.shows || [];
  shows.forEach(function(show) {
    key = utils.buildUniqueIdName(show.seriesname);
    incoming_shows[key] = show;
  });

  shows = data.plists.showDb.Shows || [];
  shows.forEach(function(show) {
    key = utils.buildUniqueIdName(show.seriesname);
    known_shows[key]= show;
  });

  shows = data.shows || [];

  // walk through incoming_shows and known_shows to see if any of
  // incoming_show's entries match ones from known_shows. 
  if (_.size(known_shows) > 0) {
    var shows_to_add = [];
    var keys = _.keys(incoming_shows);
    _.each(keys, function(key) {
      if (!known_shows[key]) {
        shows_to_add.push(incoming_shows[key]);
      } else {
        // Update known show's status
        var srcValue = incoming_shows[key].status;
        if (srcValue) {
          if (!_.isEmpty(srcValue)) {
            known_shows[key].status = srcValue;
          }
        }
      }
    });
    
    // drop the keys of known_shows and use it as an array
    known_shows = _.values(known_shows);

    // merge the shows_to_add to known_shows
    _.each(shows_to_add, function(show_to_add){
      known_shows.push(show_to_add);
    });
    // set shows to known_shows
    shows = known_shows;
  }

  shows = _.map(shows, function(show) {
    return show.toPlist();
  });

  shows = _.sortBy(shows, function(show) {
    return show.HumanName;
  });

  var save_these_shows = {
    "Shows": shows,
    "Version": "1"
  };

  var tv_shows_db = utils.expandHomeDir(program.tvShows);
  utils.writePlist(function(err, obj) {
    if (err) { console.error(err); }
    verbose(obj);
    
    }, save_these_shows, tv_shows_db
  );
});
