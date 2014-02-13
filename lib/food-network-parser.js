// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural'),
    BaseRecipeParser = require('./base-recipe-parser'),
    nodePath = require('path'),
    RecipeParser = require('../'),
    util = require('./util'),
    log = require('./log'),
    _ = util._;

var blackWhitePepperRe = /^(?:(black|white)\s+pepper)$/;
var parenthesesRe = /\(([^\)]*)\)/;
var groundRe = /^ground$/i;

var FoodNetworkRecipeParser = module.exports = BaseRecipeParser.extend({
  initialize: function() {
    BaseRecipeParser.prototype.initialize.apply(this, arguments);
    this.set('dataFile', nodePath.resolve(__dirname + '/../test/data/food-network.js'));
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
    var quantity = args.quantity,
        measurementObj = args.measurementObj,
        descriptionObjs = args.descriptionObjs,
        descriptions = args.descriptions,
        directions = args.directions,
        measurement = measurementObj.matched,
        direction,
        zipDesc,
        zipDir,
        match;

    if (measurement === 'inch piece') {
      measurementObj.matched = quantity + '-' + measurement;
      quantity = '1';
    }

    // 3 (10-ounce) bags
    if (measurementObj.altMeasurement) {
      if (!quantity) { quantity = '1'; }
      quantity = quantity + ' (' + measurementObj.altMeasurement + ')';
    }

    var retval = _.map(_.zip(descriptions, directions), function(tuple) { //(value, key, list)
      zipDesc = tuple[0]; // string
      zipDir = tuple[1];  // properties: alt, direction
      direction = zipDir.direction;

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
      _.each(endsWithList, function(endsWith) {
        if (endsWith.re.test(zipDesc)) {
          match = zipDesc.match(endsWith.re);
          zipDesc = _.trim(zipDesc.replace(endsWith.re, ''));

          //action: 'append', 'prepend', 'replace'
          array = [_.compact([endsWith.prefix, _.trim(match[1]), endsWith.suffix]).join(' ')];
          if (endsWith.action === 'append') {
            array.push(zipDir.direction);
            zipDir.direction = _.compact(array).join(endsWith.join);
          } else if (endsWith.action === 'prepend') {
            array.unshift(zipDir.direction);
            zipDir.direction = _.compact(array).join(endsWith.join);
          } else {
            zipDir.direction = _.first(array);
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
        match = zipDesc.match(cloveGarlicRe);
        zipDesc = 'garlic ' + _.trim(match[1]);
      }

      // 2 cans tomato sauce (8 ounces each)
      if (measurement) {
        if (_.indexOf(util.altMeasurementTerms, measurement.toLowerCase()) >= 0) {
          if (zipDir.alt) {
            if (!quantity) { quantity = '1'; }
            quantity = quantity + ' (' + zipDir.alt + ')';
            delete zipDir.alt;
          }
        }
      }

      return [zipDesc, zipDir];
    });

    retval = _.zip.apply(_, retval);
    return callback(null, {
      descriptions: retval[0],
      directions: retval[1],
      quantity: quantity
    });
  }
});

var endsWithCutIntoWedges = /(\s+cut\s+into\s+wedges)$/;
var endsWithForXRe = /((?:\s+plus\s+(?:extra|additional))?\s+for\s+(?:(dusting|drizzling|shaving|sprinkling)))$/;
var endsWithForWorkSurfaceRe = /(\s+for\s+work\s+surface)$/;
var endsWithXRe = /(\s+(?:crumbled|packed|minced))$/;
var endsWithFromXLemondRe = /(\s+from\s+(\d+|one|two|three|four|five|six)(\s+(?:small|medium|large))?\s+(?:lemon|lemons|lime|lemons))$/;
var endsWithCutIntoXPieces = /(\s+cut\s+into\s+(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|–|to)? *(?:inch|feet|meter)? *pieces?)$/;
var endsWithBoiledRe = /(\s+boiled.*)$/;
var endsWithSeparatedAndPressedRe = /(\s+separated\s+and\s+pressed.*)$/;
var endsWithPressedThroughRe = /(\s+pressed\s+through.*)$/;
var endsWithBeatenLightlyRe = /(\s+beaten\s+lightly.*)$/;

// romaine lettuce washed, dried, and shredded
// >> description 'romaine lettuce washed'
// >> direction 'dried, and shredded'
var endsWithYRe = /(\s+(washed|chilled))$/;


// medium tomato cut into a medium dice (peeling and seeding optional)
// >> description: "tomato cut into a medium dice",
// >> direction: "peeling and seeding optional",
var endsWithCutIntoXDiceRe = /(\s+cut\s+into\s+a\s+((small|medium|large)\s+)?dice)$/;

var endsWithList = [
  {
    re: endsWithForXRe
  },
  {
    re: endsWithForWorkSurfaceRe
  },
  {
    re: endsWithXRe
  },
  {
    prefix: 'freshly squeezed',
    re: endsWithFromXLemondRe,
    join: ', ',
    action: 'append'
  },
  {
    re: endsWithCutIntoXPieces
  },
  {
    re: endsWithCutIntoWedges
  },
  {
    re: endsWithBoiledRe
  },
  {
    re: endsWithSeparatedAndPressedRe
  },
  {
    re: endsWithPressedThroughRe
  },
  {
    re: endsWithBeatenLightlyRe
  },
  {
    re: endsWithYRe,
    join: ', ',
    action: 'append'
  },
  {
    re: endsWithCutIntoXDiceRe,
    join: ', ',
    action: 'append'
  }
];


var beginsWithCoarselyChoppedRe = /^(coarsely\s+chopped)(.*)$/;
var beginsWithXRe = /^((?:sifted|packed)\s+)(.*)$/;
var beginsWithThinSlicedRe = /^(?:thin-sliced)(\s+)(.*)$/;
var beginsWithList = [
  {
    re: beginsWithCoarselyChoppedRe
  },
  {
    re: beginsWithXRe
  },
  {
    prefix: 'thinly sliced',
    re: beginsWithThinSlicedRe
  }
];
var beginsWithXChickenY = /^((?:skinless|skin-on)\s+chicken\s+(?:breasts|thighs))(.*)$/;
var cloveGarlicRe = /^(cloves?)\s+garlic/;

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

