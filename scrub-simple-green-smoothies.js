var async = require('async'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeio = require('node.io'),
    plist = require('plist'),
    program = require('commander'),
    http = require('http'),
    URL = require('url'),
    util = require('util');

var Utils = require('./utils.js');

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

var listHelper = function($, selector, chooseFirst, helper) {
  var elements;
  try {
    var elements = $(selector);
    if (elements.length) {
      verbose('  count: ' + elements.length);
      if (chooseFirst) {
        helper(_.first(elements));
      } else {
        elements.each(function(ele) {
          helper(ele);
        });
      }
    } else if (elements.children && elements.children.length) {
      verbose('  count: ' + elements.children.length);
      if (chooseFirst) {
        helper(elements.children.first());
      } else {
        elements.children.each(function(ele) {
          helper(ele);
        });
      }
    } else {
      verbose('  count: 1');
      helper(elements);
    }
  } catch(e) {
    verbose(e);
    helper();
  }
}

var addSummary = function($, obj) {
  verbose('## Adding Summary')
  obj.summaries || (obj.summaries = []);

  var summary;

  function summaryHelper(ele) {
    if (!summary) {
      summary = ele.striptags || ele.innerHTML;
      //console.log(summary);
    }
  }

  listHelper($, '.entry span[itemprop="description"]', false, function(ele) {
    if (!ele) {
      try {
        var elements = $('.entry p em');

        if (elements.length) {
          elements.each(summaryHelper);
        } else if (elements.children && elements.children.length) {
          elements.children.each(summaryHelper);
        }
      } catch(e) {
        verbose(e);
      }
    } else {
      summary = (ele.striptags || ele.innerHTML);
    }

    if (summary) {
      obj.summaries.push(Utils.substituteFraction(Utils.trim(summary)));
    }
  });
}

var addProcedure = function($, obj) {
  verbose('## Adding Procedures')
  obj.procedures || (obj.procedures = []);
  listHelper($, '.entry span[itemprop="recipeInstructions"]', true, function(procedure) {
    if (!procedure) { return; }
    obj.procedures.push(Utils.substituteDegree(Utils.substituteFraction(Utils.trim(procedure.striptags || procedure.innerHTML))));
  });
}

var addImage = function($, obj) {
  verbose('## Adding Image');

  listHelper($, '.portfolio-item.single-portfolio-image img', true, function(img) {
    if (!img) { return; }
    obj.image = {
      src: img.attribs.src,
      alt: img.attribs.alt
    };
  });
}

var addIngredients = function($, obj) {
  verbose('## Adding Ingredients');
  obj.ingredients || (obj.ingredients = []);
  var ingredients,
      text,
      matches,
      breakdown,
      description;

  try {
    ingredients = $('.ingredients li');
  } catch(e) {
    verbose(e);
  }

  function ingredientHelper(ele) {
    if (!ingredients) {
      ingredients = (ele.striptags || '').split('\n');
      //console.log(ingredients);
      if (ingredients.length == 1) {
        ingredients = undefined;
      }
    }
  }

  if (!ingredients) {
    try {
      var elements = $('.entry p');
      if (elements.length) {
        elements.each(ingredientHelper);
      } else if (elements.children && elements.children.length) {
        elements.children.each(ingredientHelper);
      }
    } catch(e) {
      verbose(e);
    }
  } else {
    var temp = [];
    ingredients.each(function(ingredient) { // move from elements to array of strings
      temp.push(ingredient.striptags || ingredient.innerHTML);
    });
    ingredients = temp;
  }

  _.each(ingredients, function(ingredient) {
    breakdown = {};
    text = Utils.unescape(ingredient);
    if (text) {
      matches = text.match(/^([-\d\/ ]+(?:\s+to\s+)?(?:[\d\/ ]+)?)?\s*(\w+)\s+(.*)/i);
      //console.log('match: ' + matches);

      if (matches && matches.length) {
        breakdown.quantity = matches[1];
        breakdown.measurement = matches[2];

        if (matches[3].indexOf(',') > 0) {
          text = matches[3];
          matches = text.match(/(.*), ([^,]*$)/i);

          breakdown.product = Utils.substituteFraction(Utils.trim(matches[1]));
          breakdown.direction = Utils.substituteFraction(Utils.trim(matches[2]));
        } else {
          breakdown.product = Utils.substituteFraction(Utils.trim(matches[3]));
        }

        obj.ingredients.push(breakdown);
      }
    }
  });
}

var scrape = function(callback, url) {
  var methods = {
    input: false,
    run: function() {
      var self = this;
      this.getHtml(url, function(err, $) {
        if (err) { this.exit(err); }
        var obj = {};

        try {
          obj.title = $('h1.title').striptags;

          addImage($, obj);
          addSummary($, obj);
          addIngredients($, obj);
          addProcedure($, obj);

          verbose('## Adding Servings')
          var servings = $('.entry span[itemprop="recipeYield"]');
          if (servings) {
            obj.servings = servings.striptags;
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

  var exportRecipe = function(item) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;
    obj['COURSE_ID'] = 2
    //obj['COURSE_NAME'] = 'Main'
    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;
    //obj['KEYWORDS'] = item.tags.join(', ');
    obj['MEASUREMENT_SYSTEM'] = 0;
    obj['NAME'] = Utils.trim(item.title);
    obj['NOTE'] = '';
    obj['NOTES_LIST'] = [];
    obj['NUTRITION'] = '';
    obj['PUBLICATION_PAGE'] = url;
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Simple Green Smoothies';
    obj['SUMMARY'] = item.summaries.join('\n');
    obj['TYPE'] = 102;
    obj['URL'] = url;
    obj['YIELD'] = Utils.trim(item.servings);

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
    addCategory(206, 'Smoothies', false);

    var directions = obj['DIRECTIONS_LIST'] = [];
    _.each(item.procedures, function(procedure) {
      procedure = Utils.trim(procedure);
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

    var ingredients = obj['INGREDIENTS_TREE'] = [];
    _.each(item.ingredients, function(ingredient) {
      ingredients.push({
        DESCRIPTION: Utils.trim(ingredient.product),
        DIRECTION: Utils.trim(ingredient.direction) || '',
        INCLUDED_RECIPE_ID: -1,
        IS_DIVIDER: false,
        IS_MAIN: false,
        MEASUREMENT: Utils.trim(ingredient.measurement),
        QUANTITY: Utils.trim(ingredient.quantity)
      });
    });

    var plist_file = Utils.expandHomeDir('~/Desktop/recipe.mgourmet4');
    Utils.writePlist(function(err, obj) {
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
        exportRecipe(item);
        console.log('Done: ' + item.title);
      });
    });

  }, url);
}
else {
  console.log(program.description());
  console.log("Version: " + program.version());
  console.log(program.helpInformation());
}
