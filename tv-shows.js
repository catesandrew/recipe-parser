/*
 * This script is scheduled to run every X minutes looking
 * for new shows to the ones you have subscribed to.
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
  .description('Check for new available episodes from list of subscribed shows')
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

var show_id_re = new RegExp("\\/shows\\/(?:add\\/)?([0-9]+)\\/.*");
var size_re = new RegExp(".*\\(([0-9]+?[.][0-9]+? [MG]B)\\)$");
var scrapeEZTV = function(_callback) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/sort/50/', function(err, $) {
        var episodes = [], href, matches, show_id, 
            id_matches, downloads, anchor, td, torrent, 
            i, l, size_matches, size, torrents;
        $("tr.forum_header_border").each(function(tr) {
          // reset vars
          torrents = []; 
          show_id = null;
          size = null;

          // show id
          td = $('td', tr);
          if (td && td.length > 0) {
            td = td[0];
            anchor = $('a', td);
            if (anchor.length > 0) {
              anchor = anchor[0];
            }
            id_matches = anchor.attribs.href.match(show_id_re);
            if (id_matches && id_matches.length > 0) {
              show_id = id_matches[1];
            }
          }
          
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
            showId: show_id,
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
            episode_info.size = episode.size;
            episode_info.torrents = episode.torrents;
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

var readPlistsAndScrapeEZTV = function(callback) {
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
        });
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

var useShowIds = function(shows, episodes) { 
  shows = shows || [];
  episodes = episodes || [];
  var use_show_ids = true;
  var show, i, l, episode;
  for (i=0, l=shows.length; i<l; i++) {
    show = shows[i];
    if (!show.subscribed) {
      continue;
    }
    if (!show.showId) {
      use_show_ids = false;
      break;
    }
  }
  if (use_show_ids) {
    for(i=0, l=episodes.length; i<l; i++) {
      episode = episodes[i];
      if (!episode.showId) {
        use_show_ids = false;
        break;
      }
    }
  }
  return use_show_ids;
};

// launchd requires us to be alive for at least 10 seconds
var sleep = function(s) {
  var e = new Date().getTime() + (s * 1000);

  while (new Date().getTime() <= e) {
    ;
  }
};
sleep(10);

readPlistsAndScrapeEZTV(function(err, data) {
  if (err) { console.error(err); }

  verbose('---- Incoming Shows ----');
  _.each(data.episodes, function(episode) {
    verbose("ShowId: " + episode.showId + ", Size: " + episode.size);
    verbose(episode.toString());
    verbose(episode.torrents);
    verbose(episode.getepdata());
  });
  verbose('---- Known Shows ----');
  _.each(data.plists.showDb.Shows, function(episode) {
    verbose("ShowId: " + episode.showId);
    verbose(episode.toString());
    verbose(episode.torrents);
    verbose(episode.getepdata());
  });
  
  var known_episodes = data.plists.showDb.Shows || [];

  // We will use showId(s) from eztv if all the subscribed shows
  // have showId(s) and all the scrubbed episodes from eztv have them.
  var use_show_ids = useShowIds(known_episodes, data.episodes);
  verbose("Use show ids: " + use_show_ids);
                                          
  // save the latest incoming episodes from eztv
  //var bb = _.map(data.episodes, function(show) { return show.toPlist(); });
  //bb = _.sortBy(bb, function(show) { return show.HumanName; });
  //var save_these_shows = { "Shows": bb, "Version": "1" };
  //var home = process.env.HOME;
  //var latest_feed = home + "/Library/Application Support/TVShows/latest-feed.plist";
  //utils.writePlist(function(err, obj) {
    //if (err) { console.log(err); }
    //}, save_these_shows,latest_feed
  //);

  // use show ids
  // 1) build table of showId to subscribed shows
  var subscribed_shows = {}, // only the subscribred known episodes
      known_shows = {};      // all of the known episodes
  _.each(known_episodes, function(known_episode, index) {
    var key = known_episode.showId;
    known_shows[key] = known_episode;
    if (known_episode.subscribed) {
      subscribed_shows[key] = known_episode;
    }
  });
  verbose(subscribed_shows);

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
  var keys = _.keys(subscribed_shows);
  async.forEachSeries(keys, function(key, outerCb) {
    var loloepisode = loloepisodes[key];
    if (loloepisode) {
      // Do the magic here. We found a possible 
      // show to download that has been subscribed to.
      verbose('Found show ' + key + ', in lolo episodes');
      async.forEachSeries(loloepisode, function(loepisode, innerCb) {
        var known_show = known_shows[key];
        // for now, just use the first one, who cares about
        // getting the highest quality available.
        var incoming_episode = loepisode[0];

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

          verbose('downloading ' + incoming_episode.toString());
          utils.downloadTorrents(function(err, data) {
            if (err) {
              // should we update the show info?
              verbose("Error: " + data);

              // advance to the next loepisode
              innerCb();
            } else {
              verbose("Success: " + data);
              
              // replace known show with incoming episode
              known_shows[key] = incoming_episode;

              innerCb(); // advance to the next loepisode
            }
          }, torrents, torrent_dir);
        }
        else if (incoming_episode.compare(known_show) > 0) {
          // the incoming_episode is newer than the latest known show
          
          // download
          verbose('downloading ' + incoming_episode.toString());
          utils.downloadTorrents(function(err, data) {
            if (err) {
              // should we update the show info?
              verbose("Error: " + data);

              // advance to the next loepisode
              innerCb();
            } else {
              verbose("Success: " + data);

              // update known_show to latest version
              known_show.updateTo(incoming_episode);

              innerCb(); // advance to the next loepisode 
            }
          }, incoming_episode.torrents, torrent_dir);
        }
        else {
          innerCb(); // advance
        }
      },
      function(data) {
        outerCb(); // advance to the next key
      });

    } else {
      outerCb(); // advance to the next key
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

    var plist_file = utils.expandHomeDir(program.tvShows);
    utils.writePlist(function(err, obj) {
      if (err) { console.error(err); }
      }, { "Shows": shows, "Version": "1" }, plist_file
    );
  });


  // use unique names
  // build table of unique-name to subscribed shows,
  // go through all episodes, build unique name
  // for the episode's seriesname, and then use that
  // to check to see if its in the subscribed shows
  // table. 
  // -- 
  // group all similar eipsodes by 
  //   seriesname, seasonnumber, episodenumbers OR
  //   seriesnname, episodenumbers OR
  //   seriesname, episodenumbers OR
  // this is because a parsed episode can have multiple qualties
  // group all unique-names from episodes

});
