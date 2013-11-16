/*
 * This script downloads a list of torrents from a list
 * of given episodes for a particular show.
 * 3) This is called with a chosen episode from the list
 *    of available episodes from 'get-show-details' and then
 *    all the episode(s) torrent files are downloaded.
 */
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
  .description('Get a list of available episodes to download from eztv')
  .option('-s, --show-id <id>', 'eztv show id')
  .option('-f, --file-name <string>', 'an arbitrary filename, used to parse a show from')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) { 
    console.log.apply(null, arguments);
  }
};

var size_re = new RegExp(".*\\(([0-9]+?[.][0-9]+? [MG]B)\\)$");
var scrapeEZTV = function(_callback, showId) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/shows/' + showId + '/', function(err, $) {
        var episodes = [], downloads, anchor, td, torrent, 
            i, l, size_matches, size, torrents;
        $(".forum_header_noborder tr.forum_header_border").each(function(tr) {
          // reset vars
          torrents = []; 
          size = null;
          
          // torrent download links
          td = $('td', tr);
          if (td && td.length > 1) {
            td = td[2];
            downloads = $('a', td);
            for(i = 0, l = downloads.length; i < l; i++) {
              var download = downloads[i];
              torrent = download.attribs.href || "";
              if (torrent.indexOf("magnet") === 0) {
                continue;
              }
              torrents.push(utils.unescape(torrent));
            }
          }

          anchor = $('.forum_thread_post .epinfo', tr);
          // size 
          size_matches = anchor.attribs.title.match(size_re);
          if (size_matches && size_matches.length > 0) {
            size = size_matches[1];
          }
          
          episodes.push({
            href: anchor.attribs.href,
            text: anchor.fulltext,
            showId: showId,
            size: size,
            torrents: torrents
          });

        });
        this.emit(episodes);
      });
    },
    reduce:function(episodes) {
      var emits = [];
      episodes.forEach(function(episode) {
        utils.parseFile(function(err, episode_info) {
          if (err) { 
            console.error(err);
            //_callback(err); 
          }
          else {
            episode_info.showId = episode.showId;
            episode_info.torrents = episode.torrents;
            // Don't think we need this, remove if not
            //episode_info.size = episode.size;
            emits.push(episode_info);
          }
        }, episode.text);
      });
      this.emit(emits);
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

var readPlistsAndScrapeEZTV = function(callback, showId, fileName) {
  async.parallel({
      plists: function(callback) {
        utils.readPlists(function(err, plist) {
          if (err) { callback(err); }
          callback(null, plist);
        });
      },
      episodes: function(callback) {
        scrapeEZTV(function(err, episodes) {
          if (err) { callback(err); }
          callback(null, episodes);
        }, showId);
      },
      episode: function(callback) {
        utils.parseFile(function(err, episode_info) {
          if (err) { 
            console.error(err);
          }
          else {
            episode_info.showId = showId;
            callback(null, episode_info);
          }
        }, fileName);
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

if (program.showId && program.fileName) {
  var showId = program.showId,
      fileName = program.fileName;

  readPlistsAndScrapeEZTV(function(err, data) {
    if (err) { console.log(err); }

    verbose('---- Incoming Shows ----');
    _.each(data.episodes, function(episode) {
      verbose("ShowId: " + episode.showId + ", Size: " + episode.size);
      verbose(episode.toString());
    });
    //verbose('---- Known Shows ----');
    //_.each(data.plists.showDb.Shows, function(episode) {
      //verbose("ShowId: " + episode.showId);
      //verbose(episode.toString());
    //});
    verbose('---- Incoming Show ----');
    verbose("ShowId: " + data.episode.showId);
    verbose(data.episode.toString());
    
    // use show ids
    // 1) build table of showId to subscribed shows
    var known_shows = {};      // all of the known episodes
    var known_episodes = data.plists.showDb.Shows || [];
    _.each(known_episodes, function(known_episode, index) {
      var key = known_episode.showId;
      known_shows[key] = known_episode;
    });

    // locate known show
    var known_show = known_shows[showId];
    if (!known_show) {
      console.log("Show not found in list, update list of shows first!");
      process.exit();
    }

    // 2) group all similar eipsodes by 
    //   seriesname, seasonnumber, episodenumbers OR
    //   seriesnname, episodenumbers OR
    //   seriesname, episodenumbers OR
    var grouped_episodes = _.groupBy(data.episodes, function(episode) {
      return episode.toString();
    });
    
    // 3) Group all show ids from episodes. Now for any given showId 
    // we will have a list of list of episodes, or loloepisodes.
    // This is because we can multiple episodes for a showId, and 
    // each of those can have multiple qualities.
    //  
    // ShowId: 433
    // [ [ { seriesname: 'Episodes',
    //       seasonnumber: 2,
    //       episodenumbers: [7],
    //       filename: 'Episodes S02E07 CONVERT HDTV x264-TLA',
    //       showId: '433',
    //       size: '136.06 MB',
    //       torrents: [...] },
    //     { seriesname: 'Episodes',
    //       seasonnumber: 2,
    //       episodenumbers: [7],
    //       filename: 'Episodes S02E07 720p EZTV-UK',
    //       showId: '433',
    //       size: '836.06 MB',
    //       torrents: [...] } ],
    //   [ { seriesname: 'Episodes',
    //       seasonnumber: 2,
    //       episodenumbers: [8],
    //       filename: 'Episodes S02E08 CONVERT HDTV x264-TLA',
    //       showId: '433',
    //       size: '132.33 MB',
    //       torrents: [...] } ] ]
    //   
    var loloepisodes = _.groupBy(grouped_episodes, function(group) {
      return group[0].showId;
    });

    // Sort the episodes in ascending order so it looks like this afterwards
    //
    // ShowId: 244
    // [ [ { seriesname: 'The Sci Fi Guys',
    //       seasonnumber: 5,
    //       episodenumbers: [Object],
    //       filename: 'The Sci Fi Guys S05E13 ClawsCosplay Challenge-SCIFIGUYS',
    //       showId: '244',
    //       size: '126.06 MB',
    //       torrents: [Object] } ],
    //   [ { seriesname: 'The Sci Fi Guys',
    //       seasonnumber: 5,
    //       episodenumbers: [Object],
    //       filename: 'The Sci Fi Guys S05E14 TheGooch Cookie-SCIFIGUYS',
    //       showId: '244',
    //       size: '117.09 MB',
    //       torrents: [Object] } ],
    //   [ { seriesname: 'The Sci Fi Guys',
    //       seasonnumber: 5,
    //       episodenumbers: [Object],
    //       filename: 'The Sci Fi Guys S05E15 TheHunger Games-SCIFIGUYS',
    //       showId: '244',
    //       size: '89.88 MB',
    //       torrents: [Object] } ] ]
    //
    _.each(loloepisodes, function(value, key ,list) {
      var result = _.sortBy(value, function(list) {
        return list[0].toString();
      });
      loloepisodes[key] = result; 
    });
    var keys = _.keys(loloepisodes);
    _.each(keys, function(key, index) {
      verbose("ShowId: " + key);
      verbose(loloepisodes[key]);
    });
    
    // 4) Go through all episodes, using showId of
    // the episode and see if its in the subscribed 
    // shows table. 
    var torrent_dir = data.plists.userPrefs.TorrentFolder;
    var loloepisode = loloepisodes[showId];
    if (loloepisode) {
      // Do the magic here. We found a possible 
      // show to download that has been subscribed to.
      verbose('Found show ' + showId + ', in lolo episodes');
      async.forEachSeries(loloepisode, function(loepisode, innerCb) {
        // for now, just use the first one, who cares about
        // getting the highest quality available.
        var incoming_episode = loepisode[0];

        if (incoming_episode.compare(data.episode) >= 0) {
          // the incoming_episode is newer than the latest known show
          
          if (utils.isNoEpisodeInfo(known_show)) {
            // copy over everything from known show into incoming episode
            // but not seasonnumber, episodenumbers, etc...
            var mappings = ['seriesname', 'seasonnumber', 'group',
                'episodenumbers', 'year', 'month', 'day', 'showId',
                'filename', 'torrents'];

            var knownKeys = _.keys(known_show);
            _.each(knownKeys, function(key) {
              if (_.indexOf(mappings, key) < 0) { // its not in there
                utils.copyTo(key, key, incoming_episode, known_show);
              }
            });
            
            // download
            var torrents = incoming_episode.torrents;
            // some of the things we know come with incoming_episode
            // that we don't want to store into known show
            delete incoming_episode.torrents;
            delete incoming_episode.size;
            delete incoming_episode.filename;
            
            verbose('Processing ' + incoming_episode.toString());
            utils.downloadTorrents(function(err, data) {
              if (err) {
                // should we update the show info?
                verbose("Error: " + err);
                
                innerCb(); // advance to the next loepisode 
              } else {
                verbose("Success: " + data);
                
                // replace known show with incoming episode
                known_shows[showId] = incoming_episode;
                // subscribe to the show
                known_shows[showId].subscribed = true;

                innerCb(); // advance to the next loepisode
              }
            }, torrents, torrent_dir);
          } 
          else {
          
            // download
            verbose('Processing ' + incoming_episode.toString());
            utils.downloadTorrents(function(err, data) {
              if (err) {
                // should we update the show info?
                verbose("Error: " + err);

                innerCb();// advance to the next loepisode 
              } else {
                verbose("Success: " + data);

                // update known_show to latest version
                known_show.updateTo(incoming_episode);
                // subscribe to the show
                known_show.subscribed = true;

                innerCb(); // advance to the next loepisode 
              }
            }, incoming_episode.torrents, torrent_dir);
          }
        }
        else {
          innerCb(); // advance
        }
      },
      function(data) {
        // 5) save the updated known shows list 
        var shows = [];
        _.each(known_shows, function(value, key, list) {
          shows.push(value.toPlist());
        });
        shows = _.sortBy(shows, function(show) { 
          return show.HumanName; 
        });

        var plist_file = utils.expandHomeDir("~/Library/Application Support/TVShows/TVShows.plist");
        utils.writePlist(function(err, obj) {
          if (err) { console.error(err); }
          }, { "Shows": shows, "Version": "1" }, plist_file
        );
      });
    } 

  }, showId, fileName);
}
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
