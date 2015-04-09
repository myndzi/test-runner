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
    
    // jshint ignore: start

    // monkey patch run to emit 'test group' event
    Mocha.prototype.run = function(testGroup, fn){
        if (this.files.length) { this.loadFiles(); }
        var suite = this.suite;
        var options = this.options;
        options.files = this.files;
        var runner = new Mocha.Runner(suite);
        var reporter = new this._reporter(runner, options);
        runner.ignoreLeaks = false !== options.ignoreLeaks;
        runner.asyncOnly = options.asyncOnly;
        if (options.grep) { runner.grep(options.grep, options.invert); }
        if (options.globals) { runner.globals(options.globals); }
        if (options.growl) { this._growl(runner, reporter); }
        Mocha.reporters.Base.inlineDiffs = options.useInlineDiffs;
        runner.emit('test group', testGroup);
        return runner.run(fn);
    };
    
    // in for a penny, in for a pound
    Mocha.Runner.prototype.hook = function(name, fn){
        var suite = this.suite
        , hooks = suite['_' + name]
        , self = this
        , timer;

        function next(i) {
            var hook = hooks[i];
            if (!hook) return fn();
            
            // why would we bail on hooks??
            //if (self.failures && suite.bail()) return fn();
            self.currentRunnable = hook;

            hook.ctx.currentTest = self.test;

            self.emit('hook', hook);

            hook.on('error', function(err){
                self.failHook(hook, err);
            });

            hook.run(function(err){
                hook.removeAllListeners('error');
                var testError = hook.error();
                if (testError) self.fail(self.test, testError);
                if (err) {
                    self.failHook(hook, err);

                    // stop executing hooks, notify callee of hook err
                    return fn(err);
                }
                self.emit('hook end', hook);
                delete hook.ctx.currentTest;
                next(++i);
            });
        }

        Mocha.Runner.immediately(function(){
            next(0);
        });
    };
    
    
    // jshint ignore: end
    
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
            streams['mocha/lib/reporters/xunit'] = outStream;
            outStream.write('<testsuites>\n');
            
            runner.once('done', function (await) {
                await(outStream.end.bind(outStream, '</testsuites>\n'));
            });
        }
    }
    
    return function (files, key) {
        var reporter = new Multiplexer(streams);
        var mocha = new Mocha({
            bail: true,
            ui: 'bdd',
            reporter: reporter
        });
        
        files.forEach(function (fullpath) {
            mocha.addFile(fullpath);
        });
        
        // determine how to tell if the tests failed
        return Promise.promisify(mocha.run, mocha)(key)
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
