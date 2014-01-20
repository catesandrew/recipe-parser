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

