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
    CategoryClassifier = require('./lib/category-classifier'),
    parser = new Parser(),
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

// http://www.seriouseats.com/recipes/2014/01/spicy-cumin-wings-recipe.html
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
    }

    callback(null, [obj]);
  });
};

if (program.url) {
  var url = program.url,
      parsedUrl = URL.parse(url, true);

  delete parsedUrl.query;
  delete parsedUrl.search;

  var exportRecipe = function(item) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;

    // Add Categories
    var categories = obj['CATEGORIES'] = [];
    var addCategory = function(id, name, userAdded) {
      categories.push({
        CATEGORY_ID: id,
        ITEM_TYPE_ID: 102,
        NAME: name,
        USER_ADDED: userAdded
      });
    };
    _.each(item.categories, function(category) {
      addCategory(category.id, category.name, false);
    });

    // Add course
    if (item.course) {
      obj['COURSE_ID'] = parseInt(item.course.id, 10);
      obj['COURSE_NAME'] = item.course.name;
    } else {
      obj['COURSE_ID'] = 2;
      obj['COURSE_NAME'] = 'Main';
    }

    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;

    // Add directions
    var directions = obj['DIRECTIONS_LIST'] = [];
    var procText, procObj;
    _.each(item.procedures, function(procedure) {
      procText = _.trim(procedure.text);
      if (procText) {
        procText = util.trimMultipleWhiteSpace(procText);
        procObj = {
          VARIATION_ID: -1,
          LABEL_TEXT: procedure.header || '',
          IS_HIGHLIGHTED: false,
          DIRECTION_TEXT: procText
        };
        if (procedure.image) {
          procObj['IMAGE'] = procedure.image.data;
        }
        directions.push(procObj);
      }
    });

    // EQUIPMENT

    // Add main picture
    if (item.image && item.image.data) {
      obj['EXPORT_TYPE'] = 'BINARY';
      obj['IMAGE'] = item.image.data;
    }

    // Add Ingredients
    var list = obj['INGREDIENTS_TREE'] = [];
    (function walker(array, list, isTop) {
      if (_.isArray(array)) {
        _.each(array, function(item) {
          walker(item, list, isTop);
        });
      }
      else if (array.isDivider) {
        if (/*!isTop &&*/ array.description === 'Or') { //flatten if not on top
          var tmpDesc = _.map(array.ingredients, function(ingredient) {
            return ingredient.description;
          }).join(' or ');

          walker({
            quantity: array.ingredients[0].quantity,
            measurement: array.ingredients[0].measurement,
            description: tmpDesc,
            direction: array.ingredients[0].direction,
            alt: array.ingredients[0].alt
          }, list, isTop);
        }
        else {
          var tmp = {};
          tmp['DIVIDER_INGREDIENT'] = {
            DESCRIPTION: array.description,
            DIRECTION: '',
            INCLUDED_RECIPE_ID: -1,
            IS_DIVIDER: true,
            IS_MAIN: false,
            MEASUREMENT: '',
            QUANTITY: '' + array.ingredients.length
          };

          var children = [];
          tmp['INGREDIENTS'] = children;
          list.push(tmp);
          walker(array.ingredients, children, false);
        }
      }
      else {

        var tmp = '';
        if (array.direction) {
          tmp += array.direction;
        }
        if (array.alt) {
          tmp = tmp + ' (' + array.alt + ')';
        }
        tmp = util.substituteDegree(util.substituteFraction(tmp));

        list.push({
          DESCRIPTION: array.description,
          DIRECTION: tmp,
          INCLUDED_RECIPE_ID: -1,
          IS_DIVIDER: false,
          IS_MAIN: false,
          MEASUREMENT: array.measurement || '',
          QUANTITY: array.quantity || ''
        });
      }
    })(item.ingredients, list, true);

    if (item.tags) {
      obj['KEYWORDS'] = item.tags.join(', ');
    } else {
      obj['KEYWORDS'] = '';
    }

    obj['MEASUREMENT_SYSTEM'] = 0;  // US Standard
    obj['NAME'] = item.title;
    obj['NOTE'] = '';

    // Add Notes and Aside Notes (with pictures)
    var notes = obj['NOTES_LIST'] = [];
    var i = 0, tmp, title;
    _.each(item.notes, function(note) {
      tmp = {};
      notes.push({
        'NOTE_TEXT': note,
        'SORT_ORDER': i++,
        'TYPE_ID': 10
      });
    });
    _.each(item.asideNotes, function(asideNote) {
      title = [
          '<h4>' + asideNote.h4 + '</h4>',
          '<h3>' + asideNote.h3 + '</h3>' ];

      var intros = _.map(asideNote.intros, function(intro) {
        return '<p>' + intro + '</p>';
      }).join(util.linefeed);

      if (intros && intros.length) {
        notes.push({
          'NOTE_TEXT': title.concat(intros).join(util.linefeed),
          'SORT_ORDER': i++,
          'TYPE_ID': 10
        });
        title = []; // reset the <h4> and <h3>
      }

      _.each(asideNote.notes, function(note) {
        tmp = {
          'NOTE_TEXT': title.concat(['<p>' + note.text + '</p>']).join(util.linefeed),
          'SORT_ORDER': i++,
          'TYPE_ID': 10
        };
        title = []; // reset the <h4> and <h3>

        if (note.image && note.image.data) {
          tmp['IMAGE'] = note.image.data;
        }
        notes.push(tmp);
      });
    });

    obj['NUTRITION'] = '';

    // PREP_TIMES
    var preps = obj['PREP_TIMES'] = [];
    if (item.times) {
      _.each(item.times, function(time) {
        preps.push({
          TIME_TYPE_ID: time.kind,
          AMOUNT: time.hours > 0 ? time.hours : time.minutes,
          AMOUNT_2: time.hours > 0 ? time.minutes : 0,
          TIME_UNIT_ID: time.hours > 0 ? 1 : 2,
          TIME_UNIT_2_ID: time.hours > 0 ? 2 : 1
        });
      });
    }

    obj['PUBLICATION_PAGE'] = URL.format(parsedUrl);
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Serious Eats';

    // Add Summary
    obj['SUMMARY'] = _.map(item.summaries, function(summary) {
      return '<p>' + summary + '</p>';
    })
    .join(util.linefeed);

    obj['TYPE'] = 102;
    obj['URL'] = URL.format(parsedUrl);
    obj['YIELD'] = item.servings;


    var plistFile = util.expandHomeDir('~/Desktop/recipe.mgourmet4');
    util.writePlist(function(err, obj) {
      if (err) { console.error(err); }
    }, [obj], plistFile);
  };

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
          exportRecipe(item);
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
