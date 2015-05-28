'use strict';

var Promise = require('bluebird');

var fs = require('fs'),
    PATH = require('path');

Promise.promisifyAll(fs, { suffix: '$' });

var minimist = require('minimist');

var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits;

var TestList = require('./test-list');

var Logger = require('@eros/logger');

var errors = require('./errors');

function Runner(opts, baseDir) { // jshint ignore: line
    if (opts === process.argv) {
        opts = Runner.parseOpts(opts, baseDir);
    } else {
        opts = opts || { };
    }
    baseDir = opts.baseDir || opts['base-dir'];

    EventEmitter.call(this);
    
    this.logLevel =
        opts.quiet ? 'none' :
        opts.trace ? 'trace' :
        opts.verbose ? 'debug' : 'warn';
    
    this.env = opts.env || process.env.NODE_ENV || 'development';
    this.log = new Logger('Test runner', this.logLevel);
    
    this.lintOnly = !!opts.lintOnly;
    this.perfOnly = !!opts.perfOnly;
    
    this.doLint = !!opts.doLint;
    this.doPerf = !!opts.doPerf;
    this.doCov = !!opts.doCov;
    this.doReport = !!opts.doReport;
    
    if (!baseDir) { throw new Error('baseDir is a required option'); }
    this.baseDir = PATH.resolve(baseDir);
    this.reportDir = opts.reportDir;
    
    var config = { };
    try {
        config = require(PATH.join(baseDir, 'test', '.runner.json'));
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') { throw e; }
    }

    this._preload = opts._preload || (config.preload ? require(PATH.join(baseDir, 'test', config.preload)) : null);
    this._unload = opts._unload || (config.unload ? require(PATH.join(baseDir, 'test', config.unload)) : null);
    this._mocha = opts._mocha || require('./mocha');
    this._istanbul = opts._istanbul || require('./istanbul');
    this._perf = opts._perf || (config.perfTest ? require(PATH.join(baseDir, 'test', config.perfTest)) : null);
    this._lint = opts._lint || require('./jshint');
    
    if (this._perf === null && (this.doPerf || this.perfOnly)) {
        throw new Error('No performance test configured!');
    }
    
    this.opts = { };
    
    ['mocha', 'coverage', 'perf', 'lint']
    .forEach(function (type) {
        this.opts[type] = opts[type] = opts[type] || { };
        this.opts[type].logLevel = opts[type].logLevel || this.logLevel;
        this.opts[type].doReport = opts[type].doReport || this.doReport;
        this.opts[type].reportDir = opts[type].reportDir || this.reportDir;
    }, this);

    this.opts.mocha.spec = opts.spec;
    this.opts.mocha.bail = !!opts.bail;
    
    this.opts.coverage.lcov = !!opts.lcov;
    
    if (!fs.existsSync(this.baseDir)) {
        throw new Error('baseDir doesn\'t exist: ' + this.baseDir);
    }
    
    var tokens = opts.tokens || (opts._ || [ ]).slice(2);
    var testList = new TestList(this.baseDir, opts._injectedTestListConfig);
    
    tokens = testList.filter(tokens);
    tokens = testList.loadSubModules(tokens, opts._injectedSubModuleConfig);
    
    this.tokens = tokens;
    this.testList = testList;
}
inherits(Runner, EventEmitter);

Runner.parseOpts = function (argv, baseDir) {
    baseDir = baseDir || process.cwd();
    
    var opts = minimist(argv, {
        boolean: [
            'quiet', 'doReport', 'doPerf',
            'perfOnly', 'doCov', 'verbose',
            'doLint', 'lintOnly', 'spec', 'color',
            'bail', 'lcov'
        ],
        string: ['baseDir', 'reportDir'],
        alias: {
            q: 'quiet',
            r: 'doReport',
            c: 'doCov',
            v: 'verbose',
            V: 'trace',
            l: 'doLint',
            L: 'lintOnly',
            p: 'doPerf',
            P: 'perfOnly',
            'base-dir': 'baseDir',
            'report-dir': 'reportDir'
        },
        default: {
            verbose: false,
            trace: false,
            quiet: false,
            doPerf: false,
            doLint: true,
            doReport: false,
            lcov: false,
            bail: true,
            baseDir: baseDir,
            reportDir: PATH.join(baseDir, '/reports')
        }
    });
    
    if (opts.lcov) { opts.doCov = true; } 
    
    return opts;
};

