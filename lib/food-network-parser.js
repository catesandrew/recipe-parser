// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural'),
    RecipeParser = require('./recipe-parser'),
    nodePath = require('path');

var main = require('../main'),
    util = main.util,
    log = main.log,
    _ = util._;

var blackWhitePepperRe = /^(?:(black|white)\s+pepper)$/;
var groundRe = /^ground$/i;

var SeriousEatsRecipeParser = module.exports = RecipeParser.extend({
  initialize: function() {
    RecipeParser.prototype.initialize.apply(this, arguments);
    this.set('dataFile', nodePath.resolve(__dirname + '/../test/data/serious-eats.js'));
    this.on('description:split-on-and', this.postProcessSplitOnAnd);
    this.on('description:split-on-or', this.postProcessSplitOnOr);
    this.on('adjust:qty-desc-direc', this.adjustQtyDescriptionsDirections);
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

      // replaces direction
      _.each(endsWithList, function(endsWith) {
        if (endsWith.re.test(zipDesc)) {
          match = zipDesc.match(endsWith.re);
          zipDesc = _.trim(zipDesc.replace(endsWith.re, ''));
          zipDir.direction = _.compact([endsWith.prefix, _.trim(match[1]), endsWith.suffix]).join(' ');
        }
      });

      // romaine lettuce washed, dried, and shredded
      // >> description 'romaine lettuce washed'
      // >> direction 'dried, and shredded'
      // doesn't replace direction, appends to it
      if (endsWithXRe.test(zipDesc)) {
        match = zipDesc.match(endsWithXRe);
        zipDesc = _.trim(zipDesc.replace(endsWithXRe, ''));
        zipDir.direction = _.compact([_.trim(match[1]), zipDir.direction]).join(', ');
      }

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

// beaten lightly
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
var endsWithList = [
  {
    re: endsWithForXRe
  },
  {
    re: endsWithForWorkSurfaceRe
  },
  {
    re: endsWithXRe,
  },
  {
    prefix: 'freshly squeezed',
    re: endsWithFromXLemondRe
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
  }
];

var endsWithXRe = /(\s+(washed|chilled))$/;

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

