/* jshint indent: false */
var async = require('async'),
    fs = require('fs'),
    request = require('request'),
    cheerio = require('cheerio'),
    program = require('commander'),
    changeCase = require('change-case'),
    http = require('http'),
    URL = require('url');

var constants = require('./lib/mac-gourmet-constants').constants,
    Parser = require('./lib/serious-eats-parser'),
    MacGourmetExport = require('./lib/mac-gourmet-export'),
    CategoryClassifier = require('./lib/category-classifier'),
    parser = new Parser(),
    exporter = new MacGourmetExport(),
    classifier = new CategoryClassifier();

var main = require('./main'),
    util = main.util,
    log = main.log,
    _ = util._;

program
  .version('0.1')
  .description('Scrub a recipe from seriouseats.com.')
  .option('-u, --url <string>', 'url of recipe to scrub from.')
  .option('-s, --save', 'save scrubbed ingredients (used for regression)?')
  .option('-t, --title', 'just parse the title.')
  .option('-d, --debug', 'output extra debug information?')
  .parse(process.argv);

main.option.debug = program.debug;

//log.warn('warn');       // >> warn
//log.error('error');     // >> error
//log.ok('ok');           // >> ok
//log.success('success'); // success
//log.fail('fail');       // fail
//log.debug('debug');     // [D] debug

