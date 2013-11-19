(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  var async = require('async'),
    fs = require('fs'),
    _ = require('underscore'),
    plist = require('plist'),
    util = require('util'),
    http = require('http'),
    URL = require('url'),
    path = require('path'),
    events = require('events'),
    exec = require('child_process').exec;

  // Create a safe reference to the Underscore object for use below.
  var Utils = function(obj) {
    if (obj instanceof Utils) return obj;
    if (!(this instanceof Utils)) return new Utils(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `Utils` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Utils;
    }
    exports.utils = Utils;
  } else {
    root.Utils = Utils;
  }

  // Current version.
  Utils.VERSION = '0.1';

  var trimCommaSpaceTheOrA = function(name){
    var exact_name = name.split(', The');
    if (exact_name.length > 1) {
      exact_name = 'The ' + exact_name[0];
    } else {
      // it did not split b/c it was not found at end
      exact_name = exact_name[0];
      // retry with trying to find A at the end
      // TODO: check for ', An' at end
      exact_name = exact_name.split(', A');
      if (exact_name.length > 1) {
        exact_name = 'A ' + exact_name[0];
      } else {
        // again, it was not found so reset
        exact_name = exact_name[0];
      }
    }

    // trim spaces
    exact_name = exact_name.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

    lookForTheAtEnd = exact_name.match(/ The$/);
    if (lookForTheAtEnd) {
      exact_name = "The " + exact_name.substr(0, exact_name.length - 4);
    }
    return exact_name;
  };

  var readPlist = function(callback, path) {
    async.series([
      function(callback) {
        path = path || '';
        var safe_path = path.replace(' ', '\\ ');

        try {
          // Query the entry
          var stats = fs.lstatSync(path);

          if (stats.isFile()) {
            exec('plutil -convert xml1 ' + safe_path,
              function (err, stdout, stderr) {
                if (err) { callback(err); }
                callback(null);
            });
          }
        }
        catch (e) {
          callback(e);
        }
      },
      function(callback){
        plist.parseFile(path, function(err, obj) {
          if (err) { callback(err); }
          callback(null, obj);
        });
      },
    ],
    function(err, results){
      if (err) { callback(err); }
      if (results.length > 1) {
        callback(null, results[1]);
      }
    });
  };

  var strcmp = function( str1, str2 ) {
    // http://kevin.vanzonneveld.net
    // +   original by: Waldo Malqui Silva
    // +      input by: Steve Hilder
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    revised by: gorthaur
    // *     example 1: strcmp( 'waldo', 'owald' );
    // *     returns 1: 1
    // *     example 2: strcmp( 'owald', 'waldo' );
    // *     returns 2: -1

    return ( ( str1 === str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
  };

  var calcPadding = function(num) {
    var min_len = 2,
        padding = "",
        len = num.toString().length;

    if (len > min_len) {
      min_len = len;
    }
    for(var i=0; i<min_len;i++) {
      padding += "0";
    }
    return {
      len:(-1 * min_len),
      padding:padding
    }
  };

  var escapeRegExp = function(str){
    if (str == null) return '';
    return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
  };

  var defaultToWhiteSpace = function(characters) {
    if (characters == null)
      return '\\s';
    else if (characters.source)
      return characters.source;
    else
      return '[' + escapeRegExp(characters) + ']';
  };

  var re = /((?:\d+)\/(?:\d+))/g;
  var fractions = {
    '1/4': '¼',
    '1/2': '½',
    '3/4': '¾',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞',
  };

  Utils.substituteFraction = function(str) {
    if (str == null) return '';
    return str.replace(re, function(str, p1, offset, s) {
      var p2 = Utils.trim(p1);

      if (fractions[p2]) {
        return fractions[p2];
      } else {
        return p1;
      }
    });
  };

  Utils.trim = function(str, characters) {
    if (str == null) return '';
    characters = defaultToWhiteSpace(characters);
    return String(str).replace(new RegExp('\^' + characters + '+|' + characters + '+$', 'g'), '');
  };

  Utils.handleYear = function(year) {
    // Handle two-digit years with heuristic-ish guessing
    // Assumes 50-99 becomes 1950-1999, and 0-49 becomes 2000-2049
    // ..might need to rewrite this function in 2050, but that seems like
    // a reasonable limitation
    year = parseInt(year, 10);

    // No need to guess with 4-digit years
    if ( year > 999 ) {
      return year;
    }
    if ( year < 50 ) {
      return 2000 + year;
    }
    return 1900 + year;
  };

  Utils.cleanRegexedSeriesName = function(seriesname) {
    // Cleans up series name by removing any . and _
    // characters, along with any trailing hyphens.

    // Is basically equivalent to replacing all _ and . with a
    // space, but handles decimal numbers in string, for example:

    // >>> cleanRegexedSeriesName("an.example.1.0.test")
    // 'an example 1.0 test'
    // >>> cleanRegexedSeriesName("an_example_1.0_test")
    // 'an example 1.0 test'
    seriesname = seriesname
      .replace(/(\D)[.](\D)/g, '$1 $2')
      .replace(/(\D)[.]/g, '$1 ')
      .replace(/[.](\D)/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/-$/, '')
      .replace(/^\s\s*/, '')
      .replace(/\s\s*$/, '');

    return seriesname;
  };

  Utils.readPlists = function(callback) {
    async.parallel({
      userPrefs: function(callback) {
        var user_prefs_file = utils.expandHomeDir("~/Library/Preferences/net.sourceforge.tvshows.plist");
        readPlist(function(err, data) {
          //if (err) { callback(err); }
          if (err) {
            callback(null, {});
          }
          else if (data) {
            if (data.length > 0) {
              callback(null, data[0]);
            } else {
              callback(null, data);
            }
          }
        }, user_prefs_file);
      },
      showDb: function(callback) {
        var tv_shows_db = utils.expandHomeDir("~/Library/Application Support/TVShows/TVShows.plist");
        readPlist(function(err, data) {
          //if (err) { callback(err); }
          if (err) {
            callback(null, {});
          }
          else if (data) {
            if (data.length > 0) {
              data = data[0];
            }

            // We will use showId(s) from eztv if all the subscribed shows
            // have showId(s) and all the scrubbed episodes from eztv have them.
            var shows = data.Shows || [],
                parsed_shows = [];

            // Go through each Show from Shows and
            // instantiate it into an Episode derivative
            shows.forEach(function(show) {
              utils.parseShow(function(err, episode) {
                if (err) { console.log(err); }
                else {
                  parsed_shows.push(episode);
                }
              }, show);
            });
            data.Shows = parsed_shows;
            callback(null, data);
          }
        }, tv_shows_db);
      }
    },
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
  };

  Utils.writePlist = function(callback, obj, output) {
    var data = Utils.exportToPlist(obj);
    fs.writeFile(output, data, function (err) {
      if (err) { callback(err); }
      callback(null, 'successfully saved file to ' + output);
    });
  };

  Utils.exportToPlist = function(obj) {
    var headers = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">'
    ];

    var data =
      headers.join('\n') +
      plist.stringify(obj) +
      '\n</plist>';

    return data;
  };

  Utils.expandHomeDir=function(dir){
    dir = dir || '';
    if (dir.indexOf('~') === 0) {
      var home = process.env.HOME;
      var splits = dir.split('~');

      if (splits.length > 0){
        dir = home + splits[1];
      } else {
        dir = home;
      }
    }
    return dir;
  };

  Utils.levenshtein = function(left, right) {
    var cost = [],
        str1 = left || '',
        str2 = right || '',
        n = str1.length,
        m = right.length,
        i, j;

    var minimum = function(a,b,c) {
      var min = a;
      if(b < min) {
        min = b;
      }
      if(c < min) {
        min = c;
      }
      return min;
    };

    if(n === 0) {
      return;
    }
    if(m === 0) {
      return;
    }
    for(i=0;i<=n;i++) {
      cost[i] = [];
    }
    for(i=0;i<=n;i++) {
      cost[i][0] = i;
    }
    for(j=0;j<=m;j++) {
      cost[0][j] = j;
    }
    for(i=1;i<=n;i++) {
      var x = str1.charAt(i-1);
      for(j=1;j<=m;j++) {
        var y = str2.charAt(j-1);
        if(x === y) {
          cost[i][j] = cost[i-1][j-1];
        } else {
          cost[i][j] = 1 + minimum(cost[i-1][j-1], cost[i][j-1], cost[i-1][j]);
        }
      }
    }

    return cost[n][m];
  };

  Utils.unescape = function(str) {
    str = str || '';
    var mapping = {
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x60;': '`',
      '&amp;' : '&',
      '&mdash;': '—'
    };
    _.each(mapping, function(value, key) {
      var re;
      if (!unescape_regex_cache[key]) {
        re = new RegExp(key, 'gi');
        unescape_regex_cache[key] = re;
      } else {
        re = unescape_regex_cache[key];
      }
      str = str.replace(re,value);
    });
    return str;
  };

  Utils.descSortByStr = function(obj, val, context) {
    // http://stackoverflow.com/questions/5013819/reverse-sort-order-with-backbone-js
    //
    // The Underscore.js method _.sortBy ends up "wrapping" up javascript
    // .sort() in a way that makes sorting strings in reverse difficult. Simple
    // negation of the string ends up returning NaN and breaks the sort.
    //
    // If you need to perform a reverse sort with Strings, such as reverse
    // alphabetical sort, here's a really hackish way of doing it:

    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    return _.sortBy(obj, function(item) {
      var str = iterator.call(context, item);
      str = str.toLowerCase();
      str = str.split('');
      str = _.map(str, function(letter) {
        return String.fromCharCode(-(letter.charCodeAt(0)));
      });
      return str;
    });
  };


}).call(this);


var Utils = function(){};
Utils.prototype = {
};
var utils = new Utils();
exports.utils = utils;

