// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural'),
    RecipeParser = require('./recipe-parser'),
    nodePath = require('path'),
    main = require('../main'),
    util = main.util,
    log = main.log,
    _ = util._;

var endsWithItemRe = /(\s+from(\s+(?:about))?\s+((?:\d+|one|two|three|four|five|six)(\s+(?:-|–|to)\s+(?:\d+|one|two|three|four|five|six))?)(\s+(?:small|medium|large))?\s+(?:lemons?|limes?|apples?|medium sweet potatos?))$/;
var beginsWithXChickenY = /^((?:skinless|skin-on)\s+chicken\s+(?:breasts?|thighs?)(?:\s+or\s+legs)?)(.*)$/;
var cloveGarlicRe = /^((cloves?)\s+garlic)(.*)$/;
var blackWhitePepperRe = /^(?:(black|white)\s+pepper)$/;
var parenthesesRe = /\(([^\)]*)\)/;
var groundRe = /^ground$/i;

var SeriousEatsRecipeParser = module.exports = RecipeParser.extend({
  initialize: function() {
    RecipeParser.prototype.initialize.apply(this, arguments);
    this.set('dataFile', nodePath.resolve(__dirname + '/../test/data/serious-eats.js'));
    this.on('description:strip-parentheses', this.postStripParentheses);
    this.on('description:split-on-and', this.postProcessSplitOnAnd);
    this.on('description:split-on-or', this.postProcessSplitOnOr);
    this.on('adjust:qty-desc-direc', this.adjustQtyDescriptionsDirections);

    this._words = [
      'chopped',
      'cold',
      'cracked',
      'cooked and peeled',
      'day-old',
      'drained',
      'finely',
      'fresh',
      'freshly',
      'fresh-squeezed',
      'frozen',
      'grated',
      'ground',
      'hard-cooked',
      'minced',
      'ripe',
      'roughly',
      'shredded',
      'sliced',
      'squeezed',
      'toasted'
    ];
  },
  postStripParentheses: function(parentheses, description, callback) {
    var retParentheses = parentheses,
        retDescription;

    if (parentheses === 'Anaheim') { // BEGIN HACK
      // 3/4 pound Hatch (Anaheim) chiles (see note above)
      var anaheim = description.replace(parenthesesRe, '-placeholder-');
      anaheim = _.map(anaheim.split('-placeholder-'), function(item) { return _.trim(item);});

      var matches = anaheim[1].match(parenthesesRe);
      if (matches) {
        util.remove(matches, 0, 0); // remove the first element
        parentheses = _.first(matches);
        if (parentheses === 'see note above') {
          retParentheses = undefined;
        }
        anaheim[1] = anaheim[1].replace(parenthesesRe, '');
      }
      retDescription = [anaheim[0], '(' + 'Anaheim' + ')', anaheim[1]].join(' ');

    } else { //// END HACK
      // remove the parentheses from the description
      retDescription = description.replace(parenthesesRe, '');
    }

    return callback(null, {
      parentheses: retParentheses,
      description: retDescription
    });
  },
  postProcessSplitOnAnd: function(descriptions, callback) {
    var retval = descriptions,
        matches,
        first,
        second;

    if (descriptions.length > 2) {
      // "2 medium cooked and peeled beets, finely diced (about 1 cup)"
      // eg: 'hard-boiled eggs whites and yolks separated and pressed through a fine sieve'
      // [ 'hard-boiled eggs whites', 'yolks separated', 'pressed through a fine sieve' ]
      if (util.regexIndexOf(descriptions[1], /^yolks\s+separated$/, 0) >= 0
          && util.regexIndexOf(descriptions[2], /^pressed.*$/, 0) >= 0) {
        retval = [ descriptions.join(' and ') ];
      }
    } else if (descriptions.length > 1) {
      first = descriptions[0];
      second = descriptions[1];

      // eg: 'medium new potatoes boiled until tender and sliced thick'
      // [ 'medium new potatoes boiled until tender', 'sliced thick' ]
      if (util.regexIndexOf(second, /^sliced\s+thick$/, 0) >= 0) {
        retval = [ descriptions.join(' and ') ];
      } else if (/^cooled$/.test(second)) {
        //[ 'All-Butter Crust for a 9-inch single-crust pie partially prebaked',
        //  'cooled' ]
        retval = [ descriptions.join(' and ') ];
      } else if (/^cooked$/.test(first) && /^peeled.*$/.test(second)) {
        //  "2 medium cooked and peeled beets, finely diced (about 1 cup)"
        retval = [ descriptions.join(' and ') ];
      } else if (/leaves$/.test(first) && /^((?:fine)\s+)?(?:stems)/.test(second)) {
        // "1/2 cup chopped fresh cilantro leaves and fine stems":
        // [ 'chopped fresh cilantro leaves', 'fine stems' ]
        retval = [ descriptions.join(' and ') ];
      } else if (/zest/.test(first) && /juice/i.test(second)) {
        // "1 tablespoon zest and 2 tablespoons juice from 1 lemon"
        // [ 'zest', '2 tablespoons juice from 1 lemoon' ]
        var fromX = _.trim(second.match(endsWithItemRe)[1]),
            fruit = _.trim(second.match(/(lemon|orange|lime)/)[1]),
            beg = _.trim(second.match(/(.*)juice(.*)/i)[1]);

        retval = [
          [ fruit, 'zest', fromX ].join(' '),
          [ beg, fruit, 'juice', fromX ].join(' ')
        ];
      }
    }

    return callback(null, {
      descriptions: retval
    });
  },
  postProcessSplitOnOr: function(descriptions, parentheses, callback) {
    var stockBrothRe = /^store[- ]?bought *(low[- ]?sodium *(chicken|vegetable) *(stock|broth))$/i;
    var storeBoughtBrothRe = /^store[- ]?bought *((?:chicken|vegetable) *(?:stock|broth))$/i;
    var washedRe = /^washed *([a-zA-Z]+)$/i;
    var matches;

    if (descriptions.length > 2) {
      // 1 1/2 quarts low-sodium homemade or store bought vegetable or chicken broth
      // [ 'low-sodium homemade', 'store bought vegetable', 'chicken broth' ]
      if (/^low[- ]?sodium.*$/i.test(descriptions[0])
          && /^store[- ]?bought.*/i.test(descriptions[1])
          && /^((chicken|vegetable) *(stock|broth))$/i.test(descriptions[2])) {

        descriptions = [ 'low-sodium vegetable broth', 'low-sodium chicken broth' ];
      }

    } else if (descriptions.length > 1) {
      if (util.regexIndexOf(descriptions[1], /^minced\s+to\s+paste$/, 0) >= 0) {
        // eg: 'medium clove garlic pressed through a garlic press or minced to paste'
        // [ 'clove garlic pressed through a garlic press', 'minced to paste' ]
        descriptions = [descriptions.join(' or ')];
        parentheses = undefined;
      }
      else if (util.regexIndexOf(descriptions[1], /^thawed\s+if\s+frozen/, 0) >= 0) {
        // eg: '3   ounces fresh strawberries (or thawed if frozen)'
        descriptions = [descriptions[0]];
        // do not kill the parentheses, lets keep em
      }
      else if (/^homemade(.*)$/i.test(descriptions[0]) && stockBrothRe.test(descriptions[1])) {
        //"2 cups homemade vegetable stock or store-bought low-sodium vegetable broth": [{
        matches = descriptions[1].match(stockBrothRe);
        if (matches) {
          descriptions = [ matches[1] ];
        }
      }
      else if (/^low[- ]?sodium.*$/i.test(descriptions[0]) && storeBoughtBrothRe.test(descriptions[1])) {
        // low-sodium homemade or store bought chicken broth": [{
        matches = descriptions[1].match(storeBoughtBrothRe);
        if (matches) {
          descriptions = [ 'low-sodium ' + matches[1] ];
        }
      }
      else if (/^pre-rinsed/i.test(descriptions[0]) && washedRe.test(descriptions[1])) {
        // [ 'pre-rinsed', 'washed quinoa' ]
        matches = descriptions[1].match(washedRe);
        if (matches) {
          descriptions = ['pre-rinsed or washed ' + matches[1] ];
        }

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

      if (/^handful$/i.test(measurement) && !zipQty) {
        measurementObj.matched = 'handful';
        zipQty = '1';
      }

      // 10 ounce bag tortilla chips
      if (measurement === 'ounce bag') {
        measurementObj.altMeasurement = [ zipQty, 'ounce' ].join(' ');
        measurementObj.matched = 'bag';
        zipQty = null;
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
            if (descObj.descFunc) {
              zipDesc = descObj.descFunc.call(descObj, zipDesc, match);
            } else {
              zipDesc = _.trim(zipDesc.replace(descObj.re, ''));
            }

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

      _.each(directionMatches, function(dirObj) {
        if (dirObj.re.test(direction)) {

          var matchReplace = function() {
            match = direction.match(dirObj.re);
            direction = _.trim(direction.replace(dirObj.re, ''));

            //action: 'append', 'prepend', 'replace'
            array = [_.compact([dirObj.prefix, _.trim(match[1]), dirObj.suffix]).join(' ')];
            if (dirObj.action === 'append') {
              array.push(direction);
              zipDir.direction = _.compact(array).join(dirObj.join);
            } else if (dirObj.action === 'prepend') {
              array.unshift(direction);
              zipDir.direction = _.compact(array).join(dirObj.join);
            } else {
              zipDir.direction = _.first(array);
            }
          };

          if (dirObj.descRe) {
            if (dirObj.descRe.test(zipDesc)) {
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

      if (/^orange\s+juice$/i.test(zipDesc)) {
        if (/^fresh$/i.test(direction)) {
          zipDir.direction = 'freshly squeezed';
        }
      }

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

var endsWithItemFunc = function(desc) {
  var fruitRe = /(lemon|orange|lime|sweet potato)/i,
      matches = desc.match(this.re),
      fromFruit,
      toFruit;

  if (matches.length > 1) {
    fromFruit = _.trim(matches[1]);
    toFruit = _.trim(desc.replace(this.re, ''));
    if (!fruitRe.test(toFruit) && fruitRe.test(fromFruit)) {
      var fruit = _.trim(fromFruit.match(fruitRe)[1]);
      return [ fruit, toFruit ].join(' ');
    }
    return toFruit;
  }
  return desc;
};

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
    dirRe: /^fresh$/i,
    prefix: 'freshly squeezed',
    re: endsWithItemRe,
    action: 'replace',
    descFunc: endsWithItemFunc
  },
  {
    descRe: /zest/i,
    prefix: 'freshly zested',
    re: endsWithItemRe,
    join: ', ',
    action: 'append'
  },
  {
    prefix: 'freshly squeezed',
    re: endsWithItemRe,
    join: ', ',
    action: 'append',
    descFunc: endsWithItemFunc
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
  },
  {
    re: /(\s+for\s+serving.*)$/
  },
  {
    re: /(\s+for\s+brine.*)$/
  },
  {
    re: /^(cooked\s+and\s+peeled)/,
    join: ', ',
    action: 'append'
  },
  {
    re: /(\s+quartered)/,
    join: ', ',
    action: 'prepend'
  },
  {
    re: /((?:finely\s+)?(?:sliced|chopped))$/
  },
  {
    re: /((?:slit\s+)?(?:lengthwise))$/
  }
];

var directionMatches = [
  {
    prefix: 'freshly squeezed',
    re: endsWithItemRe,
    action: 'replace'
  },
  {
    prefix: 'freshly squeezed',
    re: /^fresh-squeezed$/,
    action: 'replace'
  },
  {
    re: /^chopped\s+fresh$/i,
    action: 'append',
    prefix: 'freshly chopped'
  },
  {
    descRe: /^nutmeg$/i,
    re: /^grated$/i,
    action: 'append',
    prefix: 'freshly grated'
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
    re: /^kosher\s+salt$/i,
    replacement: 'kosher salt'
  },
  {
    re: /^table\s+salt$/i,
    replacement: 'table salt'
  },
  {
    re: /^butter$/,
    replacement: 'unsalted butter'
  },
  {
    re: /^flour/,
    replacement: 'all-purpose flour'
  }
];