var listHelper = function($, selector, context, callback) {
  if (context) {
    if (_.isFunction(context)) {
      callback = context;
      context = undefined;
    }
  }

  try {
    var elements = $(selector, context);
    log.debug(elements.length);
    if (elements.length) {
      elements.each(function(index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch(e) {
    log.errorlns(e);
  }
};

var addTitle = function($, obj) {
  log.writelns('Adding Title');
  var text;

  listHelper($, '.hrecipe h1.fn', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util.text(this));
    log.oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  log.writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function(index, meta) {
    obj.datePublished = _.trim(_.first(util.text(this).split(util.linefeed)));
    log.oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  log.writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function(index, h4) {
    obj.servings = util.substituteFraction(_.trim(util.text(this)));
    log.oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log.writelns('Adding Image');

  listHelper($, '.hrecipe .content-unit img', function() {
    obj.image = {
      src: this.attr('src'),
      alt: this.attr('alt')
    };
    return false; // stop iterating
  });
};

var addSummary = function($, obj) {
  obj.summaries || (obj.summaries = []);
  log.writelns('Adding Summary');
  var text;

  listHelper($, '.hrecipe .content-unit .summary p', function(index, summary) {
    //console.log(this);  // refers to the $ wrapped summary element
    //console.log(summary); //refers to the plain summary element

    if (this.attr('class')) {
      return; // do nothing
    }

    if (this.children().length) {
      var child = this.children().first();
      if (child && child.length) {
        if (child[0].name === 'small') {
          return; // do nothing
        }
      }
    }

    text = util.substituteDegree(util.substituteFraction(_.trim(util.fulltext(summary))));
    log.ok(index + 1 + '- ' + text);
    obj.summaries.push(text);
  });
};

var addIngredients = function($, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  log.writelns('Adding Ingredients');
  var top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.hrecipe .content-unit .ingredients ul li span', function(index, ingredient) {
    if (!this.children('strong').length) {
      text = _.trim(util.fulltext(ingredient));
      retval = parser.parseIngredient(text);
      saveInbObj = {};
      saveInbObj[text] = retval;
      obj.saveIngredients.push(saveInbObj);

      (function walker(vals) {
        if (_.isArray(vals)) {
          _.each(vals, function(val) {
            walker(val);
          });
        } else if (vals.isDivider) {
          log.oklns(vals.description);
          walker(vals.ingredients);
        } else {
          if (vals.description) {
            descriptions.push(vals.description);
          }
          output = _.compact([vals.quantity, vals.measurement, vals.description]).join(' ');
          if (vals.direction) {
            output += ', ' + vals.direction;
          }
          if (vals.alt) {
            output += ' (' + vals.alt + ')';
          }
          if (!_.isEmpty(output)) {
            log.ok(util.substituteDegree(util.substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function() {
        log.ok('Group: ' + _.trim(util.text(this)));
        var parent = {
          description: _.trim(util.text(this)),
          isDivider: true,
          ingredients: []
        };
        top.push(parent);
        list = parent.ingredients;
      });
    }
  });
  //console.log(JSON.stringify(obj.ingredients, null, 2));

  log.writelns('Guessing Categories');
  var categories = classifier.guessCategories(descriptions);
  _.each(categories, function(cat) {
    obj.categories.push({
      id: constants.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header,
      match,
      text,
      img,
      tmp;

  listHelper($, '.hrecipe .procedure ol.instructions li', function(index, procedure) {
    header = img = undefined;
    text = '';

    listHelper($, '.recipe-image-large > img', this, function() {
      img = this.attr('src');
    });

    listHelper($, '.procedure-text', this, function() {
      listHelper($, 'strong', this, function() {
        header = _.trim(util.text(this));
      });

      listHelper($, 'p', this, function(idx, proc) {
        tmp = _.trim(util.substituteDegree(util.substituteFraction(util.fulltext(proc))));
        if (!_.isEmpty(tmp)) {
          if (header) {
            tmp = _.trim(tmp.replace(header, ''));
          }
          text += tmp;
        }
      });

      if (header) {
        header = _.trim(header);
        header = changeCase.titleCase(header);
        match = header.match(removeEndingColonRe);
        if (match) {
          header = match[1];
        }
      }

      obj.procedures.push({
        header: header,
        text: text,
        image: {
          src: img
        }
      });
    });

    if (header) {
      log.oklns(index + 1 + ' # ' + header + ' # ' + text);
    } else {
      log.oklns(index + 1 + ' - ' + text);
    }
  });
};

var addNotes = function($, obj) {
  log.writelns('Adding Notes');
  obj.notes || (obj.notes = []);
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function($, obj) {
  log.writelns('Adding Times');
  obj.times || (obj.times = []);
  var times = obj.times,
      minutes,
      text;

  var parseTime = function(str) {
    var matches;

    return _.map([hoursRe, minutesRe], function(re) {
      matches = str.match(re);
      if (!matches) { return {}; }

      util.remove(matches, 0, 0);
      if (matches.length > 1) {
        return {
          whole: matches[0],
          part: matches[1]
        };
      } else if (matches.length > 0) {
        return {
          whole: matches[0]
        };
      }
    });
  };

  var calcMinutes = function(array) {
    var multiplier = 60,
        loopSum;
    return _.reduce(array, function(memo, time, index) {
      if (index === 1) { multiplier = 1; }
      loopSum = 0;
      if (time) {
        if (time.whole) {
          loopSum += parseInt((eval(time.whole) * multiplier), 10);
        }
        if (time.part) {
          loopSum += parseInt((eval(time.part) * multiplier), 10);
        }
        return memo + loopSum;
      }
      return memo;
    }, 0);
  };

  var splitUp = function(minutes, kind) {
    return {
      kind: kind,
      hours: Math.floor(minutes/60),
      minutes: minutes % 60
    };
  };

  // 9 - prep
  // 10 - cook
  // 30 - total
  // 28 - inactive
  listHelper($, '.hrecipe .recipe-about td span.prepTime', function() {
    text = _.trim(util.text(this));
    log.oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function() {
    text = _.trim(util.text(this));
    log.oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30));  // total time
    return false; // stop iterating
  });
};

var addCourse = function($, obj) {
  obj.categories || (obj.categories = []);
  log.writelns('Adding Course');
};

var addAsideNotes = function($, obj) {
  log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function($, obj) {
  log.writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function(index, tag) {
    tags.push(_.trim(util.fulltext(tag)));
  });
  log.oklns(tags.join(', '));
};

var scrape = function(callback, url, justTitle) {
  request(url, function (err, response, body) {
    if (err) { throw err; }
    var $ = cheerio.load(body, {
      verbose: true,
      ignoreWhitespace: true
    });

    var obj = {};
    addTitle($, obj);

    if (!justTitle) {
      addDatePublished($, obj);
      addServings($, obj);
      addImage($, obj);
      addSummary($, obj);
      addIngredients($, obj);
      addProcedures($, obj);
      addNotes($, obj);
      addTimes($, obj);
      addCourse($, obj);
      addAsideNotes($, obj);
      addTags($, obj);

      obj.parsedUrl = URL.parse(url, true);
      delete obj.parsedUrl.query;
      delete obj.parsedUrl.search;

      obj.publicationPage = [
        "<ul><li><a href='",
        URL.format(obj.parsedUrl),
        "'>",
        obj.datePublished,
        '</a></li></ul>'
      ].join('');
    }

    callback(null, [obj]);
  });
};

if (program.url) {
  var url = program.url;

  scrape(function(err, items) {
    if (err) { log.error(err); }

    if (program.save) {
      util.saveIngredients(items, parser.get('dataFile'));
    }

    var images = util.collateAllImages(items);
    util.downloadAllImages(images, function(err) {
      if (err) { log.error(err); }
      _.each(items, function(item) {
        if (!program.title) {
          util.savePlistToFile(exporter.exportRecipe(item, 'Serious Eats'));
        }
        log.ok('Recipe Title:' + item.title);
      });
    });

  }, url, program.title);
}
else {
  log.writelns(program.description());
  log.writelns('Version: ' + program.version());
  log.writelns(program.helpInformation());
}
