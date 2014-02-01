// Nodejs libs.
var async = require('async'),
    nodeUtil = require('util'),
    plist = require('plist'),
    fs = require('fs'),
    pluralize = require('pluralize'),
    path = require('path'),
    http = require('http'),
    URL = require('url');

var main = require('../main'),
    log = main.log;

var entities = require('./entities');

// The module to be exported.
var util = module.exports = {};

// External libs.
var _ = util._ = require('underscore');

// Mixin Underscore.string methods.
_.str = require('underscore.string');
_.mixin(_.str.exports());

// The line feed char for the current system.
util.linefeed = process.platform === 'win32' ? '\r\n' : '\n';

// Normalize linefeeds in a string.
util.normalizelf = function(str) {
  return str.replace(/\r\n|\n/g, util.linefeed);
};

util.remove = function(array, from, to) {
  var rest = array.slice((to || from) + 1 || array.length);
  array.length = from < 0 ? array.length + from : from;
  return array.push.apply(array, rest);
};

var strcmp = util.strcmp = function( str1, str2 ) {
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

util.calcPadding = function(num, minLen) {
  if (_.isNumber(num)) {
    num = num.toString();
  }
  var minLen = 2,
      padding = '',
      len = num.length;

  if (len > minLen) {
    minLen = len;
  }
  for(var i=0; i<minLen;i++) {
    padding += '0';
  }
  return {
    len:(-1 * minLen),
    padding:padding
  };
};

var degreeRe = /(\d+\s)degree(?:s)?(?:\sf)?/gi; // 160 degrees F -> 160°F
util.substituteDegree = function(str) {
  if (!str) { return ''; }
  return str.replace(degreeRe, function(str, p1, offset, s) {
    // '350 degree F for 30 minutes' -->
    // ["350 degree F", "350 ", 0, "350 degree F for 30 minutes"]
    //if (!p1) { console.log(arguments); exit(1);}
    return p1.trim() + '°F';
  });
};

var _fractions = {
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

var fractionRe = /((?:\d+) )?((?:\d)\/(?:\d))/g;
util.substituteFraction = function(str) {
  if (!str) {return '';}
  var findFraction = function(str) {
    if (_fractions[str]) {
      return _fractions[str];
    } else {
      return str;
    }
  };
  return str.replace(fractionRe, function(str, p1, p2, offset, s) {
    // '15 1/2, 6 3/4 1/2 andrew' -->
    // ["15 1/2", "15 ", "1/2", 0, "15 1/2, 6 3/4 1/2 andrew"]
    // ["6 3/4", "6 ", "3/4", 8, "15 1/2, 6 3/4 1/2 andrew"]
    // ["1/2", undefined, "1/2", 14, "15 1/2, 6 3/4 1/2 andrew"]

    var fraction = findFraction(p2);
    if (p1) {
      return p1.trim() + fraction;
    }
    return fraction;
  });
};

var writePlist = util.writePlist = function(callback, obj, output) {
  var data = exportToPlist(obj);
  fs.writeFile(output, data, function (err) {
    if (err) { callback(err); }
    callback(null, 'successfully saved file to ' + output);
  });
};

var exportToPlist = function(obj) {
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

util.expandHomeDir = function(dir){
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

// unescape regex cache
var unescapeRegexCache = {};

util.unescape = function(str) {
  str = str || '';
  var mapping = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x60;': '`',
    '&amp;' : '&',
    '&frasl;' : '/',
    '&mdash;': '—'
  };
  _.each(mapping, function(value, key) {
    var re;
    if (!unescapeRegexCache[key]) {
      re = new RegExp(key, 'gi');
      unescapeRegexCache[key] = re;
    } else {
      re = unescapeRegexCache[key];
    }
    str = str.replace(re,value);
  });
  return str;
};

util.descSortByStr = function(obj, val, context) {
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


// returns text immediately inside the selected element
var rawtext = util.rawtext = function(elem) {
  var text = '',
      child,
      children;

  if (_.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === 'text') {
        text += child.data;
      }
    }
  }
  return text;
};

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// text($('a'))
//   => outputs 'Hello'
//
// outputs the text DIRECTLY inside the tag. like rawtext but BR's
// replaced with \n, and entities decoded
var text = util.text = function(elem) {
  var text = '',
      child,
      children;

  if (_.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.name === 'br') {
        text += '\n';
      }
    }
  }
  return entities.decode(text);
};

// same as rawtext, but also includes text inside nested elems
var striptags = util.striptags = function(elem) {
  var text = '',
      child,
      children;

  if (_.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.type === 'tag') {
        text += striptags(child);
      }
    }
  }
  return text;
};

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// fulltext($('a'))
//   => outputs 'Hello World!'
//
// outputs the text inside the tag including the text inside of each nested
// tag. BR's replaced with \n, and entities decoded;
var fulltext = util.fulltext = function (elem) {
  var text = '',
      child,
      children;

  if (_.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.name === 'br') {
        text += '\n';
      } else if (child.type === 'tag') {
        text += fulltext(child);
      }
    }
  }

  return entities.decode(text);
};

// http://stackoverflow.com/questions/6970221/parsing-css-background-image
var token = /((?:[^"']|".*?"|'.*?')*?)([(,)]|$)/g;
var splitCSS = util.splitCSS = function(string) {
  return (function recurse () {
    for (var array = [];;) {
      var result = token.exec(string);
      if (result[2] === '(') {
        array.push(result[1].trim() + '(' + recurse().join(',') + ')');
        result = token.exec(string);
      } else {
        array.push(result[1].trim());
      }
      if (result[2] !== ',') {
        return array;
      }
    }
  })();
};

var whiteSpaceRe = /\s{2,}/g;
util.trimMultipleWhiteSpace = function(text) {
  return text.replace(whiteSpaceRe, ' '); // replace extra spaces with one
};

// http://stackoverflow.com/questions/273789
util.regexIndexOf = function(str, regex, startpos) {
  var indexOf = str.substring(startpos || 0).search(regex);
  return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
};

var _altMeasurementTerms = [
  'bag',
  'can'
];

util.altMeasurementTerms = _.union(_altMeasurementTerms, _.map(_altMeasurementTerms, function(term) {
  return pluralize.plural(term);
})).sort();

util.saveIngredients = function(items, fileName) {
  var data = require(fileName);
  _.each(items, function(item) {
    _.each(item.saveIngredients, function(ingredient) {
      data.push(ingredient);
    });
    fs.writeFileSync(fileName, 'module.exports = '
                     + JSON.stringify(data, null, 2) + ';');
  });
};

var downloadImage = util.downloadImage = function(src, callback) {
  if (src.indexOf('//') === 0) {
    src = src.replace('//', 'http://');
  }
  var oURL = URL.parse(src);
  var request = http.request({
    port: 80,
    host: oURL.hostname,
    method: 'GET',
    path: oURL.pathname
  });

  request.end();
  request.on('response', function (response) {
    var type = response.headers['content-type'],
    prefix = 'data:' + type + ';base64,',
    body = '';

    response.setEncoding('binary');
    response.on('end', function () {
      var base64 = new Buffer(body, 'binary').toString('base64');
      callback(null, base64);
    });
    response.on('data', function (chunk) {
      if (response.statusCode === 200) {
        body += chunk;
      }
    });
  });
};

// collate all images
util.collateAllImages = function(items) {
  var images = [];
  _.each(items, function(item) {
    if (item.image && item.image.src) {
      images.push(item.image);
    }
    if (item.asideNotes && item.asideNotes.length) {
      _.each(item.asideNotes, function(asideNote) {
        _.each(asideNote.notes, function(note) {
          images.push(note.image);
        });
      });
    }
    if (item.procedures && item.procedures.length) {
      _.each(item.procedures, function(procedure) {
        images.push(procedure.image);
      });
    }
  });
  return images;
};

// download all images
util.downloadAllImages = function(images, callback) {
  async.forEach(images, function(image, done) {
    if (image.src) {
      downloadImage(image.src, function(err, base64) {
        if (!err) {
          console.log('Downloaded: ' + image.src);
        }
        image.data = base64;
        done();
      });
    } else {
      done();
    }
  }, callback);
};

