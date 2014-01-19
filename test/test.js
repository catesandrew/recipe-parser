/*global require, describe, it */
// tokenizer: https://github.com/NaturalNode/natural
var assert = require('assert'),
    pluralize = require('pluralize'),
    natural = require('natural'),
    _ = require('underscore'),
    chai = require('chai');

var assert = chai.assert,
    expect = chai.expect,
    should = chai.should();

var ingredients = [
  {
    '2 pounds russet potatoes, unpeeled and scrubbed': {
      description: 'russet potatoes',
      direction: 'unpeeled and scrubbed',
      measurement: 'pounds',
      quantity: '2'
    }
  }, {
    '8 tablespoons unsalted butter (1 stick), melted': {
      description: 'unsalted butter',
      direction: 'melted',
      measurement: 'tablespoons',
      quantity: '8',
      alt: '1 stick'
    }
  }, {
    '1 1/2 teaspoons table salt': {
      description: 'table salt',
      measurement: 'teaspoons',
      quantity: '1 1/2'
    }
  }, {
    '1/2 teaspoon ground black pepper': {
      description: 'black pepper',
      direction: 'ground',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '2 tablespoons prepared horseradish': {
      description: 'prepared horseradish',
      measurement: 'tablespoons',
      quantity: '2'
    }
  }, {
    '1/4 cup grated fresh horseradish': {
      description: 'horseradish',
      direction: 'fresh, grated',
      measurement: 'cup',
      quantity: '1/4'
    }
  }, {
    '3 medium scallions, green parts only, minced': {
      description: 'scallions',
      direction: 'green parts only, minced',
      measurement: 'medium',
      quantity: '3'
    }
  }, {
    '1 1/4 teaspoons table salt': {
      description: 'table salt',
      measurement: 'teaspoons',
      quantity: '1 1/4'
    }
  }, {
    '1/2 teaspoon ground black pepper': {
      description: 'black pepper',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '2 tablespoons grainy mustard': {
      description: 'grainy mustard',
      measurement: 'tablespoons',
      quantity: '2'
    }
  }, {
    '3 ounces smoked cheddar cheese, grated (1 cup)': {
      description: 'smoked cheddar cheese',
      direction: 'grated',
      measurement: 'ounces',
      quantity: '3',
      alt: '1 cup'
    }
  }, {
    '1 teaspoon smoked paprika (sweet or bittersweet)': {
      description: 'smoked paprika',
      direction: 'sweet or bittersweet',
      measurement: 'teaspoon',
      quantity: '1'
    }
  }, {
    '8 tablespoons unsalted butter (1 stick)': {
      description: 'unsalted butter',
      measurement: 'tablespoons',
      quantity: '8',
      alt: '1 stick'
    }
  }, {
    '3 medium cloves garlic, minced or pressed through garlic press (1 generous tablespoon)': {
      description: 'garlic cloves',
      direction: 'minced or pressed through garlic press',
      measurement: 'medium',
      quantity: '3',
      alt: '1 tablespoon'
    }
  }, {
    '1/2 teaspoon ground black pepper': {
      description: 'black pepper',
      direction: 'ground',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '1 1/2 teaspoons unsalted butter': {
      description: 'unsalted butter',
      measurement: 'teaspoons',
      quantity: '1 1/2'
    }
  }, {
    '1 1/2 teaspoons vegetable oil': {
      description: 'vegetable oil',
      measurement: 'teaspoons',
      quantity: '1 1/2'
    }
  }, {
    '1/2 teaspoon light brown sugar': {
      description: 'light brown sugar',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '1 pound yellow onions (4 small or 3 medium), sliced 1/4 inch thick': {
      description: 'yellow onions',
      direction: 'sliced 1/4 inch thick',
      measurement: 'pound',
      //quantity: '1 (4 small or 3 medium)'
      quantity: '1'
    }
  }, {
    '1 cup port, preferably ruby port': {
      description: 'port',
      direction: 'preferably ruby port',
      measurement: 'cup',
      quantity: '1'
    }
  }, {
    '1 teaspoon chopped fresh thyme leaves': {
      description: 'thyme leaves',
      direction: 'fresh, chopped',
      measurement: 'teaspoon',
      quantity: '1'
    }
  }, {
    '6 tablespoons unsalted butter, melted': {
      description: 'unsalted butter',
      direction: 'melted',
      measurement: 'tablespoons',
      quantity: '6'
    }
  }, {
    '4 ounces blue cheese, crumbled': {
      description: 'blue cheese',
      direction: 'crumbled',
      measurement: 'ounces',
      quantity: '4'
    }
  }, {
    '1/2 teaspoon ground black pepper': {
      description: 'black pepper',
      direction: 'ground',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '11 ounces bread flour (2 cups)': {
      description: 'bread flour',
      direction: '(2 cups)',
      measurement: 'ounces',
      quantity: '11'
    }
  }, {
    '1/4 teaspoon instant yeast': {
      description: 'instant yeast',
      measurement: 'teaspoon',
      quantity: '1/4'
    }
  }, {
    '8 ounces water (1 cup), room temperature': {
      description: 'water',
      direction: 'room temperature',
      measurement: 'ounces',
      quantity: '8',
      alt: '1 cup'
    }
  }, {
    '16 1/2 ounces bread flour (3 cups), plus extra for dusting hands and work surface': {
      description: 'bread flour',
      direction: 'plus extra for dusting hands and work surface',
      measurement: 'ounces',
      quantity: '16 1/2',
      alt: '3 cups'
    }
  }, {
    '1 teaspoon instant yeast': {
      description: 'instant yeast',
      measurement: 'teaspoon',
      quantity: '1'
    }
  }, {
    '10.7 ounces water (1 1/3 cups), room temperature': {
      description: 'water',
      direction: 'room temperature',
      measurement: 'ounces',
      quantity: '10.7',
      alt: '1 1/3 cups'
    }
  }, {
    '3/4 cup sesame seeds': {
      description: 'sesame seeds',
      measurement: 'cup',
      quantity: '3/4'
    }
  }, {
    '4 tuna steaks, 8 ounces each and about 1 inch thick': {
      description: 'tuna steaks',
      direction: '8 ounces each and about 1 inch thick',
      quantity: '4'
    }
  }, {
    '2 tablespoons vegetable oil': {
      description: 'vegetable oil',
      measurement: 'tablespoons',
      quantity: '2'
    }
  }, {
    'Salt and ground black pepper': [
      {
        description: 'kosher salt'
      }, {
        description: 'black pepper',
        direction: 'ground'
      }
    ]
  }, {
    '1/4 cup soy sauce': {
      description: 'soy sauce',
      measurement: 'cup',
      quantity: '1/4'
    }
  }, {
    '1/4 cup rice vinegar': {
      description: 'rice vinegar',
      measurement: 'cup',
      quantity: '1/4'
    }
  }, {
    '1/4 cup water': {
      description: 'water',
      measurement: 'cup',
      quantity: '1/4'
    }
  }, {
    '2 1/2 teaspoons sugar': {
      description: 'sugar',
      measurement: 'teaspoons',
      quantity: '2 1/2'
    }
  }, {
    '1 medium scallion, sliced thin': {
      description: 'scallion',
      direction: 'sliced thin',
      measurement: 'medium',
      quantity: '1'
    }
  }, {
    '2 teaspoons minced fresh ginger': {
      description: 'ginger',
      direction: 'fresh, minced',
      measurement: 'teaspoons',
      quantity: '2'
    }
  }, {
    '1 1/2 teaspoons toasted sesame oil': {
      description: 'sesame oil',
      direction: 'toasted',
      measurement: 'teaspoons',
      quantity: '1 1/2'
    }
  }, {
    '1/2 teaspoon red pepper flakes': {
      description: 'red pepper flakes',
      measurement: 'teaspoon',
      quantity: '1/2'
    }
  }, {
    '4 teaspoons cracked black peppercorns (or cracked white peppercorns)': [
      {
        description: 'black peppercorns',
        direction: 'cracked',
        measurement: 'teaspoons',
        quantity: '4'
      }, {
        description: 'white peppercorns',
        direction: 'cracked',
        measurement: 'teaspoons',
        quantity: '4'
      }
    ]
  }, {
    '4 ounces salt pork, trimmed of rind and cut into 1/2-inch cubes': {
      description: 'salt pork',
      direction: 'trimmed of rind and cut into 1/2-inch cubes',
      measurement: 'ounces',
      quantity: '4'
    }
  }, {
    '2 ounces bacon (2 slices), cut into 1/4-inch pieces': {
      description: 'bacon',
      direction: 'cut into 1/4-inch pieces',
      measurement: 'ounces',
      quantity: '2',
      alt: '2 slices'
    }
  }, {
    '1 medium onion, chopped fine': {
      description: 'onion',
      direction: 'chopped fine',
      measurement: 'medium',
      quantity: '1'
    }
  }, {
    '1/2 cup mild molasses': {
      description: 'mild molasses',
      direction: '',
      measurement: 'cup',
      quantity: '1/2'
    }
  }, {
    '1 1/2 to 2 tablespoons brown mustard': {
      description: 'brown mustard',
      measurement: 'tablespoons',
      quantity: '1 1/2 to 2'
    }
  }, {
    '1 pound dried small white beans (about 2 cups), rinsed and picked over': {
      description: 'dried small white beans',
      direction: 'rinsed and picked over',
      measurement: 'pound',
      quantity: '1',
      alt: 'about 2 cups'
    }
  }, {
    'Table salt': {
      description: 'table salt'
    }
  }, {
    '1 teaspoon cider vinegar': {
      description: 'cider vinegar',
      measurement: 'teaspoon',
      quantity: '1'
    }
  }, {
    'Ground black pepper': {
      description: 'black pepper',
      direction: 'ground'
    }
  }, {
    '3 1/2 tablespoons soy sauce': {
      description: 'soy sauce',
      measurement: 'tablespoons',
      quantity: '3 1/2'
    }
  }, {
    '3 tablespoons rice wine': {
      description: 'rice wine',
      measurement: 'tablespoons',
      quantity: '3'
    }
  }, {
    '2 tablespoons minced scallions': {
      description: 'scallions',
      direction: 'minced',
      measurement: 'tablespoons',
      quantity: '2'
    }
  }, {
    '2 tablespoons minced fresh ginger': {
      description: 'ginger',
      direction: 'fresh, minced',
      measurement: 'tablespoons',
      quantity: '2'
    }
  }, {
    '1 1/2 tablespoons black Chinese vinegar or Worcestershire sauce': [
      {
        description: 'black Chinese vinegar',
        measurement: 'tablespoons',
        quantity: '1 1/2'
      }, {
        description: 'Worcestershire sauce',
        measurement: 'tablespoons',
        quantity: '1 1/2'
      }
    ]
  }, {
    '1 teaspoon sesame oil': {
      description: 'sesame oil',
      measurement: 'teaspoon',
      quantity: '1'
    }
  }, {
    '1/2 pound medium shrimp, peeled and butterflied': {
      description: 'shrimp',
      direction: 'medium, peeled and butterflied',
      measurement: 'pound medium', // should return really just pound
      quantity: '1/2'
    }
  }, {
    '1/2 pound scallops, sliced horizontally in half': {
      description: 'scallops',
      direction: 'sliced horizontally in half',
      measurement: 'pound',
      quantity: '1/2'
    }
  }, {
    '1 quart Quick Broth (see related recipe)': {
      description: 'Quick Broth',
      direction: 'see related recipe',
      measurement: 'quart',
      quantity: '1'
    }
  }, {
    // will want this to translate to qty:1, measure:2 inch piece
    '2 inch piece fresh ginger, sliced thin': {
      description: 'ginger',
      direction: 'fresh, sliced thin',
      measurement: 'inch piece',
      quantity: '2'
    }
  }, {
    '10 Chinese black mushrooms, softened in hot water, stems removed and caps cut into quarters': {
      description: 'Chinese black mushrooms',
      direction: 'softened in hot water, stems removed and caps cut into quarters',
      quantity: '10'
    }
  }, {
    '1/2 cup rice wine or sake': [
      {
        description: 'Or',
        isDivider: true,
        ingredients: [
          {
            description: 'rice wine',
            measurement: 'cup',
            quantity: '1/2'
          }, {
            description: 'sake',
            measurement: 'cup',
            quantity: '1/2'
          }
        ]
      }
    ]
  }, {
    'Table salt': {
      description: 'table salt'
    }
  }, {
    '1 tablespoon vegetable oil or peanut oil': [
      {
        description: 'Or',
        isDivider: true,
        ingredients: [
          {
            description: 'vegetable oil',
            measurement: 'tablespoon',
            quantity: '1'
          }, {
            description: 'peanut oil',
            measurement: 'tablespoon',
            quantity: '1'
          }
        ]
      }
    ]
  }, {
    '8 medium cloves garlic, smashed and skins removed': {
      description: 'garlic cloves',
      direction: 'smashed and skins removed',
      measurement: 'medium',
      quantity: '8'
    }
  }, {
    // will want quantity to be '1 large'
    '1 large head small Napa cabbage or celery cabbage, about 2 1/2 pounds, halved lengthwise and cored, leaves cut into 2-inch squares': [
      {
        description: 'Or',
        isDivider: true,
        ingredients: [
          {
            description: 'small Napa cabbage',
            direction: 'halved lengthwise and cored, leaves cut into 2-inch squares',
            measurement: 'large head',
            quantity: '1',
            alt: 'about 2 1/2 pounds'
          }, {
            description: 'celery cabbage',
            direction: 'halved lengthwise and cored, leaves cut into 2-inch squares',
            measurement: 'large head',
            quantity: '1',
            alt: 'about 2 1/2 pounds'
          }
        ]
      }
    ]
  }, {
    '1/2 pound snow peas, ends snapped and strings removed': {
      description: 'snow peas',
      direction: 'ends snapped and strings removed',
      measurement: 'pound',
      quantity: '1/2'
    }
  }
];

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

//var reNumber = /(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|to)? *(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?.*$/;
var reNumber = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|to)? *(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?(.*)$/;

function remove(array, from, to) {
  var rest = array.slice((to || from) + 1 || array.length);
  array.length = from < 0 ? array.length + from : from;
  return array.push.apply(array, rest);
}

function parseQuantity(text) {
  var breakdown = {},
      retval = [],
      matches;

  matches = text.match(reNumber);

  if (!matches) {
    return retval;
  }

  // remove the first element
  remove(matches, 0, 0);

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
  remove(retval, 2, 50);
  return retval;
}

function pruneQuantity(text) {
  var matches = text.match(reNumber);

  if (!matches) {
    return;
  }

  var idx = 5;
  if (matches.length > idx) {
    return matches[idx];
  }
}

var chopWordsFromFront = function(text, array, from) {
  var punctStr = '[-!"#$%&\'()\\*+,\\.\\/:;<=>?@\\^_`{|}~]',
      tokenizer = new natural.WordTokenizer(),
      matched,
      found = 0;

  var tokens = _.first(tokenizer.tokenize(text), from);
  for (var i = 0, l = tokens.length; i < l; i++) {
    if (_.indexOf(array, tokens[i].toLowerCase(), true) >= 0) {
      found = i + 1;
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

// test helper functions
function getKeyFromTestData(value, key) {
  var retval;

  if (_.isArray(value)) {
    retval = _.map(value, function(val) {
      if (val.isDivider) {
        return _.pluck(val.ingredients, key);
      } else {
        return val[key];
      }
    });
  } else {
    retval = value[key];
  }
  if (_.isArray(retval)) {
    return retval;
  }
  return [retval];
}

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

[
  'dozen', 'small', 'medium', 'large', 'mini', 'whole'
].forEach(pluralize.addUncountableRule);

_measurements = _.union(_measurements, _.map(_measurements, function(measurement) {
  return pluralize.plural(measurement);
})).sort();

var pluralizeTests = [
  // Uncountables.
  ['dozen', 'dozen'],
  ['feet', 'feet'],
  ['large', 'large'],
  ['medium', 'medium'],
  ['mini', 'mini'],
  ['small', 'small'],
  ['whole', 'whole'],
  // Pluralization.
  ['man', 'men'],
  ['superman', 'supermen'],
  ['ox', 'oxen'],
  ['bag', 'bags'],
  ['batch', 'batches'],
  ['block', 'blocks'],
  ['bottle', 'bottles'],
  ['box', 'boxes'],
  ['bunch', 'bunches'],
  ['can', 'cans'],
  ['clove', 'cloves'],
  ['container', 'containers'],
  ['crown', 'crowns'],
  ['cube', 'cubes'],
  ['cup', 'cups'],
  ['dash', 'dashes'],
  ['drop', 'drops'],
  ['ear', 'ears'],
  ['envelope', 'envelopes'],
  ['fillet', 'fillets'],
  ['fluid ounce', 'fluid ounces'],
  ['gallon', 'gallons'],
  ['grind', 'grinds'],
  ['half', 'halves'],
  ['handful', 'handfuls'],
  ['head', 'heads'],
  ['heart', 'hearts'],
  ['leaf', 'leaves'],
  ['liter', 'liters'],
  ['loaf', 'loaves'],
  ['ounce', 'ounces'],
  ['package', 'packages'],
  ['packet', 'packets'],
  ['part', 'parts'],
  ['pat', 'pats'],
  ['piece', 'pieces'],
  ['pinch', 'pinches'],
  ['pint', 'pints'],
  ['pouch', 'pouches'],
  ['pound', 'pounds'],
  ['quart', 'quarts'],
  ['recipe', 'recipes'],
  ['scoop', 'scoops'],
  ['set', 'sets'],
  ['sheet', 'sheets'],
  ['side', 'sides'],
  ['slab', 'slabs'],
  ['slice', 'slices'],
  ['splash', 'splashes'],
  ['sprig', 'sprigs'],
  ['sprinkle', 'sprinkles'],
  ['stalk', 'stalks'],
  ['stem', 'stems'],
  ['stick', 'sticks'],
  ['strip', 'strips'],
  ['tablespoon', 'tablespoons'],
  ['teaspoon', 'teaspoons'],
  ['tin', 'tins'],
  ['vial', 'vials']
];

describe('pluralize', function () {
  it('should pluralize words', function () {
    pluralizeTests.forEach(function (word) {
      assert.equal(pluralize.plural(word[0]), word[1]);
    });
  });
});

describe('cooks illustrated instructions parser', function() {
  it('should parse quantity', function() {
    var expectedQuantity,
        quantity,
        key,
        value,
        tokens,
        retval;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedQuantity = getKeyFromTestData(value, 'quantity');
      //console.log(expectedQuantity);
      quantity = undefined;

      tokens = _.compact(_.map(parseQuantity(key), function(duple) {
        if (duple.whole && duple.part) {
          return duple.whole + ' ' + duple.part;
        } else if (duple.whole) {
          return duple.whole;
        } else if (duple.part) {
          return duple.part;
        }
      }));
      //console.log(tokens);
      if (tokens.length) {
        quantity = tokens.join(' to ');
      }
      //console.log(quantity);

      _.each(expectedQuantity, function(expected) {
        if (_.isArray(expected)) {
          _.each(expected, function(expectedChild) {
            expect(expectedChild).to.equal(quantity);
          });
        } else {
          expect(expected).to.equal(quantity);
        }
        //console.log('Quantity: ' + quantity);
      });
    });
  });

  it('should parse measurement', function() {
    var expectedMeasurement,
        measurement,
        key,
        value;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedMeasurement = getKeyFromTestData(value, 'measurement');
      measurement = (chopWordsFromFront(pruneQuantity(key), _measurements, 2) || {}).matched;

      _.each(expectedMeasurement, function(expected) {
        if (_.isArray(expected)) {
          _.each(expected, function(expectedChild) {
            expect(expectedChild).to.equal(measurement);
          });
        } else {
          expect(expected).to.equal(measurement);
        }
        //console.log('Measurement: ' + measurement);
      });

    });
  });

  it('should parse description', function() {
    var commaRe = /^([^,]*)(?:,\s+(.*))?$/;
    var parenthesesRe = /\(([^\)]*)\)/;
    var andOrSplitterRe = /(?:\s+)?(?:or|and)\s+/i;

    var expectedDescription,
        descriptions,
        description,
        parentheses,
        matches,
        value,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedDescription = getKeyFromTestData(value, 'description');
      description = (chopWordsFromFront(pruneQuantity(key), _measurements, 2) || {}).pruned;
      parentheses = undefined;

      //console.log('>' + description);
      matches = description.match(commaRe);

      // remove the first element
      remove(matches, 0, 0);
      description = _.first(matches);

      // unsalted butter (1 stick)
      // smoked paprika (sweet or bittersweet)
      // unsalted butter (1 stick)
      // yellow onions (4 small or 3 medium)
      // bread flour (2 cups)
      // water (1 cup)
      // bread flour (3 cups)
      // water (1 1/3 cups)
      // bacon (2 slices)
      // dried small white beans (about 2 cups)
      // ground black pepper
      // grated fresh horseradish
      // minced fresh ginger
      // fresh ginger
      // minced scallions
      // toasted sesame oil
      // chopped fresh thyme
      // cloves garlic
      // Salt and ground black pepper
      // black Chinese vinegar or Worcestershire sauce
      // vegetable oil or peanut oil
      // small Napa cabbage or celery cabbage
      // cracked black peppercorns (or cracked white peppercorns)

      // strip out parentheses.  match(/\([^\)]*\)/)
      // split on `or` or `and`  .split(/(?:\s+)?(?:or|and)\s+/i)
      // if first word contained in parentheses is `or` then split
      //   ex, (or cracked white peppercorns) vs (sweet or bittersweet)

      // strip out parentheses
      matches = description.match(parenthesesRe);
      if (matches) {
        remove(matches, 0, 0); // remove the first element
        parentheses = _.first(matches);
        // remove the parentheses from the description
        description = description.replace(parenthesesRe, '');
      }

      // split on `or` or `and`
      descriptions = description.split(andOrSplitterRe);

      // if first word contained in parentheses is `or` then split
      if (parentheses && parentheses.indexOf('or') === 0) {
        descriptions.push(parentheses.split(andOrSplitterRe)[1]);
      }

      // clean up
      descriptions = _.map(descriptions, function(desc) {
        // trim and replace extra spaces with one
        return desc.trim().replace(/\s{2,}/g, ' ');
      });

      var _words = [
        'chopped', 'cracked', 'fresh',  'grated', 'ground', 'minced', 'toasted'
      ]

      descriptions = _.map(descriptions, function(desc) {
        desc = (chopWordsFromFront(desc, _words, 2) || {}).pruned;
        if (desc == 'cloves garlic') {
          return 'garlic cloves';
        } else if (desc.toLowerCase() == 'salt') {
          return 'kosher salt';
        } else if (desc.toLowerCase() == 'table salt') {
          return 'table salt';
        }
        return desc;
      });


      //console.log(descriptions);
      //console.log(expectedDescription);

      for (var i = 0, l = expectedDescription.length; i < l; i++) {
        if (_.isArray(expectedDescription[i])) {
          for (var j = 0, ll = expectedDescription[i].length; j < ll; j++) {
            expect(expectedDescription[i][j]).to.equal(descriptions[j]);
          }
        } else {
          expect(expectedDescription[i]).to.equal(descriptions[i]);
        }
      }

    });
  });
});
