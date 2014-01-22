/* jshint indent: false */
var nodeUtil = require('util'),
    async = require('async'),
    request = require('request'),
    cheerio = require('cheerio'),
    program = require('commander'),
    http = require('http'),
    URL = require('url');

var main = require('./main'),
    parser = main.cooksIllustratedParser,
    util = main.util,
    log = main.log,
    _ = util._;

//https://github.com/chriso/validator.js
//https://github.com/fb55/node-entities

program
  .version('0.1')
  .description('Scrub a recipe from cooksillustrated.com')
  .option('-u, --url <string>', 'url of recipe to scrub from')
  .option('-s, --save <string>', 'filename to save scrubbed and parsed ingredients to. (useful for testing and regression)')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

main.option.debug = program.debug;

//log.warn('warn');       // >> warn
//log.error('error');     // >> error
//log.ok('ok');           // >> ok
//log.success('success'); // success
//log.fail('fail');       // fail
//log.debug('debug');     // [D] debug

var verbose = function() {
  if (program.debug) {
    console.log.apply(null, arguments);
  }
};

var listHelper = function($, selector, callback) {
  try {
    var elements = $(selector);
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

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log.writelns('Adding Image');

  var patternRe = /\((.+?)\)/g,
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
    //if (!summary) { return; }
    text = util.substituteFraction(util.trim(util.fulltext(summary)));
    log.ok(text);
    obj.summaries.push(text);
  });
};

var addProcedure = function($, obj) {
  verbose('## Adding Procedures');
  obj.procedures || (obj.procedures = []);
  listHelper($, '.hrecipe .procedure ol.instructions li .procedure-text', false, function(procedure) {
    if (!procedure) { return; }
    obj.procedures.push(util.substituteDegree(util.substituteFraction(util.trim(procedure.striptags))));
  });
};

var addIngredients = function($, obj) {
  verbose('## Adding Ingredients');
  obj.ingredients || (obj.ingredients = []);
  // [itemprop="ingredients"]
  var ingredients = $('.ingredients > ul li'),
      retval,
      output,
      text;

  listHelper($, '.ingredients > ul li', function(index, ingredient) {
    if (this.attr('itemprop') === 'ingredients') {
      text = util.trim(util.fulltext(ingredient));
      //log.ok(text);
      //log.ok(this.text());
      //log.ok(util.trim(util.fulltext(ingredient)));
      //log.ok(util.trim(util.striptags(ingredient)));
      retval = parser.parseIngredient(text);

      (function walker(vals) {
        if (_.isArray(vals)) {
          if (vals.length > 1) {
            _.each(vals, function(val) {
              walker(val);
            });
          }
        } else if (vals.isDivider) {
          //output('OR');
          log.oklns('OR');
          walker(vals.ingredients);
        } else {
          output = _.compact([vals.quantity, vals.measurement, vals.description]).join(' ');
          if (vals.direction) {
            output += ', ' + vals.direction;
          }
          log.ok(output);
        }
      })(retval);

      //log.ok(JSON.stringify(retval));
    }
    //obj.ingredients.push(breakdown);
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

    try {
      obj.title = util.text($('.recipe.content h2[itemprop="name"]')).trim();
      log.oklns(obj.title);

      //log.oklns(util.striptags($('.why')));
      //log.oklns(util.rawtext($('.why > h3')));
      //log.oklns(util.fulltext($('.ingredients > ul')));
      //log.oklns(util.text($('.why > h3')));

      //addImage($, obj);
      //addSummary($, obj);
      addIngredients($, obj);
      /*
      addProcedure($, obj);

      verbose('## Adding Servings');
      var servings = $('.hrecipe .recipe-about td span.yield');
      if (servings) {
        obj.servings = servings.striptags;
      }

      verbose('## Adding Times');
      var prepTime = $('.hrecipe .recipe-about td span.prepTime');
      if (prepTime) {
        obj.prepTime = prepTime.striptags;
      }

      var totalTime = $('.hrecipe .recipe-about td span.totalTime');
      if (totalTime) {
        obj.totalTime = totalTime.striptags;
      }
      */
    } catch(e) {
      callback(e, obj);
    }
    callback(null, obj);
  });
};

