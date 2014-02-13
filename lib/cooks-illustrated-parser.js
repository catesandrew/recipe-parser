// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural'),
    RecipeParser = require('./base-recipe-parser'),
    nodePath = require('path');

var main = require('../main'),
    util = main.util,
    log = main.log,
    _ = util._;

//var endsWithItemRe = /(\s+from\s+(\d+|one|two|three|four|five|six)(\s+(?:small|medium|large))?\s+(?:lemon|lemons|lime|lemons))$/;
var endsWithItemRe = /(\s+from(\s+(?:about))?\s+((?:\d+|one|two|three|four|five|six)(\s+(?:-|–|to)\s+(?:\d+|one|two|three|four|five|six))?)(\s+(?:small|medium|large))?\s+(?:lemons?|limes?|apples?|medium sweet potatos?))$/;
var beginsWithXChickenY = /^((?:skinless|skin-on)\s+chicken\s+(?:breasts|thighs))(.*)$/;
var cloveGarlicRe = /^((cloves?)\s+garlic)(.*)$/;
var blackWhitePepperRe = /^(?:(black|white)\s+pepper)$/;
var parenthesesRe = /\(([^\)]*)\)/;
var groundRe = /^ground$/i;

var CooksIllustratedRecipeParser = module.exports = RecipeParser.extend({
  initialize: function() {
    RecipeParser.prototype.initialize.apply(this, arguments);
    this.set('dataFile', nodePath.resolve(__dirname + '/../test/data/cooks-illustrated.js'));
    this.on('description:strip-parentheses', this.postStripParentheses);
    this.on('description:split-on-and', this.postProcessSplitOnAnd);
    this.on('description:split-on-or', this.postProcessSplitOnOr);
    this.on('adjust:qty-desc-direc', this.adjustQtyDescriptionsDirections);

    this._words = [
      'chopped',
      'cracked',
      'finely',
      'fresh',
      'grated',
      'ground',
      'hard-cooked',
      'minced',
      'ripe',
      'shredded',
      'toasted'
    ];
  },
  postStripParentheses: function(parentheses, description, callback) {
    // remove the parentheses from the description
    return callback(null, {
      parentheses: parentheses,
      description: description.replace(parenthesesRe, '')
    });
  },
  postProcessSplitOnAnd: function(descriptions, callback) {
    var retval = descriptions;

    if (descriptions.length > 2) {
      // eg: 'hard-boiled eggs whites and yolks separated and pressed through a fine sieve'
      // [ 'hard-boiled eggs whites', 'yolks separated', 'pressed through a fine sieve' ]
      if (util.regexIndexOf(descriptions[1], /^yolks\s+separated$/, 0) >= 0
          && util.regexIndexOf(descriptions[2], /^pressed.*$/, 0) >= 0) {
        retval = [descriptions.join(' and ')];
      }
    }
    else if (descriptions.length > 1) {
      // eg: 'medium new potatoes boiled until tender and sliced thick'
      // [ 'medium new potatoes boiled until tender', 'sliced thick' ]
      if (util.regexIndexOf(descriptions[1], /^sliced\s+thick$/, 0) >= 0) {
        retval = [descriptions.join(' and ')];
      }
    }

    return callback(null, {
      descriptions: retval
    });
  },
  postProcessSplitOnOr: function(descriptions, parentheses, callback) {
    if (descriptions.length > 1) {
      // eg: 'medium clove garlic pressed through a garlic press or minced to paste'
      // [ 'clove garlic pressed through a garlic press', 'minced to paste' ]
      if (util.regexIndexOf(descriptions[1], /^minced\s+to\s+paste$/, 0) >= 0) {
        descriptions = [descriptions.join(' or ')];
        parentheses = undefined;
      }
      // eg: '3   ounces fresh strawberries (or thawed if frozen)'
      else if (util.regexIndexOf(descriptions[1], /^thawed\s+if\s+frozen/, 0) >= 0) {
        descriptions = [descriptions[0]];
        // do not kill the parentheses, lets keep em
      } else {
        parentheses = undefined;
      }
    }

    return callback(null, {
      parentheses: parentheses,
      descriptions: descriptions
    });
  },
  adjustQtyDescriptionsDirections: function(args, callback) {
    args || (args = {});
    var quantities = args.quantities,
        measurementObjs = args.measurementObjs,
        descriptionObj = args.descriptionObj,
        descriptions = descriptionObj.descriptions,
        directions = args.directions,
        measurementObj,
        measurement,
        direction,
        zipDesc,
        zipQty,
        zipDir,
        match;

    var retval = _.map(_.zip(descriptions, directions, quantities, measurementObjs), function(tuple) { //(value, key, list)
      zipDesc = tuple[0]; // string
      zipDir = tuple[1];  // properties: alt, direction
      zipQty = tuple[2];
      measurementObj = tuple[3];
      direction = zipDir.direction;
      measurement = measurementObj.matched;

      if (measurement === 'inch piece') {
        measurementObj.matched = zipQty + '-' + measurement;
        zipQty = '1';
      }

      // 3 (10-ounce) bags
      if (measurementObj.altMeasurement) {
        if (!zipQty) { zipQty = '1'; }
        zipQty = zipQty + ' (' + measurementObj.altMeasurement + ')';
      }

      // replace black pepper, freshly ground
      if (util.regexIndexOf(zipDesc, blackWhitePepperRe, 0) >= 0) {
        if (groundRe.test(direction)) {
          zipDir.direction = 'freshly ground';
        }
      }

      // replaces descriptions
      _.each(descriptionReplacements, function(item) {
        if (item.re.test(zipDesc)) {
          zipDesc = item.replacement;
        }
      });

      // replaces direction, or appends it or prepends it
      var array;
      _.each(descriptionMatches, function(descObj) {
        if (descObj.re.test(zipDesc)) {

          var matchReplace = function() {
            match = zipDesc.match(descObj.re);
            zipDesc = _.trim(zipDesc.replace(descObj.re, ''));

            //action: 'append', 'prepend', 'replace'
            array = [_.compact([descObj.prefix, _.trim(match[1]), descObj.suffix]).join(' ')];
            if (descObj.action === 'append') {
              array.push(zipDir.direction);
              zipDir.direction = _.compact(array).join(descObj.join);
            } else if (descObj.action === 'prepend') {
              array.unshift(zipDir.direction);
              zipDir.direction = _.compact(array).join(descObj.join);
            } else {
              zipDir.direction = _.first(array);
            }
          };

          if (descObj.dirRe) {
            if (descObj.dirRe.test(direction)) {
              matchReplace();
            }
          } else if (descObj.descRe) {
            if (descObj.descRe.test(zipDesc)) {
              matchReplace();
            }
          } else {
            matchReplace();
          }
        }
      });

      // `packed flat-leaf parsley leaf`
      // >> description 'flat-leaf parsley leaf'
      // >> direction 'packed, ...'
      // removes match from description, then appends it to beginning of direction
      _.each(beginsWithList, function(beginsWith) {
        if (beginsWith.re.test(zipDesc)) {
          match = _.map(zipDesc.match(beginsWith.re), function(str) {
            return _.trim(str);
          });
          zipDesc = match[2];
          zipDir.direction = _.compact([beginsWith.prefix, match[1], zipDir.direction, beginsWith.suffix]).join(', ');
        }
      });

      if (_.indexOf(['boneless', 'bone-in'], zipDesc.toLowerCase()) >= 0) {
        if (beginsWithXChickenY.test(direction)) {
          match = _.map(direction.match(beginsWithXChickenY), function(str) {
            return _.trim(str);
          });
          zipDir.direction = match[2];
          zipDesc = _.compact([zipDesc, match[1]]).join(', ');
        }
      }

      if (zipDesc.toLowerCase() === 'vegetable cooking spray') {
        log.warn('Vegetable Cooking Spray amongst ingredients');
      }

      if (cloveGarlicRe.test(zipDesc)) {
        match = _.map(zipDesc.match(cloveGarlicRe), function(str) {
          return _.trim(str);
        });
        zipDesc = _.compact([ 'garlic', match[2] ]).join(' ');
        zipDir.direction = _.compact([ zipDir.direction, match[3] ]).join(', ');
      }

      // 2 cans tomato sauce (8 ounces each)
      if (measurement) {
        if (_.indexOf(util.altMeasurementTerms, measurement.toLowerCase()) >= 0) {
          if (zipDir.alt) {
            if (!zipQty) { zipQty = '1'; }
            zipQty = zipQty + ' (' + zipDir.alt + ')';
            delete zipDir.alt;
          }
        }
      }

      return [ zipDesc, zipDir, zipQty ];
    });

    retval = _.zip.apply(_, retval);
    return callback(null, {
      descriptions: retval[0],
      directions: retval[1],
      quantities: retval[2]
    });
  }
});

