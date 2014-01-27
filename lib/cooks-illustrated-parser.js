'use strict';

// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    natural = require('natural'),
    ge = require('../test/data/good-eats'),
    nodePath = require('path');

var main = require('../main'),
    util = main.util,
    _ = util._;

// The module to be exported.
var parser = module.exports = {};

parser.dataFile = nodePath.resolve(__dirname + '/../test/data/cooks-illustrated.js');

var _altMeasurementTerms = [
  'bag',
  'can'
];
_altMeasurementTerms = _.union(_altMeasurementTerms, _.map(_altMeasurementTerms, function(term) {
  return pluralize.plural(term);
})).sort();

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
var commaRe = /^([^,]*)(?:,\s+(.*))?$/;
var andSplitterRe = /(?:\s+)?\band\s+/i;
var orSplitterRe = /(?:\s+)?\bor\s+/i;

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
};

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
};

var pruneQuantity = function(text) {
  var matches = text.match(quantiyRe);

  if (!matches) {
    return;
  }

  var idx = 5;
  if (matches.length > idx) {
    return matches[idx];
  }
};

var chopWordsFromFront = function(text, array, from) {
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
};

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
};

var getMeasurement = parser.getMeasurement = function(text) {
  var prunedQuantity = pruneQuantity(text),
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

  obj = (chopWordsFromFront(prunedQuantity, _measurements, 2) || {});
  if (altMeasurement) {
    obj.altMeasurement = altMeasurement;
  } else if (obj.matched && obj.pruned) {
    if (_.indexOf(_altMeasurementTerms, obj.matched.toLowerCase()) >= 0) {
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
};

var getDirectionsAndAlts = parser.getDirectionsAndAlts = function(text) {
  var descriptionObj = getDescriptions(text),
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

  for (var i = 0, l = descriptions.length; i < l; i++) {
    tmp = alt = found = undefined;
    directionClone = _.clone(direction);
    desc = descriptions[i];

    matched = matchedDescriptions[i];
    if (matched) { // create tokens array of matched descriptions
      tokens = _.map(tokenizer.tokenize(matched), function(token) {
        return token.toLowerCase();
      });
    }

    if (directionClone) { // strip out parentheses from direction
      matches = directionClone.match(parenthesesGlobalRe);
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
          directionClone = tokens.join(', ');
        }
      }
    }

    if (parentheses) { // is parentheses a `quanity` or just a `note`?
      if (!isQuantity(parentheses)) {
        directionClone = _.compact([directionClone, parentheses]).join(', ');
      } else {
        alt = parentheses;
      }
    }

    obj = {
      alt: alt,
      direction: null
    };

    if (desc === 'black pepper' && tokens) {
      if (_.indexOf(tokens, 'ground') >= 0) {
        obj.direction = 'freshly ground';
      }
    }
    else {
      tmp = _.compact([matched, directionClone]);
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
};

var getDescriptions = parser.getDescriptions = function(text) {
  var description = (getMeasurement(text) || {}).pruned,
      matchedDescriptions = [],
      parentheses,
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
    if (desc === 'cloves garlic') {
      return 'garlic cloves';
    } else if (desc.toLowerCase() === 'salt') {
      return 'kosher salt';
    } else if (desc.toLowerCase() === 'table salt') {
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
  };
};

var endsWithForDrizzlingRe = /(\s+for\s+drizzling)$/;
var endsWithCutIntoWedges = /(\s+cut\s+into\s+wedges)$/;
var endsWithForDustingRe = /(\s+for\s+dusting)$/;
var endsWithCrumbledRe = /(\s+crumbled)$/;
var endsWithFromXLemondRe = /(\s+from\s+\d+\s+(?:lemon|lemons))$/;
var endsWithCutIntoXPieces = /(\s+cut\s+into\s+(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|–|to)? *(?:inch|feet|meter)\s+pieces?)$/;
var endsWithList = [
  {
    re: endsWithForDrizzlingRe
  },
  {
    re: endsWithForDustingRe
  },
  {
    re: endsWithCrumbledRe,
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
  }
];
var beginsWithCoarselyChoppedRe = /^(coarsely\s+chopped)(.*)$/;
var beginsWithSkinlessChickenBreastsRe = /^(skinless\s+chicken\s+breasts)(.*)$/;
var adjustDescriptionsDirections = function(quantity, measurementObj, descriptionObjs, descriptions, directions) {
  var direction,
      zipDesc,
      zipDir,
      match;

  var retval = _.map(_.zip(descriptions, directions), function(tuple) { //(value, key, list)
    zipDesc = tuple[0]; // string
    zipDir = tuple[1];  // properties: alt, direction
    direction = zipDir.direction;

    _.each(endsWithList, function(endsWith) {
      if (endsWith.re.test(zipDesc)) {
        match = zipDesc.match(endsWith.re);
        zipDesc = _.trim(zipDesc.replace(endsWith.re, ''));
        zipDir.direction = _.compact([endsWith.prefix, _.trim(match[1]), endsWith.suffix]).join(' ');
        return true;
      }
    });

    if (beginsWithCoarselyChoppedRe.test(zipDesc)) {
      match = zipDesc.match(beginsWithCoarselyChoppedRe);
      zipDesc = _.trim(match[2]);
      zipDir.direction = _.trim(match[1]);
    }

    if (zipDesc === 'boneless' && beginsWithSkinlessChickenBreastsRe.test(direction)) {
      match = _.map(direction.match(beginsWithSkinlessChickenBreastsRe), function(str) {
        return _.trim(str);
      });
      zipDir.direction = match[2];
      zipDesc = _.compact(['boneless', match[1]]).join(', ');
    }

    return [zipDesc, zipDir];
  });
  return _.zip.apply(_, retval);
};

var adjustQuantityMeasurement = function(quantity, measurementObj) {
  var measurement = measurementObj.matched;
  if (measurement === 'inch piece') {
    measurementObj.matched = quantity + '-' + measurement;
    quantity = '1';
  }

  // 3 (10-ounce) bags
  if (measurementObj.altMeasurement) {
    quantity = quantity + ' (' + measurementObj.altMeasurement + ')';
  }

  return quantity;
};

var getAllPieces = parser.getAllPieces = function(text) {
  var quantity = getQuantity(text);
  var measurementObj = getMeasurement(text); // props: pruned, altMeasurement, matched
  var descriptionObjs = getDescriptions(text), // isOrSplit, descriptions, matchedDescriptions, parentheses, direction
      descriptions = descriptionObjs.descriptions;
  var directions = getDirectionsAndAlts(text); // [{direction, alt}[,{}, ...n]]

  quantity = adjustQuantityMeasurement(quantity, measurementObj);

  var retval = adjustDescriptionsDirections(
    quantity, measurementObj, descriptionObjs, descriptions, directions);
  // unzip return values
  descriptionObjs.descriptions = retval[0];
  directions = retval[1];

  // we are done
  return {
    quantity: quantity,
    measurement: measurementObj.matched,
    descriptions: descriptionObjs,
    directions: directions
  };
};

var parseIngredient = parser.parseIngredient = function(text) {
  var allPieces = parser.getAllPieces(text),
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
};

var commonWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'];
var buildStems = function(data) {
  var stemmer = natural.PorterStemmer,
      stemmedData = stemmer.tokenizeAndStem(data);

  stemmedData = _.difference(stemmedData, commonWords);
  stemmedData = _.filter(stemmedData, function(stem) {
    return stem.length > 1;
  });
  return stemmedData;
};

var buildTopIngredients = function(records) {
  var obj = {},
      allIngs;

  _.each(records, function(record) {
    allIngs = _.compact(_.map(record.ingredients, function(ing) {
      return buildStems(ing).join(' ');
    }));

    _.each(allIngs, function(ing) {
      if (obj[ing]) {
        obj[ing]++;
      } else {
        obj[ing] = 1;
      }
    });
  });
  return obj;
};

var buildTopIngredientList = function(records, count) {
  var list = _.map(records, function(t1, t2) {
    return {
      label: t2,
      value: t1
    };
  });
  list = _.sortBy(list, function(item) {
    return -1 * item.value;
  });
  if (count) {
    list = list.splice(0, count);
  }
  return _.pluck(list, 'label');
};

var buildClassifierDocuments = function(records, classifier, topHash, topList) {
  var allIngs;
  _.each(records, function(record) {
    allIngs = stemIngredients(record.ingredients, topList, topHash);
    _.each(record.categories, function(cat) {
      if (cat) {
        classifier.addDocument(allIngs.join(' '), cat);
      }
    });
  });
  classifier.train();
};

var stemIngredients = function(ingredients, topList, topHash) {
  var allIngs = _.compact(_.map(ingredients, function(ing) {
    return buildStems(ing).join(' ');
  }));

  // remove very common top x ingredients
  allIngs = _.difference(allIngs, topList);

  // remove ingredients with only 1 occurrence
  return _.compact(_.map(allIngs, function(ing) {
    if (topHash[ing] > 1) {
      return ing;
    }
  }));
};

var getClassifications = function(ingredients, classifier, count) {
  if (!_.isArray(ingredients)) {
    ingredients = [ingredients];
  }

  var classHash = {},
      valInt;

  _.each(ingredients, function(ingr) {
    var classifications = classifier.getClassifications(ingr);
    //console.log(ingr);
    classifications = _.sortBy(classifications, function(item) {
      return -1 * item.value;
    });
    classifications = classifications.splice(0, count);
    classifications = _.map(classifications, function(item) {
      valInt = parseInt(item.value * 10000000);
      if (classHash[item.label]) {
        classHash[item.label].push(valInt);
      } else {
        classHash[item.label] = [valInt];
      }
      return {
        label: item.label,
        value: valInt
      };
    });
    //console.log(classifications);
  });
  return classHash;
};

var bayesianAverage = function(avgNumVotes, avgRating, numVotes, rating) {
  return ( (avgNumVotes * avgRating) + (numVotes * rating) ) / (avgNumVotes + numVotes);
};

var calcAvgNumVotes = function(minCount, classifications) {
  // The average number of votes of all items that have numVotes > minCount
  var avgNumVotes = _.compact(_.map(classifications, function(vals, id) {
    if (vals.length > minCount) {
      return vals.length;
    }
  }));
  var length = avgNumVotes.length;
  avgNumVotes = _.reduce(avgNumVotes, function(memo, num) { return memo + num; }, 0);
  return avgNumVotes / length;
};

var calcAvgRating = function(minCount, classifications) {
  // The average rating of each item (again, of those that have numVotes > minCount)
  var avgRating = _.compact(_.map(classifications, function(vals, id) {
    if (vals.length > minCount) {
      return (_.reduce(vals, function(memo, num) { return memo + num; }, 0)) / (vals.length);
    }
  }));
  var length = avgRating.length;
  avgRating = _.reduce(avgRating, function(memo, num) { return memo + num; }, 0);
  return avgRating / length;
};

var buildBayesianAvgs = function(minCount, classifications, avgRating, avgNumVotes) {
  var classList = _.compact(_.map(classifications, function(vals, id) {
    if (vals.length > minCount) {
      //console.log(id + '-' + JSON.stringify(vals));
      var sum = _.reduce(vals, function(memo, num) { return memo + num; }, 0);
      var rating = sum / vals.length;

      return {
        id: id,
        avg: bayesianAverage(avgNumVotes, avgRating, vals.length, rating)
      };
    }
  }));

  classList = _.sortBy(classList, function(item) {
    return -1 * item.avg;
  });
  return _.map(classList, function(item) {
    return {
      id: item.id,
      avg: parseInt(item.avg)
    };
  });
};

parser.guessCategories = function(ingredients) {
  var classifier = new natural.BayesClassifier();

  var topHash = buildTopIngredients(ge);
  // now we have list of common ingredients to ignore
  var topList = buildTopIngredientList(topHash, 30);

  ingredients = stemIngredients(ingredients, topList, topHash);

  buildClassifierDocuments(ge, classifier, topHash, topList);

  var classifications = getClassifications(ingredients, classifier, 10);

  var minCount = 1,
      avgNumVotes = calcAvgNumVotes(minCount, classifications),
      avgRating = calcAvgRating(minCount, classifications);

  return buildBayesianAvgs(minCount, classifications, avgRating, avgNumVotes);
};
