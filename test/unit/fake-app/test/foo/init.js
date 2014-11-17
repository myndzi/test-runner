'use strict';

module.exports = function (runner) {
    runner.__test && runner.__test();
    this.foo = 'bar';
};
