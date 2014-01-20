'use strict';

// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    natural = require('natural'),
    path = require('path');

var main = require('../main'),
    util = main.util,
    _ = util._;

// The module to be exported.
var parser = module.exports = {};

var _measurements = [
  'bag',
  'batch',
  'block',
  'bottle',
  'box',
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
  'chopped', 'cracked', 'fresh',  'grated', 'ground', 'minced', 'toasted'
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

var quantiyRe = /(?:about\s+)?(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|to)? *(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?(.*)$/;
var punctStr = '[-!"#$%&\'()\\*+,\\.\\/:;<=>?@\\^_`{|}~]';
var parenthesesRe = /\(([^\)]*)\)/;
var whiteSpaceRe = /\s{2,}/g;
var directionTokenizerRe = /[,_]/;
var commaRe = /^([^,]*)(?:,\s+(.*))?$/;
var andSplitterRe = /(?:\s+)?and\s+/i;
var orSplitterRe = /(?:\s+)?or\s+/i;

var isQuantity = function(text) {
  if (!text) {
    return false;
  }

  // retval[0] represents from (where there is a `to` in the quantity)
  // retval[1] represents to (where there is a `to` in the quantity)
  var quantities = parseQuantity(text);
  var found = _.find(quantities, function(qty) {
    return qty.whole || qty.part;
  });
  return !!found;
}

var parseQuantity = function(text) {
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
}

var pruneQuantity = function(text) {
  var matches = text.match(quantiyRe);

  if (!matches) {
    return;
  }

  var idx = 5;
  if (matches.length > idx) {
    return matches[idx];
  }
}

var chopWordsFromFront = function(text, array, from) {
  var tokenizer = new natural.WordTokenizer(),
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
  }
}

