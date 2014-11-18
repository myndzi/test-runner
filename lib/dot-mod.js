/**
 * Module dependencies.
 */

var Base = require('mocha/lib/reporters/base')
  , color = Base.color;

/**
 * Expose `Dot`.
 */

exports = module.exports = Dot;

/**
 * Initialize a new `Dot` matrix test reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function Dot(runner) {
  Base.call(this, runner);

  var self = this
    , stats = this.stats
    , width = 75
    , n = -1;

  runner.on('start', function(){
    process.stdout.write('\n  ');
  });

  runner.on('test group', function (testGroup) {
    process.stdout.write('\n' + color('pending', '-> ') + testGroup);
  });
  runner.on('pending', function(test){
    if (++n % width == 0) process.stdout.write('\n  ');
    process.stdout.write(color('pending', '_'));
  });

  runner.on('pass', function(test){
    if (++n % width == 0) process.stdout.write('\n  ');
    if ('slow' === test.speed) {
      process.stdout.write(color('bright yellow', 'O'));
    } else if ('medium' === test.speed) {
      process.stdout.write(color(test.speed, 'o'));
    } else {
      process.stdout.write(color(test.speed, '.'));
    }
  });

  runner.on('fail', function(test, err){
    if (++n % width == 0) process.stdout.write('\n  ');
    process.stdout.write(color('fail', 'x'));
  });

  runner.on('end', function(){
    console.log();
    self.epilogue();
  });
}

/**
 * Inherit from `Base.prototype`.
 */

Dot.prototype.__proto__ = Base.prototype;