Runner.prototype.run = Promise.method(function () {
    var self = this;
    var sourceDirs = this.testList.getSourceDirs();
    
    if (self.lintOnly) {
        return self._lint(sourceDirs, self.opts.lint);
    } else if (self.perfOnly) {
        return self._perf(self.baseDir, self.opts.perf);
    }
    
    var mocha, istanbul;
    
    return Promise.try(function () {
        // optimize database / app loading when running full tests
        if (self.tokens.length === 0 && self._preload) { return self._preload(); }
    })
    .return(['mocha', 'coverage', 'perf', 'lint'])
    .each(function (type) {
        if (self.opts[type].doReport) {
            var dir = self.opts[type].reportDir;
            return fs.stat$(dir)
            .catch(function (err) {
                if (err.cause && err.cause.code === 'ENOENT') {
                    return fs.mkdir$(dir);
                }
                throw err;
            });
        }
    }).then(function () {
        mocha = self._mocha(self.opts.mocha, self);
        
        if (self.doCov) {
            istanbul = self._istanbul(sourceDirs, self.opts.coverage, self);
        }
        
        return self.testList.getTestFiles(self.tokens);
    }).then(function (fileSets) {
        var totalErrors = 0;
        
        return Promise.each(Object.keys(fileSets), function (key) {
            var files = fileSets[key],
                initFile = PATH.join(key, 'init.js');

            // load files that may want to listen and initialize things on the test context
            return Promise.try(function () {
                if (self.doCov) {
                    return istanbul.hook();
                }
            }).then(function () {
                return fs.stat$(initFile).then(function () {
                    files.unshift(initFile);
                }).catch(function (err) {
                    if (!err.cause || err.cause.code !== 'ENOENT') {
                        throw err;
                    }
                });
            }).then(function () {
                var testGroup = PATH.relative(self.baseDir, key);
                if (/^node_modules/.test(testGroup)) {
                    testGroup = PATH.relative('./node_modules', testGroup);
                }
                return mocha(files, testGroup);
            }).finally(function () {
                if (self.doCov) {
                    return istanbul.unhook();
                }
            }).then(function (numErrors) {
                totalErrors += numErrors;
                if (numErrors > 0 && self.opts.mocha.bail) {
                    throw new errors.AbortTestsError();
                }
            });
        }).then(function () {
            return totalErrors;
        });
    }).tap(function () {
        if (self.doPerf) {
            return self._perf(self.baseDir, self.opts.perf);
        }
    }).tap(function () {
        if (self.doLint) {
            return self._lint(sourceDirs, self.opts.lint, self);
        }
    }).catch(function (err) {
        if (!(err instanceof errors.AbortTestsError)) {
            // some kind of error happened in the test process
            // this is NOT a failed test, but failed-to-run-tests-correctly
            // mocha reporter will not have caught this, so we need to display it
            
            // do this after everything else, but only when not self-testing
            if (self.env !== 'testing') {
                process.once('exit', function () {
                    if (err.testGroup) { console.error('In %s:', err.testGroup); }
                    console.error(err.stack || err.message || err);
                });
            }
        }
        
        return 1; // at least one error was generated
    }).tap(function () {
        // shutdown handlers
        var promises = [ ];
        self.emit('done', function (arg) {
            if (arg && typeof arg.then === 'function') {
                promises.push(arg);
            } else if (typeof arg === 'function') {
                promises.push(Promise.promisify(arg)());
            }
        });
        return Promise.settle(promises);
    }).finally(function () {
        if (!self._unload) { return; }
        
        Promise.try(function () {
            return self._unload(true);
        }).catch(function (err) {
            console.error('In cleanup:');
            console.error(err.stack || err.message || err);
        });
    });
});


module.exports = Runner;
