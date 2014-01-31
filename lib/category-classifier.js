// Nodejs libs.
var nodeUtil = require('util'),
    pluralize = require('pluralize'),
    Backbone = require('backbone'),
    natural = require('natural'),
    ge = require('../test/data/good-eats');

var main = require('../main'),
    util = main.util,
    log = main.log,
    _ = util._;

// code for guessing categories...
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

var CategoryClassifier = module.exports = Backbone.Model.extend({
  initialize: function() {
  },
  guessCategories: function(ingredients) {
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
  }
});

