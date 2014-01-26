/*global require, describe, it */
var assert = require('assert'),
    nodeUtil = require('util'),
    natural = require('natural'),
    pluralize = require('pluralize'),
    chai = require('chai'),
    ingredients = require('./data/cooks-illustrated'),
    main = require('../main');

var expect = chai.expect;
var util = main.util,
    _ = util._,
    parser = main.cooksIllustratedParser;

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

describe('pluralize', function () {
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

  it('should pluralize words', function () {
    pluralizeTests.forEach(function (word) {
      expect(word[1]).to.equal(pluralize.plural(word[0]));
    });
  });
});

describe('cooks illustrated instructions parser', function() {
  it('should parse quantity', function() {
    var expectedQuantity,
        quantity,
        value,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedQuantity = getKeyFromTestData(value, 'quantity');
      quantity = parser.getQuantity(key);

      _.each(expectedQuantity, function(expected) {
        if (_.isArray(expected)) {
          _.each(expected, function(expectedChild) {
            expect(expectedChild).to.equal(quantity);
          });
        } else {
          expect(quantity).to.equal(expected);
        }
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
      measurement = (parser.getMeasurement(key) || {}).matched;

      _.each(expectedMeasurement, function(expected) {
        if (_.isArray(expected)) {
          _.each(expected, function(expectedChild) {
            expect(measurement).to.equal(expectedChild);
          });
        } else {
          expect(measurement).to.equal(expected);
        }
      });
    });
  });

  it('should parse description', function() {
    var expectedDescriptions,
        descriptions,
        value,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedDescriptions = getKeyFromTestData(value, 'description');
      descriptions = (parser.getDescriptions(key) || {}).descriptions;

      for (var i = 0, l = expectedDescriptions.length; i < l; i++) {
        if (_.isArray(expectedDescriptions[i])) {
          for (var j = 0, ll = expectedDescriptions[i].length; j < ll; j++) {
            expect(expectedDescriptions[i][j]).to.equal(descriptions[j]);
          }
        } else {
          expect(descriptions[i]).to.equal(expectedDescriptions[i]);
        }
      }
    });
  });

  it('should parse directions and alts', function() {
    var expectedDirections,
        expectedAlts,
        directions,
        value,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      value = _.first(_.values(ingredient));
      expectedDirections = getKeyFromTestData(value, 'direction');
      expectedAlts = getKeyFromTestData(value, 'alt');
      directions = parser.getDirectionsAndAlts(key);

      for (var i = 0, l = expectedDirections.length; i < l; i++) {
        if (_.isArray(expectedDirections[i])) {
          for (var j = 0, ll = expectedDirections[i].length; j < ll; j++) {
            expect(directions[j].direction).to.equal(expectedDirections[i][j]);
            expect(directions[j].alt).to.equal(expectedAlts[i][j]);
          }
        } else {
          expect(directions[i].direction).to.equal(expectedDirections[i]);
          expect(directions[i].alt).to.equal(expectedAlts[i]);
        }
      }

    });
  });

  it('should collate all data, [quantity, measurement, description, direction, and alts]', function() {
    var descriptionObjs,
        descriptions,
        measurement,
        directions,
        allPieces,
        quantity,
        values,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      values = _.first(_.values(ingredient));

      allPieces = parser.getAllPieces(key);
      quantity = allPieces.quantity;
      measurement = allPieces.measurement;
      descriptionObjs = allPieces.descriptions;
      descriptions = descriptionObjs.descriptions;
      directions = allPieces.directions;

      function arrayWalker(array) {
        var obj = array[0],
            desc = array[1],
            dir = array[2];
        if (obj.finale) {
          expect(quantity).to.equal(obj.finale.quantity);
          expect(measurement).to.equal(obj.finale.measurement);
          expect(desc).to.equal(obj.finale.description);
          expect(dir.direction).to.equal(obj.finale.direction);
          expect(dir.alt).to.equal(obj.finale.alt);
        } else {
          expect(quantity).to.equal(obj.quantity);
          expect(measurement).to.equal(obj.measurement);
          expect(desc).to.equal(obj.description);
          expect(dir.direction).to.equal(obj.direction);
          expect(dir.alt).to.equal(obj.alt);
        }
      }

      function zipWalker(arrays) {
        _.each(arrays, function(array) {
          arrayWalker(array);
        });
      }

      (function walker(vals) {
        if (_.isArray(vals)) {
          if (vals.length > 1) {
            // where an ingredient gets broken down into two or more sub
            // ingredients, typically happens for `and` types. For example `salt
            // and pepper` gets broken down into `salt` and `black pepper`
            zipWalker(_.zip(vals, descriptions, directions));
          } else {
            // when an ingredient gets broken down into two or more sub
            // ingredients, typically happens for `or` types. The typage is
            // important as it denotes a grouping to the callee.
            _.each(vals, function(val) {
              walker(val);
            });
          }
        } else if (vals.isDivider) {
          zipWalker(_.zip(vals.ingredients, descriptions, directions));
        } else {
          zipWalker(_.zip([vals], descriptions, directions));
        }
      })(values);

    });
  });

  it('should collate and produce a pretty result', function() {
    var values,
        retval,
        key;

    _.each(ingredients, function(ingredient) {
      key = _.first(_.keys(ingredient));
      values = _.first(_.values(ingredient));

      retval = parser.parseIngredient(key);
      if (retval.isDivider) {
        retval = [retval]; // to match test data
      }

      if (values.finale) {
        expect(retval).to.deep.equal(values.finale);
      } else {
        expect(retval).to.deep.equal(values);
      }

    });
  });
});

