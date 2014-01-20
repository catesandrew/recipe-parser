/* jshint indent: false */
var nodeUtil = require('util'),
    async = require('async'),
    nodeio = require('node.io'),
    program = require('commander'),
    cssParse = require('css-parse'),
    http = require('http'),
    URL = require('url');

var main = require('./main'),
    util = main.util,
    log = main.log,
    _ = util._;

//https://github.com/MatthewMueller/cheerio
//https://github.com/chriso/node.io
/*
Node.io: this library is no longer maintained.

I wrote node.io in 2010 when node.js was still in its infancy and the npm repository didn't have the amazing choice of libraries as it does today.

Since it's now quite trivial to write your own scraper I've decided to stop maintaining the library.

Here's an example using [request](https://github.com/mikeal/request), [cheerio](https://github.com/MatthewMueller/cheerio) and [async](https://github.com/caolan/async).

```javascript
var request = require('request')
  , cheerio = require('cheerio')
  , async = require('async')
  , format = require('util').format;

var reddits = [ 'programming', 'javascript', 'node' ]
  , concurrency = 2;

async.eachLimit(reddits, concurrency, function (reddit, next) {
    var url = format('http://reddit.com/r/%s', reddit);
    request(url, function (err, response, body) {
        if (err) throw err;
        var $ = cheerio.load(body);
        $('a.title').each(function () {
            console.log('%s (%s)', $(this).text(), $(this).attr('href'));
        });
        next();
    });
});
```
*/

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

var listHelper = function($, selector, chooseFirst, helper) {
  try {
    var elements = $(selector);
    if (elements.length) {
      log.writelns('  count: ' + elements.length);
      if (chooseFirst) {
        helper(_.first(elements));
      } else {
        elements.each(function(ele) {
          helper(ele);
        });
      }
    } else if (elements.children && elements.children.length) {
      log.writelns('  count: ' + elements.children.length);
      if (chooseFirst) {
        helper(elements.children.first());
      } else {
        elements.children.each(function(ele) {
          helper(ele);
        });
      }
    } else {
      log.writelns('  count: 1');
      helper(elements);
    }
  } catch(e) {
    log.errorlns(e);
    helper();
  }
};

var addSummary = function($, obj) {
  verbose('## Adding Summary');
  obj.summaries || (obj.summaries = []);
  listHelper($, '.hrecipe .content-unit .summary p', false, function(summary) {
    if (!summary) { return; }
    var child;
    if (summary.children) {
      child = summary.children.first();
    }
    if (summary.attribs && summary.attribs.class) {
      // do nothing
    } else if (child && child.name === 'small') {
      // do nothing
    } else {
      obj.summaries.push(util.substituteFraction(util.trim(summary.innerHTML)));
    }
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

var addImage = function($, obj) {
  log.writelns('Adding Image');

  listHelper($, '.recipe-image .image', true, function(img) {
    if (!img) { return; }
    console.log(img.attribs.style);
    console.log(img);
    console.log(cssParse(img.attribs.style));
    obj.image = {
      src: img.attribs.src,
      alt: img.attribs.alt
    };
  });
};

var addIngredients = function($, obj) {
  verbose('## Adding Ingredients');
  obj.ingredients || (obj.ingredients = []);
  var ingredients = $('.hrecipe .content-unit .ingredients ul li'),
      text,
      matches,
      breakdown,
      description;

  ingredients.each(function(ingredient) {
    breakdown = {};
    text = ingredient.striptags;
    //console.log(text);
    if (text) {
      matches = text.match(/^([-\d\/ ]+(?:\s+to\s+)?(?:[\d\/ ]+)?)?\s*(\w+)\s+(.*)/i);
      //console.log('match: ' + matches);

      if (matches && matches.length) {
        breakdown.quantity = matches[1];
        breakdown.measurement = matches[2];

        if (matches[3].indexOf(',') > 0) {
          text = matches[3];
          matches = text.match(/(.*), ([^,]*$)/i);

          breakdown.product = util.substituteFraction(util.trim(matches[1]));
          breakdown.direction = util.substituteFraction(util.trim(matches[2]));
        } else {
          breakdown.product = util.substituteFraction(util.trim(matches[3]));
        }

        obj.ingredients.push(breakdown);
      }
    }
  });
};

var scrape = function(callback, url) {
  var methods = {
    input: false,
    run: function() {
      var self = this;
      this.getHtml(url, function(err, $) {
        if (err) { this.exit(err); }
        var obj = {};

        try {
          obj.title = $('.recipe.content h2[itemprop="name"]').striptags;
          log.oklns(obj.title);

          addImage($, obj);
          addSummary($, obj);
          addIngredients($, obj);
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
        } catch(e) {
          verbose(e);
        }

        this.emit(obj);
      });
    }
  };

  var job = new nodeio.Job({
    auto_retry: true,
    timeout: 20,
    retries: 3,
    silent: true
  }, methods);

  nodeio.start(job, {}, function(err, data) {
    if (err) { callback(err); }
    callback(null, data);
  }, true);
};

if (program.url) {
  var url = program.url;
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

  }, url);
}
else {
  log.writelns(program.description());
  log.writelns('Version: ' + program.version());
  log.writelns(program.helpInformation());
}
