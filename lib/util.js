'use strict';

// Nodejs libs.
var nodeUtil = require('util'),
    path = require('path');

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
}

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
    min_len = len;
  }
  for(var i=0; i<minLen;i++) {
    padding += '0';
  }
  return {
    len:(-1 * minLen),
    padding:padding
  }
};

var degreeRe = /(\d+\s)degree(?:s)?\s(?:f)/gi; // 160 degrees F -> 160°F
util.substituteDegree = function(str) {
  if (str == null) return '';
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
  if (str == null) return '';
  var findFraction = function(str) {
    if (_fractions[str]) {
      return _fractions[str];
    } else {
      return str;
    }
  }
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

