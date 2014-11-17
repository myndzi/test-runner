'use strict';

var Promise = require('bluebird');

var fs = require('fs'),
    PATH = require('path');

Promise.promisifyAll(fs, { suffix: '$' });

module.exports = Runner;

var minimist = require('minimist');

var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits;

var TestList = require('./test-list');

module.exports = Runner;
/*
    argv = minimist(argv, {
        boolean: [
            'quiet', 'report', 'perf',
            'perfOnly', 'coverage', 'verbose',
            'lint', 'lintOnly', 'spec'
        ],
        string: 'base-dir',
        alias: {
            q: 'quiet',
            r: 'report',
            c: 'coverage',
            cov: 'coverage',
            v: 'verbose',
            V: 'trace',
            hint: 'lint',
            l: 'lint',
            L: 'lintOnly',
            p: 'perf',
            P: 'perfOnly'
        },
        default: {
            verbose: false,
            trace: false,
            quiet: false,
            lint: true,
            report: false,
            'base-dir': process.cwd()
        }
    });
    
*/
function Runner(opts) {
    opts = opts || { };
    
    EventEmitter.call(this);
    
    this.logLevel = opts.trace || opts.verbose || opts.quiet || 'warn';
    
    this.lintOnly = !!opts.lintOnly;
    this.perfOnly = !!opts.perfOnly;
    
    this.doLint = !!opts.doLint;
    this.doPerf = !!opts.doPerf;
    this.doCov = !!opts.doCov;
    this.doReport = !!opts.doReport;
    
    var baseDir = opts.baseDir || opts['base-dir'];
    if (!baseDir) { throw new Error('baseDir is a required option'); }
    this.baseDir = PATH.resolve(baseDir);
    
    this._mocha = opts._mocha || require('./mocha');
    this._istanbul = opts._istanbul || require('./istanbul');
    this._perf = opts._perf || require('./perf');
    this._lint = opts._lint || require('./jshint');
    
    this.opts = { };
    
    ['mocha', 'coverage', 'perf', 'lint']
    .forEach(function (type) {
        this.opts[type] = opts[type] = opts[type] || { };
        this.opts[type].logLevel = opts[type].logLevel || this.logLevel;
        this.opts[type].doReport = opts[type].doReport || this.doReport;
    }, this);
    
    if (!fs.existsSync(this.baseDir)) {
        throw new Error('baseDir doesn\'t exist: ' + this.baseDir);
    }
    
    var tokens = opts.tokens;
    var testList = new TestList(this.baseDir, opts._injectedTestListConfig);
    
    tokens = testList.filter(tokens);
    tokens = testList.loadSubModules(tokens, opts._injectedSubModuleConfig);
    
    this.tokens = tokens;
    this.testList = testList;
}
inherits(Runner, EventEmitter);

Runner.prototype.run = Promise.method(function () {
    var self = this;
    var sourceDirs = this.testList.getSourceDirs();
    
    if (self.lintOnly) {
        return self._lint(sourceDirs, self.opts.lint);
    } else if (self.perfOnly) {
        return self._perf(self.opts.perf);
    }
    
    var mocha = self._mocha(self.opts.mocha), istanbul;
    if (self.doCov) {
        istanbul = self._istanbul(sourceDirs, self.opts.coverage, self);
    }
    
    return self.testList.getTestFiles()
    .then(function (fileSets) {
        var ctx = { };
        
        return Promise.each(Object.keys(fileSets), function (key) {
            var files = fileSets[key],
                initFile = PATH.join(key, 'init.js');

            // load files that may want to listen and initialize things on the test context
            return fs.stat$(initFile).then(function () {
                if (self.doCov) { istanbul.hook(); }
                return require(initFile).call(ctx, self);
            }).catch(function (err) {
                if (err.cause && err.cause.code !== 'ENOENT') {
                    throw err;
                }
            }).then(function () {
                if (self.doCov) { istanbul.unhook(); }
                return mocha(files, ctx, self);
            });
        });
    }).then(function () {
        if (self.doPerf) {
            self._perf(self.opts.perf);
        }
    }).then(function () {
        if (self.doLint) {
            self._lint(sourceDirs, self.opts.lint);
        }
    }).then(function () {
        self.emit('done');
    });
});
