// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural');

var main = require('../main'),
    util = main.util,
    log = main.log,
    _ = util._;

var _measurements = [
  'bag',
  'batch',
  'block',
  'bottle',
  'box',
  'bulb',
  'bunch',
  'can',
  'container',
  'crown',
  'cube',
  'cup',
  'dash',
  'dozen',
  'drop',
  'ear',
  'envelope',
  'feet',
  'fillet',
  'fluid ounce',
  'gallon',
  'gram',
  'grind',
  'half',
  'handful',
  'head',
  'heart',
  'inch',
  'large',
  'leaf',
  'liter',
  'loaf',
  'medium',
  'mini',
  'ounce',
  'package',
  'packet',
  'part',
  'pat',
  'piece',
  'pinch',
  'pint',
  'pouch',
  'pound',
  'quart',
  'recipe',
  'scoop',
  'set',
  'sheet',
  'shot',
  'side',
  'slab',
  'slice',
  'small',
  'splash',
  'sprig',
  'sprinkle',
  'stalk',
  'stem',
  'stick',
  'strip',
  'tablespoon',
  'teaspoon',
  'tin',
  'vial',
  'whole'
];
_measurements = _.union(_measurements, _.map(_measurements, function(measurement) {
  return pluralize.plural(measurement);
})).sort();

var _words = [
  'chopped', 'cracked', 'finely', 'fresh', 'freshly', 'grated', 'ground', 'hard-cooked', 'minced', 'ripe', 'shredded', 'toasted'
];

var _uncountableWords = [
  'dozen', 'small', 'medium', 'large', 'mini', 'whole'
];
_uncountableWords.forEach(pluralize.addUncountableRule);

//(\d++(?! */))? *-? *(?:(\d+) */ *(\d+))?.*$  original
//Match the regular expression below and capture its match into backreference number 1 «(\d++(?! */))?»
   //Between zero and one times, as many times as possible, giving back as needed (greedy) «?»
   //Match a single digit 0..9 «\d++»
      //Between one and unlimited times, as many times as possible, without giving back (possessive) «++»

   //Assert that it is impossible to match the regex below starting at this position (negative lookahead) «(?! */)»
      //Match the space character " " literally « *»
         //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
      //Match the character "/" literally «/»

//Match the space character " " literally « *»
   //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»

//Match the character "-" literally «-?»
   //Between zero and one times, as many times as possible, giving back as needed (greedy) «?»

//Match the space character " " literally « *»
   //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»

//Match the regular expression below «(?:(\d+) */ *(\d+))?»
   //Between zero and one times, as many times as possible, giving back as needed (greedy) «?»
   //Match the regular expression below and capture its match into backreference number 2 «(\d+)»
      //Match a single digit 0..9 «\d+»
         //Between one and unlimited times, as many times as possible, giving back as needed (greedy) «+»
   //Match the character “ ” literally « *»
      //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
   //Match the character “/” literally «/»
   //Match the character “ ” literally « *»
      //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
   //Match the regular expression below and capture its match into backreference number 3 «(\d+)»
      //Match a single digit 0..9 «\d+»
         //Between one and unlimited times, as many times as possible, giving back as needed (greedy) «+»

//Match any single character that is not a line break character «.*»
   //Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
//Assert position at the end of the string (or before the line break at the end of the string, if any) «$»
//
//*(-|to)?                                     divider
//\d++(?:\.\d{1,2})?   match decimal
//
//(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|to)? *(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?.*$/;
//

var quantiyRe = /(?:about\s+)?(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|–|to)? *(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?(.*)$/;
var punctStr = '[-!"#$%&\'()\\*+,\\.\\/:;<=>?@\\^_`{|}~]';
var parenthesesRe = /\(([^\)]*)\)/;
var parenthesesGlobalRe = /\(([^)]+?)\),?/g;
var frontParenthesesRe = /^\(([^\)]*)\)(.*)$/;
var whiteSpaceRe = /\s{2,}/g;
var directionTokenizerRe = /[,_]/;
// Instead of [^A-Za-z0-9_] for \W, I customized it to
// include the hyphen for words like half-and-half.
var wordTokenizerRe = /[^-a-z0-9_]+/i;

var parenthesesGroupRe = /\(([^)]*)\)/g;
var commaSplitterRe = /,/;
var andSplitterRe = /(?:\s+)?\band\s+/i;
var orSplitterRe = /(?:\s+)?\bor\s+/i;

