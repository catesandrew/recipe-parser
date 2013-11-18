var async = require('async'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeio = require('node.io'),
    plist = require('plist'),
    program = require('commander'),
    http = require('http'),
    URL = require('url'),
    util = require('util');
var utils = require('./utils.js').utils;

var escapeRegExp = function(str){
  if (str == null) return '';
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

var defaultToWhiteSpace = function(characters) {
  if (characters == null)
    return '\\s';
  else if (characters.source)
    return characters.source;
  else
    return '[' + escapeRegExp(characters) + ']';
};

var trim = function(str, characters){
  if (str == null) return '';
  characters = defaultToWhiteSpace(characters);
  return String(str).replace(new RegExp('\^' + characters + '+|' + characters + '+$', 'g'), '');
}

program
  .version('0.1')
  .description('Scrub a recipe from seriouseats.com')
  .option('-u, --url <string>', 'url of recipe to scrub')
  .option('-d, --debug', 'output extra debug information')
  .parse(process.argv);

var verbose = function() {
  if (program.debug) {
    console.log.apply(null, arguments);
  }
};

var size_re = new RegExp(".*\\(([0-9]+?[.][0-9]+? [MG]B)\\)$");
var scrape = function(callback, url) {
  var methods = {
    input: false,
    run: function() {
      var self = this;
      this.getHtml(url, function(err, $) {
        if (err) { this.exit(err); }
        var obj = {};

        obj.title = $('.hrecipe h1.fn').fulltext;

        $('.hrecipe .tags li').each(function(tag) {
          obj.tags || (obj.tags = []);

          obj.tags.push(tag.fulltext);
        });

        var img = _.first($('.hrecipe .content-unit img'));
        obj.image = {
          src: img.attribs.src,
          alt: img.attribs.alt
        };

        var summary = $('.hrecipe .content-unit .summary');
        $('p', summary).each(function(p) {
          obj.summaries || (obj.summaries = []);
          if (p.attribs && p.attribs.class) {
            // do nothing
          } else {
            if (p.rawtext) {
              obj.summaries.push(p.rawtext);
            }
          }
        });

        var ingredients = $('.hrecipe .content-unit .ingredients ul li'),
            text,
            matches,
            breakdown,
            description;

        ingredients.each(function(ingredient) {
          obj.ingredients || (obj.ingredients = []);
          breakdown = {};
          text = ingredient.fulltext;
          matches = text.match(/^([\d \/]+)\s+(\w+)\s+(.*)/i);

          breakdown.quantity = matches[1];
          breakdown.measurement = matches[2];

          if (matches[3].indexOf(',') > 0) {
            text = matches[3];
            matches = text.match(/(.*), ([^,]*$)/i);

            breakdown.product = matches[1];
            breakdown.direction = matches[2];
          } else {
            breakdown.product = matches[3];
          }

          obj.ingredients.push(breakdown);
        });

        $('.hrecipe .procedure ol.instructions li .procedure-text').each(function(procedure) {
          obj.procedures || (obj.procedures = []);
          obj.procedures.push(procedure.fulltext);
        });

        obj.servings = $('.hrecipe .recipe-about td span.yield').fulltext;
        obj.prepTime = $('.hrecipe .recipe-about td span.prepTime').fulltext;
        obj.totalTime = $('.hrecipe .recipe-about td span.totalTime').fulltext;

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

  var exportRecipe = function(item) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;
    obj['COURSE_ID'] = 2
    obj['COURSE_NAME'] = 'Main'
    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;
    obj['KEYWORDS'] = item.tags.join(', ');
    obj['MEASUREMENT_SYSTEM'] = 0;
    obj['NAME'] = trim(item.title);
    obj['NOTE'] = '';
    obj['NOTES_LIST'] = [];
    obj['NUTRITION'] = '';
    obj['PUBLICATION_PAGE'] = url;
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Serious Eats';
    obj['SUMMARY'] = item.summaries.join('\n\n');
    obj['TYPE'] = 102;
    obj['URL'] = url;
    obj['YIELD'] = trim(item.servings);

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
    }
    addCategory(10, 'Holiday', false);
    addCategory(14, 'Thanksgiving', false);

    var directions = obj['DIRECTIONS_LIST'] = [];
    _.each(item.procedures, function(procedure) {
      directions.push({
        VARIATION_ID: -1,
        LABEL_TEXT: '',
        IS_HIGHLIGHTED: false,
        DIRECTION_TEXT: trim(procedure)
      });
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
        TIME_UNIT_2_ID: hours > 0 ? 1 : 2
      });
    }

    if (item.prepTime) {
      addTime(15, item.prepTime) // prep

      if (item.totalTime) {
        var cookTime = parseInt(item.totalTime, 10) - parseInt(item.prepTime, 10);
        addTime(5, cookTime) // cook
      }
    }

    var ingredients = obj['INGREDIENTS_TREE'] = [];
    _.each(item.ingredients, function(ingredient) {
      ingredients.push({
        DESCRIPTION: trim(ingredient.product),
        DIRECTION: trim(ingredient.direction) || '',
        INCLUDED_RECIPE_ID: -1,
        IS_DIVIDER: false,
        IS_MAIN: false,
        MEASUREMENT: trim(ingredient.measurement),
        QUANTITY: trim(ingredient.quantity)
      });
    });

    var plist_file = utils.expandHomeDir('~/Desktop/recipe.mgourmet4');
    utils.writePlist(function(err, obj) {
      if (err) { console.error(err); }
      }, [obj], plist_file
    );
  }

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
            if (response.statusCode == 200) body += chunk;
          });
        });
      } else {
        done();
      }
    }, function(err) {
      _.each(items, function(item) {
        //console.log(item);
        exportRecipe(item);
      });
    });

  }, url);
}
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
