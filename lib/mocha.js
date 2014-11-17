'use strict';

var fs = require('fs'),
    PATH = require('path'),
    Promise = require('bluebird'),
    Multiplexer = require('mocha-reporter-multiplexer');

Promise.promisifyAll(fs, { suffix: '$' });

var Base = require('mocha/lib/reporters/base');

Base.symbols.dot = '.';

module.exports = function (opts, runner, _injected) {
    _injected = _injected || { };
    var Mocha = _injected.Mocha || require('mocha'),
        fs = _injected.fs || fs;
    
    var reporters = { },
        streams = opts.streams || { };
        
    if (!opts.quiet) {
        if (opts.spec) {
            streams['mocha-unfunk-reporter'] = process.stdout;
        } else {
            streams['mocha/lib/reporters/dot'] = process.stdout;
        }
    }
    
    if (opts.doReport) {
        if (opts.doReport && !opts.reportDir) {
            runner.log.warn('Coverage: Report requested but no report dir specified');
            return;
        }
        var outStream = fs.createWriteStream(PATH.join(opts.reportDir, 'mocha.xml'));
        streams['mocha/lib/reporters/xunit'] = outStream;
        outStream.write('<testsuites>\n');
        
        runner.once('done', function (await) {
            await(outStream.end.bind(outStream, '</testsuites>\n'));
        });
    }
    
    return function (files, ctx, key) {
        var reporter = new Multiplexer(streams);
        var mocha = new Mocha({
            bail: true,
            ui: 'bdd',
            reporter: reporter
        });
        
        files.forEach(function (fullpath) {
            mocha.addFile(fullpath);
        });
        
        mocha.suite.ctx = ctx;
        console.log('Running: ' + key);
        
        // determine how to tell if the tests failed
        return Promise.promisify(mocha.run, mocha)()
        .return(0)
        .catch(function (err) {
            // OperationalError is a bluebird thing, I think?
            if (err.name && err.name === 'OperationalError') {
                return err.message;
            }
            throw err;
        });
    };
};