var getQuantity = parser.getQuantity = function(text) {
  var tokens = _.compact(_.map(parseQuantity(text), function(duple) {
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
}

var getMeasurement = parser.getMeasurement = function(text) {
  return (chopWordsFromFront(pruneQuantity(text), _measurements, 2) || {}).matched;
}

var getDirectionsAndAlts = parser.getDirectionsAndAlts = function(text) {
  var obj = getDescriptions(text),
      tokenizer = new natural.WordTokenizer(),
      tokenizerComma = new natural.RegexpTokenizer({pattern: directionTokenizerRe}),
      descriptions = obj.descriptions,
      matchedDescriptions = obj.matchedDescriptions,
      parentheses = obj.parentheses,
      direction = obj.direction,
      directionParentheses,
      matches,
      tokens;

  var retval = [],
      matched,
      found,
      desc,
      alt,
      tmp;

  for (var i = 0, l = descriptions.length; i < l; i++) {
    tmp = tmp = directionParentheses = undefined;
    matched = matchedDescriptions[i];
    desc = descriptions[i];
    found = false;

    if (matched) { // create tokens array of matched descriptions
      tokens = _.map(tokenizer.tokenize(matched), function(token) {
        return token.toLowerCase();
      });
    }

    if (direction) { // strip out parentheses from direction
      matches = direction.match(parenthesesRe);
      if (matches) {
        util.remove(matches, 0, 0); // remove the first element
        directionParentheses = _.first(matches);
        alt = directionParentheses;
        direction = direction.replace(parenthesesRe, ''); // remove the parentheses from the direction
        direction = direction.trim().replace(whiteSpaceRe, ' '); // trim and replace extra spaces with one
      }
      else {
        var isQty;
        // lets try tokenizing the direction and look for a `quantity` missing parentheses
        tokens = _.map(tokenizerComma.tokenize(direction), function(token) {
          return token.trim().toLowerCase();
        });
        tokens = _.filter(tokens, function(token) {
          if (tokenizer.tokenize(token).length <= 5) { // hacky
            isQty = isQuantity(token);
            if (isQty) {
              found = true;
              alt = token;
            }
            return !isQty;
          }
          return true;
        });
        if (found) {
          direction = tokens.join(', ');
        }
      }
    }

    if (parentheses) { // is parentheses a `quanity` or just a `note`?
      if (!isQuantity(parentheses)) {
        direction = _.compact([direction, parentheses]).join(', ');
      } else {
        alt = parentheses;
      }
    }

    var obj = {
      alt: alt,
      direction: null
    }

    if (desc == 'black pepper' && tokens) {
      if (_.indexOf(tokens, 'ground') >= 0) {
        obj.direction = 'freshly ground';
      }
    }
    else {
      tmp = _.compact([matched, direction]);
      if (_.isEmpty(tmp)) {
        obj.direction = undefined;
      } else {
        obj.direction = tmp.join(', ');
      }
    }
    retval.push(obj);
  }

  //console.log(obj);
  //console.log('retval: ', retval);
  return retval;
}

var getDescriptions = parser.getDescriptions = function(text) {
  var description = (chopWordsFromFront(pruneQuantity(text), _measurements, 2) || {}).pruned,
      matchedDescriptions = [],
      parentheses = undefined,
      descriptions,
      isOrSplit,
      direction,
      matches;

  //console.log('>' + description);
  matches = description.match(commaRe);

  // remove the first element
  util.remove(matches, 0, 0);
  description = _.first(matches);
  direction = matches[1];

  // strip out parentheses.  match(/\([^\)]*\)/)
  // split on `or` or `and`  .split(/(?:\s+)?(?:or|and)\s+/i)
  // if first word contained in parentheses is `or` then split
  //   ex, (or cracked white peppercorns) vs (sweet or bittersweet)

  // strip out parentheses
  matches = description.match(parenthesesRe);
  if (matches) {
    util.remove(matches, 0, 0); // remove the first element
    parentheses = _.first(matches);
    // remove the parentheses from the description
    description = description.replace(parenthesesRe, '');
  }

  // split on `or` or `and`
  descriptions = description.split(andSplitterRe); // first try `and`
  if (descriptions.length < 2) {
    descriptions = description.split(orSplitterRe); // then try `or`
    if (descriptions.length > 1) {
      isOrSplit = true; // so callee can build `isDivider` data struct
    }
  }

  // if first word contained in parentheses is `or` then split,
  // think of it as an alternate ingredient.
  if (parentheses && parentheses.indexOf('or') === 0) {
    descriptions.push(parentheses.split(orSplitterRe)[1]);
    parentheses = undefined;
    isOrSplit = true;
  }

  // clean up
  descriptions = _.map(descriptions, function(desc) {
    // trim and replace extra spaces with one
    return desc.trim().replace(whiteSpaceRe, ' ');
  });

  var tmp;
  descriptions = _.map(descriptions, function(desc) {
    tmp = (chopWordsFromFront(desc, _words, 2) || {});
    desc = tmp.pruned;
    matchedDescriptions.push(tmp.matched);
    if (desc == 'cloves garlic') {
      return 'garlic cloves';
    } else if (desc.toLowerCase() == 'salt') {
      return 'kosher salt';
    } else if (desc.toLowerCase() == 'table salt') {
      return 'table salt';
    }
    return desc;
  });

  return {
    isOrSplit: !!isOrSplit,
    descriptions: descriptions,
    matchedDescriptions: matchedDescriptions,
    parentheses: parentheses,
    direction: direction
  }
}

var getAllPieces = parser.getAllPieces = function(text) {
  var quantity = getQuantity(text);
  var measurement = getMeasurement(text);
  var descriptions = getDescriptions(text); // isOrSplit, descriptions, matchedDescriptions, parentheses, direction
  var directions = getDirectionsAndAlts(text); // [{direction, alt}[,{}, ...n]]

  if (quantity == '2' && measurement == 'inch piece') {
    measurement = quantity + '-' + measurement;
    quantity = '1';
  }

  return {
    quantity: quantity,
    measurement: measurement,
    descriptions: descriptions,
    directions: directions
  }
}