// The module to be exported.
var RecipeParser = module.exports = Backbone.Model.extend({
  initialize: function() {
    this.splitComma = _.bind(this.splitOnRegex, this, commaSplitterRe);
    this.splitAnd = _.bind(this.splitOnRegex, this, andSplitterRe);
    this.splitOr = _.bind(this.splitOnRegex, this, orSplitterRe);
  },
  splitOnRegex: function(regex, text) {
    // no state in regex engine so this is a hack around it to keep
    // us from splitting within a parentheses group.
    var filteredData = text,
        matches = text.match(parenthesesGroupRe);

    if (matches) {
      filteredData = text.replace(parenthesesGroupRe, '-placeholder-');
    }

    var arr = _.map(filteredData.split(regex), function(item) {
      return _.trim(item);
    });

    if (!matches) {
      return arr;
    }

    var j = 0;
    return _.map(arr, function(entry, i) {
      while (entry.indexOf('-placeholder-') >= 0) {
        entry = entry.replace(/-placeholder-/, matches[j++]);
      }
      return entry;
    });
  },
  isQuantity: function(text) {
    if (!text) {
      return false;
    }

    // retval[0] represents from (where there is a `to` in the quantity)
    // retval[1] represents to (where there is a `to` in the quantity)
    var quantities = this.parseQuantity(text);
    var found = _.find(quantities, function(qty) {
      return qty.whole || qty.part;
    });
    return !!found;
  },
  parseQuantity: function(text) {
    var breakdown = {},
        retval = [],
        matches;

    matches = text.match(quantiyRe);

    if (!matches) {
      return retval;
    }

    // remove the first element
    util.remove(matches, 0, 0);

    for (var i = 0; i < matches.length; i+=2) {
      if (matches.length >= i+2) {
        retval.push({
          whole: matches[i],
          part: matches[i+1]
        });
      } else if (matches.length >= i+1) {
        retval.push({
          whole: matches[i]
        });
      }
    }

    // remove anything after 2nd element
    // retval[0] represents from (where there is a `to` in the quantity)
    // retval[1] represents to (where there is a `to` in the quantity)
    util.remove(retval, 2, 50);
    return retval;
  },
  pruneQuantity: function(text) {
    var matches = text.match(quantiyRe);

    if (!matches) {
      return;
    }

    var idx = 5;
    if (matches.length > idx) {
      return matches[idx];
    }
  },
  chopWordsFromFront: function(text, array, from) {
    var tokenizer = new natural.RegexpTokenizer({pattern: wordTokenizerRe}),
        matched,
        found = 0;

    var tokens = _.first(tokenizer.tokenize(text), from);
    for (var i = 0, l = tokens.length; i < l; i++) {
      if (_.indexOf(array, tokens[i].toLowerCase(), true) >= 0) {
        if (i > 0) {
          if (_.indexOf(_uncountableWords, tokens[i].toLowerCase()) < 0) {
            found = i + 1;
          }
        } else {
          found = i + 1;
        }
      } else {
        break;
      }
    }

    for (i=0, l=found; i < l; i++) {
      text = text.replace(new RegExp(tokens[i] + punctStr + '?', 'i'), '').trim();
    }
    tokens.length = found;
    if (tokens.length) {
      matched = tokens.join(' ');
    }

    return {
      pruned: text,
      matched: matched
    };
  },
  getQuantity: function(text) {
    var tokens = _.compact(_.map(this.parseQuantity(text), function(duple) {
      if (duple.whole && duple.part) {
        return duple.whole + ' ' + duple.part;
      } else if (duple.whole) {
        return duple.whole;
      } else if (duple.part) {
        return duple.part;
      }
    }));
    if (tokens.length) {
      return tokens.join(' to ');
    }
  },
  getMeasurement: function(text) {
    var prunedQuantity = this.pruneQuantity(text),
        altMeasurement,
        matches,
        obj;

    // check for existence of parentheses in front
    // '3 (10-ounce) bags flat-leaf spinach, stems removed, leaves washed and dried'
    matches = prunedQuantity.match(frontParenthesesRe);
    if (matches) {
      altMeasurement = matches[1];
      prunedQuantity = _.trim(matches[2]).replace(whiteSpaceRe, ' ');
    }

    obj = (this.chopWordsFromFront(prunedQuantity, _measurements, 2) || {});
    if (altMeasurement) {
      obj.altMeasurement = altMeasurement;
    } else if (obj.matched && obj.pruned) {
      if (_.indexOf(util.altMeasurementTerms, obj.matched.toLowerCase()) >= 0) {
        // now test if front of pruned has parentheses,
        // indicating a measurment for can/bag, etc..
        // '1 can (14 1/2 ounces) diced tomatoes, drained'
        // {
        //   "pruned": "(14 1/2 ounces) diced tomatoes, drained",
        //   "matched": "can"
        // }
        matches = obj.pruned.match(frontParenthesesRe);
        if (matches) {
          obj.altMeasurement = matches[1];
          obj.pruned = _.trim(matches[2]).replace(whiteSpaceRe, ' ');
        }
      }
    }

    // '3 (10-ounce) bags flat-leaf spinach, stems removed, leaves washed and dried'
    // {
    //   pruned: 'flat-leaf spinach, stems removed, leaves washed and dried',
    //   matched: 'bags',
    //   altMeasurement: '10-ounce'
    // }
    return obj;
  },
  getDirectionsAndAlts: function(text) {
    var descriptionObj = this.getDescriptions(text),
        tokenizer = new natural.RegexpTokenizer({pattern: wordTokenizerRe}),
        tokenizerComma = new natural.RegexpTokenizer({pattern: directionTokenizerRe}),
        descriptions = descriptionObj.descriptions,
        matchedDescriptions = descriptionObj.matchedDescriptions,
        parentheses = descriptionObj.parentheses,
        direction = descriptionObj.direction,
        matches,
        tokens;

    var directionClone,
        retval = [],
        matched,
        found,
        desc,
        alt,
        obj,
        tmp;

    _.each(_.zip(descriptions, matchedDescriptions), function(tuple) {
      tmp = alt = found = undefined;
      directionClone = _.clone(direction);
      desc = tuple[0];
      matched = tuple[1];

      if (matched) { // create tokens array of matched descriptions
        tokens = _.map(tokenizer.tokenize(matched), function(token) {
          return token.toLowerCase();
        });
      }

      if (directionClone) { // strip out parentheses from direction
        matches = directionClone.match(parenthesesGlobalRe); // there's only 1 for 1..2 descriptions
        if (matches) {
          // lets go with the last match (not foolproof by any means), but
          // when there's more than one pair of parentheses, who wins?
          // cut crosswise into very thin (1/16-inch) slices (about 2 tablespoons)
          alt = matches[matches.length - 1].match(parenthesesRe)[1];
          directionClone = directionClone.replace(matches[matches.length - 1], ''); // remove the parentheses from the direction
          directionClone = directionClone.trim().replace(whiteSpaceRe, ' '); // trim and replace extra spaces with one
        }
        else {
          var isQty;
          // lets try tokenizing the direction and look for a `quantity` missing parentheses
          tokens = _.map(tokenizerComma.tokenize(directionClone), function(token) {
            return token.trim().toLowerCase();
          });
          tokens = _.filter(tokens, function(token) {
            if (tokenizer.tokenize(token).length <= 5) { // hacky
              isQty = this.isQuantity(token);
              if (isQty) {
                found = true;
                alt = token;
              }
              return !isQty;
            }
            return true;
          }, this);
          if (found) {
            directionClone = tokens.join(', ');
          }
        }
      }

      if (parentheses) { // is parentheses a `quanity` or just a `note`?
        if (!this.isQuantity(parentheses)) {
          directionClone = _.compact([directionClone, parentheses]).join(', ');
        } else {
          alt = parentheses;
        }
      }

      obj = {
        alt: alt,
        direction: null
      };

      tmp = _.compact([matched, directionClone]);
      if (_.isEmpty(tmp)) {
        obj.direction = undefined;
      } else {
        obj.direction = tmp.join(', ');
      }
      retval.push(obj);
    }, this);

    //console.log(obj); // {alt: undefined, direction: 'fresh, or thawed if frozen'}
    //console.log('retval: ', retval);
    return retval;
  },
  getDescriptions: function(text) {
    var description = (this.getMeasurement(text) || {}).pruned,
        matchedDescriptions = [],
        parentheses,
        descriptions,
        isOrSplit,
        direction,
        matches,
        tmp;

    //console.log('>' + description);
    matches = this.splitComma(description);

    description = _.first(matches);
    // remove the first element, so we can join the remainder
    util.remove(matches, 0, 0);
    direction = matches.join(', ');

    // strip out parentheses
    matches = description.match(parenthesesRe);
    if (matches) {
      util.remove(matches, 0, 0); // remove the first element
      parentheses = _.first(matches);
      // remove the parentheses from the description
      description = description.replace(parenthesesRe, '');
    }

    // split on `or` or `and`
    var ands = this.splitAnd(description);
    this.trigger('description:split-on-and', ands, function(err, retval) { // first try `and`
      if (!err) {
        descriptions = retval.descriptions;
      }
    });
    if (descriptions.length < 2) {
      var ors = this.splitOr(description);
      this.trigger('description:split-on-or', ors, null, function(err, retval) { // then try `or`
        if (!err) {
          descriptions = retval.descriptions;
        }
      });
      if (descriptions.length > 1) {
        isOrSplit = true; // so callee can build `isDivider` data struct
      }
    }

    // if first word contained in parentheses is `or` then split
    // think of it as an alternate ingredient.
    //   ex, (or cracked white peppercorns) vs (sweet or bittersweet)
    if (parentheses && parentheses.indexOf('or') === 0) {
      descriptions.push(this.splitOr(parentheses)[1]);
      this.trigger('description:split-on-or', descriptions, parentheses, function(err, retval) {
        if (!err) {
          parentheses = retval.parentheses;
          descriptions = retval.descriptions;
        }
      });
      if (descriptions.length > 1) {
        isOrSplit = true; // so callee can build `isDivider` data struct
      }
    }

    // clean up
    descriptions = _.map(descriptions, function(desc) {
      // trim and replace extra spaces with one
      return _.trim(desc.replace(whiteSpaceRe, ' '));
    });

    descriptions = _.map(descriptions, function(desc) {
      tmp = (this.chopWordsFromFront(desc, _words, 3) || {});
      matchedDescriptions.push(tmp.matched);
      return tmp.pruned;
    }, this);

    return {
      isOrSplit: !!isOrSplit,
      descriptions: descriptions,
      matchedDescriptions: matchedDescriptions,
      parentheses: parentheses,
      direction: direction
    };
  },
  getAllPieces: function(text) {
    var quantity = this.getQuantity(text);
    var measurementObj = this.getMeasurement(text); // props: pruned, altMeasurement, matched
    var descriptionObjs = this.getDescriptions(text), // isOrSplit, descriptions, matchedDescriptions, parentheses, direction
        descriptions = descriptionObjs.descriptions;
    var directions = this.getDirectionsAndAlts(text); // [{direction, alt}[,{}, ...n]]

    this.trigger('adjust:qty-desc-direc', {
        quantity: quantity,
        measurementObj: measurementObj,
        descriptionObjs: descriptionObjs,
        descriptions: descriptions,
        directions: directions
      }, function(err, retval) {
        if (!err) {
          // unzip return values
          descriptionObjs.descriptions = retval.descriptions;
          directions = retval.directions;
          quantity = retval.quantity;
        }
      });

    // we are done
    return {
      quantity: quantity,
      measurement: measurementObj.matched,
      descriptions: descriptionObjs,
      directions: directions
    };
  },
  parseIngredient: function(text) {
    var allPieces = this.getAllPieces(text),
        quantity = allPieces.quantity,
        measurement = allPieces.measurement,
        descriptionObjs = allPieces.descriptions,
        descriptions = descriptionObjs.descriptions,
        directions = allPieces.directions;

    var retval = _.map(_.zip(descriptions, directions), function(tuple) {
      return {
        quantity: quantity,
        measurement: measurement,
        description: tuple[0],
        direction: tuple[1].direction,
        alt: tuple[1].alt
      };
    });

    _.each(retval, function(fixme) {
      for (var key in fixme) {
        if (!fixme[key]) {
          delete fixme[key];
        }
      }
    });

    if (descriptionObjs.isOrSplit) {
      retval = {
        description: 'Or',
        isDivider: true,
        ingredients: retval
      };
    } else if (retval.length === 1) {
      retval = _.first(retval);
    }

    return retval;
  }
});

