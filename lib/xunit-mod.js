'use strict';

// jshint laxcomma: true

/**
 * Module dependencies.
 */

var Base = require('mocha/lib/reporters/base')
  , utils = require('mocha/lib/utils')
  , fs = require('fs')
  , escape = utils.escape;

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */

/* jshint ignore: start */

var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval;

/* jshint ignore: end */

/**
 * HTML tag helper.
 */

function tag(name, attrs, close, content) {
  var end = close ? '/>' : '>'
    , pairs = []
    , atag;

  for (var key in attrs) {
    pairs.push(key + '="' + escape(attrs[key]) + '"');
  }

  atag = '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + end;
  if (content) { atag += content + '</' + name + end; }
  return atag;
}

/**
 * Return cdata escaped CDATA `str`.
 */

function cdata(str) {
  return '<![CDATA[' + escape(str) + ']]>';
}

/**
 * Initialize a new `XUnit` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function XUnit(runner, options) {
  options = options || { };
  
  Base.call(this, runner);
  var stats = this.stats
    , tests = []
    , self = this;

  if (options.reporterOptions && options.reporterOptions.output) {
      if (! fs.createWriteStream) {
          throw new Error('file output not supported in browser');
      }
      self.fileStream = fs.createWriteStream(options.reporterOptions.output);
  }

  runner.on('pending', function(test){
    tests.push(test);
  });

  runner.on('pass', function(test){
    tests.push(test);
  });

  runner.on('fail', function(test){
    tests.push(test);
  });

  runner.on('end', function(){
    self.write(tag('testsuite', {
        name: options.name || 'Mocha Tests'
      , tests: stats.tests
      , failures: stats.failures
      , errors: stats.failures
      , skipped: stats.tests - stats.failures - stats.passes
      , timestamp: (new Date()).toUTCString()
      , time: (stats.duration / 1000) || 0
    }, false));

    tests.forEach(function(t) { self.test(t); });
    self.write('</testsuite>');
  });
}

/**
 * Override done to close the stream (if it's a file).
 */
XUnit.prototype.done = function(failures, fn) {
    if (this.fileStream) {
        this.fileStream.end(function() {
            fn(failures);
        });
    } else {
        fn(failures);
    }
};

/**
 * Inherit from `Base.prototype`.
 */

XUnit.prototype = Object.create(Base.prototype);

/**
 * Write out the given line
 */
XUnit.prototype.write = function(line) {
    if (this.fileStream) {
        this.fileStream.write(line + '\n');
    } else {
        console.log(line);
    }
};

/**
 * Output tag for the given `test.`
 */

XUnit.prototype.test = function(test, ostream) {
  var attrs = {
      classname: test.parent.fullTitle()
    , name: test.title
    , time: (test.duration / 1000) || 0
  };

  if ('failed' === test.state) {
    var err = test.err;
    this.write(tag('testcase', attrs, false, tag('failure', {}, false, cdata(escape(err.message) + "\n" + err.stack))));
  } else if (test.pending) {
    this.write(tag('testcase', attrs, false, tag('skipped', {}, true)));
  } else {
    this.write(tag('testcase', attrs, true) );
  }
};

/**
 * Expose `XUnit`.
 */

exports = module.exports = XUnit;

