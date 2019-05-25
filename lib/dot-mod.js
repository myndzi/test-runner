'use strict';
/**
 * @module DotMod
 */
/**
 * Module dependencies.
 */

var Base = require('mocha/lib/reporters/base');
var inherits = require('mocha/lib/utils').inherits;
var constants = require('mocha/lib/runner').constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
var EVENT_RUN_END = constants.EVENT_RUN_END;

var symbols = {
    fast: '.',
    medium: 'o',
    slow: 'O',
    pending: '_',
    fail: 'x',
};

/**
 * Constructs a new `DotMod` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function DotMod(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var width = Math.floor(Base.window.width * 0.75);
  var n = -1;

  runner.on(EVENT_RUN_BEGIN, function() {
    process.stdout.write('\n');
  });

  runner.on(EVENT_TEST_PENDING, function() {
    if (++n % width === 0) {
      process.stdout.write('\n  ');
    }
    process.stdout.write(Base.color('pending', symbols.pending));
  });

  runner.on(EVENT_TEST_PASS, function(test) {
    if (++n % width === 0) {
      process.stdout.write('\n  ');
    }
    process.stdout.write(Base.color(test.speed, symbols[test.speed] || '?'));
  });

  runner.on(EVENT_TEST_FAIL, function() {
    if (++n % width === 0) {
      process.stdout.write('\n  ');
    }
    process.stdout.write(Base.color('fail', symbols.fail));
  });

  runner.once(EVENT_RUN_END, function() {
    console.log();
    self.epilogue();
  });
}

/**
 * Inherit from `Base.prototype`.
 */
inherits(DotMod, Base);

DotMod.description = 'modified dot matrix representation';


/**
 * Expose `DotMod`.
 */

exports = module.exports = DotMod;
