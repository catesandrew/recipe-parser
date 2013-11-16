var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , program = require('commander')
  , nodeio = require('node.io')
  , request = require('request');

var scrape = function(_callback, cookie) {
  var methods = {
    input:false,
    run:function() {
      var options = {
        url: 'https://ocapps.occourts.org/fampub/SearchCase.do',
        body: {
          'caseNumber': '11d005175',
          'action': 'Search'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Cookie': cookie + '; searchTab=0',
          'Referer': 'https://ocapps.occourts.org/fampub/Search.do',
          'Pragma': 'no-cache'
        }
      };
      this.postHtml(options.url, options.body, options.headers, function(err, $, data, headers) {
        var roa = [];
        var roaData = $('#roaData');
        var tbody = $('tbody', roaData);
        $('tr', tbody).each(function(tr) {
          $('td', tr).each(function(td) {
            //console.log(td.fulltext);
          });
          var cells = $('td', tr);
          if (cells && cells.length) {
            // parse a date in yyyy-mm-dd format
            var parts = cells[2].fulltext.match(/(\d+)/g);
            roa.push({
              'roa': parseInt(cells[0].fulltext, 10),
              'docket': cells[1].fulltext,
              // new Date(year, month [, date [, hours[, minutes[, seconds[, ms]]]]])
              'filing': new Date(parts[0], parts[1]-1, parts[2]), // months are 0-based
              'party': cells[3].fulltext,
              'pages': cells[4].fulltext
            });
          }
        });

        this.emit(roa);
      });
    },
    complete: function(callback) {
      callback();
    }
  };

  var job = new nodeio.Job({
    //proxy: 'http://127.0.0.1:8888',
    redirects: 1,
    auto_retry: true, 
    timeout: 10, 
    retries: 0
  }, methods);

  nodeio.start(job, {}, function(err, data) {
    if (err) { callback(err); }
    _callback(null, data);
  }, true);
};

var options = {
  url: 'https://ocapps.occourts.org/fampub/Home.do',
  //proxy: 'http://127.0.0.1:8888',
  jar: false
};
request(options, function(error, response, body) {
  if (!error && response.statusCode === 200) {
    var jsession = {};
    var cookies = response.headers['set-cookie'];
    _.each(cookies, function(cookie) {
      var parts = cookie.split(';');
      _.each(parts, function(part) {
        var pairs = part.split('=');
        jsession[ pairs[ 0 ].trim() ] = ( pairs[ 1 ] || '' ).trim();
      });
    });

    var occookie = 'JSESSIONID=' + jsession['JSESSIONID'];
    var options = {
      url: 'https://ocapps.occourts.org/fampub/Search.do',
      body: 'action=Accept+Terms',
      //proxy: 'http://127.0.0.1:8888',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Cookie': occookie,
        'Referer': 'https://ocapps.occourts.org/fampub/Home.do',
        'Pragma': 'no-cache'
      }
    };
    request.post(options, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        scrape(function(err, data) {
          if (err) { callback(err); }
          console.log(data);

          //callback(null, episodes);
        }, occookie);
      }
    });
  } 
});


