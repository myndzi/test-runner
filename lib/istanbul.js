'use strict';

var istanbul = require('istanbul'),
    hook = istanbul.hook,
    Instrumenter = istanbul.Instrumenter;

var Promise = require('bluebird');

var coverageVar = '$$cov_' + new Date().getTime() + '$$',
    instrumenter = new Instrumenter({ coverageVariable: coverageVar , preserveComments: true }),
    transformer = instrumenter.instrumentSync.bind(instrumenter),
    hookOpts = { verbose: false };

global[coverageVar] = { };

var isJs = /\.js$/;

module.exports = function (sourceDirs, opts, runner, _injected) {
    _injected = _injected || { };
    
    var Reporter = _injected.Reporter || istanbul.Reporter,
        Collector = _injected.Collector || istanbul.Collector;
    
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

    function writeReport() {
        var reporter = new Reporter(null, opts.reportDir);

        if (!opts.quiet) { reporter.add('text-summary'); }
        if (opts.lcov) { reporter.add('lcov'); }
        if (opts.doReport) {
            if (!opts.reportDir) {
                runner.log.warn('Coverage: Report requested but no report dir specified');
            } else {
                reporter.add('cobertura');
            }
        }
        
        var collector = new Collector();
        collector.add(global[coverageVar]);
        
        var deferred = Promise.defer();
        reporter.write(collector, false, deferred.callback);
        return deferred.promise;
    }
    
    runner.once('done', writeReport);
    runner.once('fail', function () {
        runner.removeListener('done', writeReport);
    });
    
    return {
        hook: function () { hook.hookRequire(matchFn, transformer, hookOpts); },
        unhook: function () { hook.unhookRequire(); },
        matchFn: matchFn
    };
};
