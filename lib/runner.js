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
    
    return minimist(argv, {
        boolean: [
            'quiet', 'doReport', 'doPerf',
            'perfOnly', 'doCov', 'verbose',
            'doLint', 'lintOnly', 'spec', 'color',
            'bail'
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
            bail: true,
            baseDir: baseDir,
            reportDir: PATH.join(baseDir, '/reports')
        }
    });
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
                    files.unshift(PATH.join(key, 'init.js'));
                }).catch(function (err) {
                    if (!err.cause || err.cause.code !== 'ENOENT') {
                        throw err;
                    }
                });
            }).then(function () {
                return mocha(files, PATH.relative(self.baseDir, key));
            }).tap(function () {
                if (self.doCov) {
                    return istanbul.unhook();
                }
            }).then(function (errors) {
                if (errors) {
                    throw 'fail';
                }
            }).catch(function (err) {
                if (self.opts.mocha.bail) {
                    throw err;
                }
            });
        });
    }).then(function () {
        if (self.doPerf) {
            return self._perf(self.baseDir, self.opts.perf);
        }
    }).then(function () {
        if (self.doLint) {
            return self._lint(sourceDirs, self.opts.lint, self);
        }
    }).catch(function (err) {
        if (err === 'fail') {
            self.emit('fail');
            return;
        }
        
        console.error(err.stack || err.message || err);
    }).then(function () {
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
        if (self._unload) { return self._unload(); }
    });
});


module.exports = Runner;
