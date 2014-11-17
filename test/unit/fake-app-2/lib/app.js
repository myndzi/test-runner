'use strict';

module.exports = function (opts) {
    opts = opts || { };
    if (opts.foo) {
        process.foo = 'bar';
    }
};
