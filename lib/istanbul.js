'use strict';

var istanbul = require('istanbul'),
    hook = istanbul.hook,
    Reporter = istanbul.Reporter,
    Collector = istanbul.Collector,
    Instrumenter = istanbul.Instrumenter;

var Promise = require('bluebird');

var coverageVar = '$$cov_' + new Date().getTime() + '$$',
    instrumenter = new Instrumenter({ coverageVariable: coverageVar , preserveComments: true }),
    transformer = instrumenter.instrumentSync.bind(instrumenter),
    hookOpts = { verbose: false };

var PATH = require('path');

global[coverageVar] = { };

var isJs = /\.js$/;

module.exports = function (sourceDirs, opts, runner, _injected) {
    _injected = _injected || { };
    
    var Reporter = _injected.Reporter || Reporter,
        Collector = _injected.Collector || Collector;
    
    var matchFn = (function () {
        var REs = sourceDirs.map(function (sourceDir) {
            return {
                inSourceDir: new RegExp('^' + sourceDir.replace(/([.\/])/g, "\\$1")),
                isModule: new RegExp('^' + (sourceDir + '/node_modules').replace(/([.\/])/g, "\\$1"))
            };
        });
        
        return function (path) {
            return isJs.test(path) && REs.reduce(function (ret, cur) {
                return ret || (cur.inSourceDir.test(path) && !cur.isModule.test(path));
            }, false);
        };
    })();

    runner.once('done', function writeReport() {
        if (opts.doReport && !opts.reportDir) {
            runner.log.warn('Coverage: Report requested but no report dir specified');
            return;
        }
        
        var reporter = new Reporter(null, opts.reportDir);
        var cfg = reporter.config.reporting.config;
        
        if (!opts.quiet) { reporter.add('text-summary'); }
        if (opts.doReport) { reporter.add('cobertura'); }
        
        var collector = new Collector();
        collector.add(global[coverageVar]);
        
        var deferred = Promise.defer();
        reporter.write(collector, false, deferred.callback);
        return deferred.promise;
    });
    
    return {
        hook: function () { hook.hookRequire(matchFn, transformer, hookOpts); },
        unhook: function () { hook.unhookRequire(); },
        matchFn: matchFn
    };
};
