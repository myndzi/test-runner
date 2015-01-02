'use strict';

var PATH = require('path'),
    fs = require('fs');

var Promise = require('bluebird');
Promise.promisifyAll(fs, { suffix: '$' });

module.exports = function (baseDir, opts) {
    opts = opts || { };

    var playlog = require('@eros/sites-load-test/playlog');
    
    return playlog({
        baseDir: baseDir,
        node: true,
        logLevel: opts.logLevel
    }).then(function (results) {
        if (opts.report) {
            var reportFile = opts.reportFile || PATH.join(baseDir, 'reports', 'perf.csv');

            var RPS = results.node.info.RPS,
                fourohfours = results.node.info['404s'],
                errors = results.node.info.errors;
            
            var data = 'RPS,404s,Errors\n'+RPS+','+fourohfours+','+errors+'\n';
            return fs.writeFile$(reportFile, data);
        }
        if (!opts.quiet) {
            console.log(results);
        }
    });
};
