var grunt = require('grunt'),
    _ = require('underscore'),
    nodePath = require('path'),
    fs = require('fs');

var config = {};

// grunt
module.exports = function(grunt) {

  config = _.extend(config, {
    pkg: grunt.file.readJSON('package.json'),
    dirname: __dirname,
    mochaTest: {
      options: {
        clearRequireCache: true,
        mocha: require('mocha'),
        reporter: 'spec'
      },
      test: {
        src: [ 'test/*.js' ]
      }
    },
    watch: {
      test: {
        options: {
          spawn: false,
          interrupt: true
        },
        files: [ '**/*.js', '!**/node_modules/**' ],
        tasks: [ 'mochaTest:test' ]
      }
    }
  });

  grunt.initConfig(config);

  // On watch events configure mochaTest to run only on the test if it is one
  // otherwise, run the whole testsuite
  var defaultSimpleSrc = grunt.config('mochaTest.simple.src');
  grunt.event.on('watch', function(action, filepath) {
    grunt.config('mochaTest.simple.src', defaultSimpleSrc);
    if (filepath.match('test/')) {
      grunt.config('mochaTest.simple.src', filepath);
    }
  });

  // Load grunt tasks from NPM packages
  require( 'load-grunt-tasks' )( grunt );

  grunt.registerTask('default', [ 'watch' ] );
};
