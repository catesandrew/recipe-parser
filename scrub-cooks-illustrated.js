/* jshint indent: false */
var nodeUtil = require('util'),
    async = require('async'),
    fs = require('fs'),
    request = require('request'),
    cheerio = require('cheerio'),
    program = require('commander'),
    http = require('http'),
    URL = require('url');

var main = require('./main'),
    constants = main.mgdConstants.constants,
    parser = main.cooksIllustratedParser,
    util = main.util,
    log = main.log,
    _ = util._;

//https://github.com/chriso/validator.js
//https://github.com/fb55/node-entities

program
  .version('0.1')
  .description('Scrub a recipe from cooksillustrated.com.')
  .option('-u, --url <string>', 'url of recipe to scrub from.')
  .option('-s, --save', 'save scrubbed ingredients (used for regression)?')
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
    /*
    else if (elements.children && elements.children.length) {
      //log.writelns('  count: ' + elements.children.length);
      if (chooseFirst) {
        callback(elements.children.first());
      } else {
        elements.children.each(function(ele) {
          callback(ele);
        });
      }
    } else {
      //log.writelns('  count: 1');
      callback(elements);
    }
    */
  } catch(e) {
    log.errorlns(e);
  }
};

var addTitle = function($, obj) {
  log.writelns('Adding Title');
  var text;

  listHelper($, '.recipe.content h2[itemprop="name"]', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util.text(this));
    log.oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  log.writelns('Adding Date Published');
  listHelper($, 'meta[itemprop="datePublished"]', function(index, meta) {
    obj.datePublished = _.trim(this.attr('content'));
    log.oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  log.writelns('Adding Servings');
  listHelper($, 'h4[itemprop="recipeYield"]', function(index, h4) {
    obj.servings = _.trim(util.text(this));
    log.oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log.writelns('Adding Image');

  var patternRe = /\('(.+?)'\)/g,
      backgroundImage,
      match;

  listHelper($, '.recipe-image .image', function(index, img) {
    var backgroundImage = _.first(util.splitCSS(this.css('background')));
    match = patternRe.exec(backgroundImage);

    if (match && match.length) {
      log.ok(match[1]);
      obj.image = {
        src: match[1]
      };
    }
    return false; // stop iterating
  });
};

var addSummary = function($, obj) {
  obj.summaries || (obj.summaries = []);
  log.writelns('Adding Summary');
  var text;

  listHelper($, '.why .full p', function(index, summary) {
    //console.log(this);  // refers to the $ wrapped summary element
    //console.log(summary); //refers to the plain summary element
    text = util.substituteFraction(_.trim(util.fulltext(summary)));
    log.ok(index + 1 + '- ' + text);
    obj.summaries.push(text);
  });
};

var addIngredients = function($, obj) {
  obj.ingredients || (obj.ingredients = []);
  log.writelns('Adding Ingredients');
  var ingredients = $('.ingredients > ul li'),
      top = obj.ingredients,
      list = obj.ingredients,
      retval,
      output,
      text;

  listHelper($, '.ingredients > ul li', function(index, ingredient) {
    if (this.attr('itemprop') === 'ingredients') {
      text = _.trim(util.fulltext(ingredient));
      retval = parser.parseIngredient(text);

      (function walker(vals) {
        if (_.isArray(vals)) {
          _.each(vals, function(val) {
            walker(val);
          });
        } else if (vals.isDivider) {
          log.oklns(vals.description);
          walker(vals.ingredients);
        } else {
          output = _.compact([vals.quantity, vals.measurement, vals.description]).join(' ');
          if (vals.direction) {
            output += ', ' + vals.direction;
          }
          if (vals.alt) {
            output += ' (' + vals.alt + ')';
          }
          log.ok(util.substituteDegree(util.substituteFraction(output)));
        }
      })(retval);

      list.push(retval);
    } else {
      listHelper($, 'h5', this, function() {
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
};

var removeLeadingDigitPeriodRe = /(?:^\d+\.\s+)(.*)$/;
var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header,
      match,
      text;

  listHelper($, '.instructions ol li[itemprop="recipeInstructions"] div', function(index, procedure) {
    header = undefined;

    listHelper($, 'b', this, function() {
      header = _.trim(util.text(this));
    });

    text = util.substituteDegree(util.substituteFraction(_.trim(util.fulltext(procedure))));
    match = text.match(removeLeadingDigitPeriodRe);
    if (match) {
      text = match[1];
    }
    if (header) {
      text = _.trim(text.replace(header, ''));
      match = header.match(removeEndingColonRe);
      if (match) {
        header = match[1];
      }
    }

    obj.procedures.push({
      header: header,
      text: text
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
  var text;

  listHelper($, '.serves > p', function(index, note) {
    text = util.substituteDegree(util.substituteFraction(_.trim(util.fulltext(note))));

    obj.notes.push(text);
    log.oklns(index + 1 + '- ' + text);
  });
};

var addTimes = function($, obj) {
  log.writelns('Adding Times');
  var text;

  listHelper($, '.other-attributes meta[itemprop="totalTime"]', function(index, meta) {
    text = _.trim(this.attr('content'));
    //PT0H0M  - 0 hours, 0 mins
    //PT1H20M - 1 hour, 20 mins
    obj.totalTime = text; // TODO - parse
    log.oklns(text);
  });
};

var addCourse = function($, obj) {
  log.writelns('Adding Course');
  var name;

  listHelper($, '.other-attributes meta[itemprop="recipeCategory"]', function(index, meta) {
    name = _.trim(this.attr('content'));
    if (name) {
      if (name === 'Side Dishes') {
        // TODO add to the categories
      } else if (name === 'Main Courses') {
        obj.course = {
          id: constants.COURSES['Main'],
          name: 'Main'
        };
      } else if (name === 'Appetizers') {
        obj.course = {
          id: constants.COURSES['Appetizer'],
          name: 'Appetizer'
        };
      }
    }
    if (obj.course) {
      log.oklns(obj.course.id + ' - ' + obj.course.name);
    }
  });
};

var addAsideNotes = function($, obj) {
  log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
  var match, text, note, img, h4, h3;

  listHelper($, '.asides > .aside', function(i, aside) {
    listHelper($, 'h4', this, function() {
      h4 = _.trim(util.text(this));
    });
    listHelper($, 'h3', this, function() {
      h3 = _.trim(util.text(this));
    });

    note = {
      h4: h4,
      h3: h3,
      notes: []
    };

    listHelper($, '.page-item', this, function() {
      listHelper($, 'figure > img', this, function() {
        img = this.attr('src');
      });
      listHelper($, 'figure > figcaption', this, function() {
        text = util.substituteDegree(util.substituteFraction(_.trim(util.fulltext(this))));
        match = text.match(removeLeadingDigitPeriodRe);
        if (match) {
          text = match[1];
        }
      });
      note.notes.push({
        text: text,
        image: {
          src: img
        }
      });
    });

    obj.asideNotes.push(note);

    log.ok(note.h4 + ' : ' + note.h3);
    _.each(note.notes, function(note, i) {
      log.ok(i + 1 + '- ' + note.text);
      log.ok(i + 1 + '- ' + note.image.src);
    });
  });
};

var scrape = function(callback, url) {
  request(url, function (err, response, body) {
    if (err) { throw err; }
    var $ = cheerio.load(body, {
      verbose: true,
      ignoreWhitespace: true
    });

    var obj = {};
    addTitle($, obj);
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
    addCategory(206, 'Smoothies', false);
    //addCategory(88, 'Mixed Drinks', false);
    //addCategory(10, 'Holiday', false);
    //addCategory(14, 'Thanksgiving', false);
    //addCategory(21, 'Side Dishes', false);

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
    var text;
    _.each(item.procedures, function(procedure) {
      text = _.trim(procedure.text);
      if (text) {
        text = util.trimMultipleWhiteSpace(text);
        directions.push({
          VARIATION_ID: -1,
          LABEL_TEXT: procedure.header || '',
          IS_HIGHLIGHTED: false,
          DIRECTION_TEXT: text
        });
      }
    });

    // EQUIPMENT

    // Add main picture
    if (item.image.data) {
      obj['EXPORT_TYPE'] = 'BINARY';
      obj['IMAGE'] = item.image.data;
    }

    // Add Ingredients
    var list = obj['INGREDIENTS_TREE'] = [];
    (function walker(array, list) {
      if (_.isArray(array)) {
        _.each(array, function(item) {
          walker(item, list);
        });
      } else if (array.isDivider) {
        var tmp = {};
        tmp['DIVIDER_INGREDIENT'] = {
          DESCRIPTION: array.description,
          DIRECTION: '',
          INCLUDED_RECIPE_ID: -1,
          IS_DIVIDER: true,
          IS_MAIN: false,
          MEASUREMENT: '',
          QUANTITY: array.ingredients.length
        };

        var children = [];
        tmp['INGREDIENTS'] = children;
        list.push(tmp);

        walker(array.ingredients, children);
      } else {

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
    })(item.ingredients, list);

    obj['KEYWORDS'] = '';
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
    obj['PUBLICATION_PAGE'] = URL.format(parsedUrl);
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Cooks Illustrated';
    // Add Summary
    obj['SUMMARY'] = _.map(item.summaries, function(summary) {
      return '<p>' + summary + '</p>';
    })
    .join(util.linefeed);

    obj['TYPE'] = 102;
    obj['URL'] = URL.format(parsedUrl);
    obj['YIELD'] = item.servings;

    var plist_file = util.expandHomeDir('~/Desktop/recipe.mgourmet4');
    util.writePlist(function(err, obj) {
      if (err) { console.error(err); }
    }, [obj], plist_file);
  };

  scrape(function(err, items) {
    if (err) { console.log(err); }

    if (program.save) {
      var data = require(parser.dataFile);
      _.each(items, function(item) {
        _.each(item.ingredients, function(ingredient) {
          data.push(ingredient);
        });

        fs.writeFileSync(parser.dataFile, 'module.exports = '
                         + JSON.stringify(data, null, 2) + ';');
      });
    }

    var downloadImage = function(src, callback) {
      if (src.indexOf('//') === 0) {
        src = src.replace('//', 'http://');
      }
      var oURL = URL.parse(src);
      var request = http.request({
        port: 80,
        host: oURL.hostname,
        method: 'GET',
        path: oURL.pathname
      });

      request.end();
      request.on('response', function (response) {
        var type = response.headers['content-type'],
            prefix = 'data:' + type + ';base64,',
            body = '';

        response.setEncoding('binary');
        response.on('end', function () {
          var base64 = new Buffer(body, 'binary').toString('base64');
          callback(null, base64);
        });
        response.on('data', function (chunk) {
          if (response.statusCode === 200) {
            body += chunk;
          }
        });
      });
    };

    // collate all images
    var images = [];
    _.each(items, function(item) {
      if (item.image.src) {
        images.push(item.image);
      }
      if (item.asideNotes.length) {
        _.each(item.asideNotes, function(asideNote) {
          _.each(asideNote.notes, function(note) {
            images.push(note.image);
          });
        });
      }
    });

    // download all images
    async.forEach(images, function(image, done) {
      if (image.src) {
        downloadImage(image.src, function(err, base64) {
          if (!err) {
            log.ok('Downloaded: ' + image.src);
          }
          image.data = base64;
          done();
        });
      } else {
        done();
      }
    }, function(err) {
      _.each(items, function(item) {
        exportRecipe(item);
        log.ok('Ok. Finished scrubbing "' + item.title + '"');
      });
    });
  }, url);
}
else {
  log.writelns(program.description());
  log.writelns('Version: ' + program.version());
  log.writelns(program.helpInformation());
}