var descriptionMatches = [
  {
    re: /((?:\s+plus\s+(?:extra|additional))?\s+for\s+(?:(dusting|drizzling|shaving|sprinkling)))$/
  },
  {
    re: /(\s+for\s+work\s+surface)$/
  },
  {
    re: /(\s+(?:crumbled|packed|minced))$/
  },
  {
    prefix: 'freshly squeezed',
    re: endsWithItemRe,
    join: ', ',
    action: 'append'
  },
  {
    re: /(\s+cut\s+into\s+(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|–|to)? *(?:inch|feet|meter)? *pieces?)$/
  },
  {
    re: /(\s+cut\s+into\s+wedges)$/
  },
  {
    re: /(\s+boiled.*)$/
  },
  {
    re: /(\s+separated\s+and\s+pressed.*)$/
  },
  {
    re: /(\s+pressed\s+through.*)$/
  },
  {
    re: /(\s+beaten\s+lightly.*)$/
  },
  {
    re: /(\s+(washed|chilled))$/,
    join: ', ',
    action: 'append'
  },
  {
    re: /(\s+cut\s+into\s+a\s+((small|medium|large)\s+)?dice)$/,
    join: ', ',
    action: 'append'
  }
];

var beginsWithList = [
  {
    re: /^(coarsely\s+chopped)(.*)$/
  },
  {
    re: /^((?:sifted|packed)\s+)(.*)$/
  },
  {
    prefix: 'thinly sliced',
    re: /^(?:thin-sliced)(\s+)(.*)$/
  }
];

var descriptionReplacements = [
  {
    re: /^salt$/i,
    replacement: 'kosher salt'
  },
  {
    re: /^table\s+salt$/i,
    replacement: 'table salt'
  }
];