if (program.url) {
  var url = program.url,
      dataFile = program.save;
  //var tmp = URL.parse(url, true);
  //log.debug(tmp.protocol + '//' + tmp.host + ( tmp.port || '' ) + tmp.pathname);

  var exportRecipe = function(item) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;
    obj['COURSE_ID'] = 2;
    obj['COURSE_NAME'] = 'Main';
    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;
    obj['KEYWORDS'] = item.tags.join(', ');
    obj['MEASUREMENT_SYSTEM'] = 0;
    obj['NAME'] = util.trim(item.title);
    obj['NOTE'] = '';
    obj['NOTES_LIST'] = [];
    obj['NUTRITION'] = '';
    obj['PUBLICATION_PAGE'] = url;
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Serious Eats';
    obj['SUMMARY'] = item.summaries.join('\n');
    obj['TYPE'] = 102;
    obj['URL'] = url;
    obj['YIELD'] = util.trim(item.servings);

    if (item.image.data) {
      obj['EXPORT_TYPE'] = 'BINARY';
      obj['IMAGE'] = item.image.data;
    }

    var categories = obj['CATEGORIES'] = [];
    var addCategory = function(id, name, userAdded) {
      categories.push({
        CATEGORY_ID: id,
        ITEM_TYPE_ID: 102,
        NAME: name,
        USER_ADDED: userAdded
      });
    };
    //addCategory(206, 'Smoothies', false);
    //addCategory(88, 'Mixed Drinks', false);
    //addCategory(10, 'Holiday', false);
    //addCategory(14, 'Thanksgiving', false);
    //addCategory(21, 'Side Dishes', false);

    var directions = obj['DIRECTIONS_LIST'] = [];
    _.each(item.procedures, function(procedure) {
      procedure = util.trim(procedure);
      if (procedure) {
        procedure = procedure.replace(/\s{2,}/g, ' '); // replace extra spaces with one
        directions.push({
          VARIATION_ID: -1,
          LABEL_TEXT: '',
          IS_HIGHLIGHTED: false,
          DIRECTION_TEXT: procedure
        });
      }
    });

    var preps = obj['PREP_TIMES'] = [];
    var addTime = function(id, time) {
      var hours,
          minutes;

      time = parseInt(time, 10);
      hours = parseInt(time/60, 10);
      minutes = time%60;

      preps.push({
        TIME_TYPE_ID: id,
        AMOUNT: hours > 0 ? hours : minutes,
        AMOUNT_2: hours > 0 ? minutes : 0,
        TIME_UNIT_ID: hours > 0 ? 1 : 2,
        TIME_UNIT_2_ID: hours > 0 ? 2 : 1
      });
    };

    if (item.prepTime) {
      addTime(9, item.prepTime); // prep

      if (item.totalTime) {
        var cookTime = parseInt(item.totalTime, 10) - parseInt(item.prepTime, 10);
        addTime(5, cookTime); // cook
      }
    }

    var ingredients = obj['INGREDIENTS_TREE'] = [];
    _.each(item.ingredients, function(ingredient) {
      ingredients.push({
        DESCRIPTION: util.trim(ingredient.product),
        DIRECTION: util.trim(ingredient.direction) || '',
        INCLUDED_RECIPE_ID: -1,
        IS_DIVIDER: false,
        IS_MAIN: false,
        MEASUREMENT: util.trim(ingredient.measurement),
        QUANTITY: util.trim(ingredient.quantity)
      });
    });

    var plist_file = util.expandHomeDir('~/Desktop/recipe.mgourmet4');
    util.writePlist(function(err, obj) {
      if (err) { console.error(err); }
    }, [obj], plist_file);
  };

  scrape(function(err, items) {
    if (err) { console.log(err); }
    //console.log('done', items);

    /*
    async.forEach(items, function(item, done) {
      if (item.image.src) {
        var oURL = URL.parse(item.image.src),
            request = http.request({
              port: 80,
              host: oURL.hostname,
              method: 'GET',
              path: oURL.pathname
            });

        request.end();
        request.on('response', function (response) {
          var type = response.headers["content-type"],
              prefix = 'data:' + type + ';base64,',
              body = '';

          response.setEncoding('binary');
          response.on('end', function () {
            var base64 = new Buffer(body, 'binary').toString('base64'),
            data = prefix + base64;
            //item.image.data = data;
            item.image.data = base64;
            done();
          });
          response.on('data', function (chunk) {
            if (response.statusCode === 200) {
              body += chunk;
            }
          });
        });
      } else {
        done();
      }
    }, function(err) {
      _.each(items, function(item) {
        exportRecipe(item);
        console.log('Done: ' + item.title);
      });
    });
    */
  }, url);
}
else {
  log.writelns(program.description());
  log.writelns('Version: ' + program.version());
  log.writelns(program.helpInformation());
}
