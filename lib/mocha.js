'use strict';

var fs = require('fs'),
    PATH = require('path'),
    Mocha = require('mocha'),
    Promise = require('bluebird'),
    Multiplexer = require('mocha-reporter-multiplexer');

Promise.promisifyAll(fs, { suffix: '$' });

var Base = require('mocha/lib/reporters/base');

Base.symbols.dot = '.';

module.exports = function (opts) {
    var reporters = { },
        streams = { };
        
    if (!opts.quiet) {
        if (opts.spec) {
            streams['mocha-unfunk-reporter'] = process.stdout;
        } else {
            streams['mocha/lib/reporters/dot'] = process.stdout;
        }
    }
    
    if (opts.report) {
        var outStream = fs.createWriteStream(PATH.join(__dirname, '../reports/mocha.xml'));
        streams['mocha/lib/reporters/xunit'] = outStream;
        outStream.write('<testsuites>\n');
    }
    
    return function (files, ctx, runner) {
        runner.on('done', function () {
            if (!opts.report) { return; }
            
            var deferred = Promise.defer();
            outStream.end('</testsuites>\n', deferred.callback);
            
            return deferred.promise;
        });
        
        var reporter = new Multiplexer(streams);
        var mocha = new Mocha({
            bail: true,
            ui: 'bdd',
            reporter: reporter
        });
        
        files.forEach(function (fullpath) {
            mocha.addFile(fullpath);
        });
        
        mocha.suite.ctx = { runner: runner };
        
        return Promise.promisify(mocha.run, mocha)()
        .catch(function (err) {
            if (err.name && err.name === 'OperationalError') {
                return err.message;
            }
            throw err;
        });
    };
};
