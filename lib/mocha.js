'use strict';

var fs = require('fs'),
    PATH = require('path'),
    Promise = require('bluebird'),
    Multiplexer = require('mocha-reporter-multiplexer');

Promise.promisifyAll(fs, { suffix: '$' });

var Base = require('mocha/lib/reporters/base');

Base.symbols.dot = '.';
Base.colors['diff added'] = 32;
Base.colors['diff removed'] = 31;

module.exports = function (opts, runner, _injected) { // jshint ignore: line
    _injected = _injected || { };
    
    var Mocha = _injected.Mocha || require('mocha'),
        fs = _injected.fs || require('fs');
    
    var streams = opts.streams || { };
        
    if (!opts.quiet) {
        if (opts.spec) {
            streams['mocha-unfunk-reporter'] = process.stdout;
        } else {
            streams[__dirname + '/dot-mod'] = process.stdout;
        }
    }
    
    if (opts.doReport) {
        if (!opts.reportDir) {
            runner.log.warn('Mocha: Report requested but no report dir specified');
        } else {
            var outStream = fs.createWriteStream(PATH.join(opts.reportDir, 'mocha.xml'));
            streams[__dirname + '/xunit-mod'] = outStream;
            outStream.write('<testsuites>\n');
            
            runner.once('done', function (await) {
                await(outStream.end.bind(outStream, '</testsuites>\n'));
            });
        }
    }
    
    return function (files, testGroup) {
        var reporter = new Multiplexer(streams, testGroup);
        var mocha = new Mocha({
            bail: opts.bail,
            ui: 'bdd',
            reporter: reporter,
            fullStackTrace: true
        });
        
        files.forEach(function (fullpath) {
            mocha.addFile(fullpath);
        });
        
        return new Promise(function (resolve) {
            mocha.run(resolve);
        }).catch(function (err) {
            try {
                err.testGroup = testGroup;
            } catch (e) {
                console.error('In %s:', testGroup);
            }
            throw err;
        });
    };
};
