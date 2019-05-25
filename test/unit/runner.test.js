'use strict';

require('should');

var Runner = require('../../lib/runner');

var Promise = require('bluebird');

function noop () { };

describe('runner', function () {
    it('should throw if no baseDir given', function () {
        (function () {
            new Runner();
        }).should.throw(/baseDir is a required option/);
    });
    it('should throw if baseDir doesn\'t exist', function () {
        (function () {
            new Runner({
                baseDir: 'foobar'
            });
        }).should.throw(/baseDir doesn't exist:/);
    });
    describe('options', function () {
        it('should default logLevel to \'warn\'', function () {
            var foo = new Runner({ baseDir: __dirname + '/fake-app' });
            ['mocha', 'coverage', 'perf', 'lint']
            .forEach(function (type) {
                foo.opts[type].logLevel.should.equal('warn');
            });
        });
        it('should default \'doReport\' to the global value', function () {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                doReport: false
            });
            ['mocha', 'coverage', 'perf', 'lint']
            .forEach(function (type) {
                foo.opts[type].doReport.should.equal(false);
            });
            foo = new Runner({
                baseDir: __dirname + '/fake-app',
                doReport: true
            });
            ['mocha', 'coverage', 'perf', 'lint']
            .forEach(function (type) {
                foo.opts[type].doReport.should.equal(true);
            });
        });
        it('should keep explicitly specified config instead of the default', function () {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                doReport: false,
                perf: {
                    doReport: true,
                    logLevel: 'silly'
                }
            });

            foo.opts.perf.doReport.should.equal(true);
            foo.opts.lint.doReport.should.equal(false);

            foo.opts.perf.logLevel.should.equal('silly');
            foo.opts.lint.logLevel.should.equal('warn');
        });
    });
    describe('lint', function () {
        it('should honor .lintOnly', function () {
            var lintRan = false,
                getDirsRan = false;

            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                lintOnly: true,
                _lint: function () { lintRan = true; }
            });
            foo.testList.getTestDirs = function () { getDirsRan = true; }

            return foo.run().then(function () {
                lintRan.should.equal(true);
                getDirsRan.should.equal(false);
            });
        });
        it('should run lint', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _lint: function () { ran = true; },
                doLint: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass the source directories', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _lint: function (sourceDirs) {
                    sourceDirs.should.eql([__dirname + '/fake-app/lib']);
                    ran = true;
                },
                doLint: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass the source directories (lintOnly)', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _lint: function (sourceDirs) {
                    sourceDirs.should.eql([__dirname + '/fake-app/lib']);
                    ran = true;
                },
                lintOnly: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass the options', function () {
            var ran = false, bar = { };
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _lint: function (sourceDirs, opts) {
                    opts.should.equal(bar);
                    ran = true;
                },
                lint: bar,
                doLint: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass the options (lintOnly)', function () {
            var ran = false, bar = { };
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _lint: function (sourceDirs, opts) {
                    opts.should.equal(bar);
                    ran = true;
                },
                lint: bar,
                lintOnly: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
    });
    describe('performance', function () {
        it('should honor .perfOnly', function () {
            var perfRan = false,
                getDirsRan = false;

            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                perfOnly: true,
                _perf: function () { perfRan = true; }
            });
            foo.testList.getTestDirs = function () { getDirsRan = true; }

            return foo.run().then(function () {
                perfRan.should.equal(true);
                getDirsRan.should.equal(false);
            });
        });
        it('should run perf', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _perf: function () { ran = true; },
                doPerf: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass opts', function () {
            var ran = false, bar = { };
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _perf: function (baseDir, opts) {
                    opts.should.equal(bar);
                    ran = true;
                },
                perf: bar,
                doPerf: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should pass opts (perfOnly)', function () {
            var ran = false, bar = { };
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop; },
                _perf: function (baseDir, opts) {
                    opts.should.equal(bar);
                    ran = true;
                },
                perf: bar,
                perfOnly: true
            });
            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });

    });
    describe('mocha', function () {
        it('should execute mocha on each batch of files', function () {
            var runs = 0;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return function () { runs++; } }
            });
            return foo.run().then(function () {
                runs.should.equal(4);
            });
        });
        it('should filter on the passed tokens', function () {
            var runs = 0;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () {
                    return function () { runs++; }
                },
                tokens: ['foo']
            });
            return foo.run().then(function () {
                runs.should.equal(1);
            });
        });
    });
    describe('\'done\' event', function () {
        it('should emit \'done\' when complete', function (done) {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                tokens: ['foo']
            });
            foo.on('done', done.bind(null, null));
            foo.run();
        });
        it('should provide an \'await\' callback and not conclude until awaited items are complete', function () {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                tokens: ['foo']
            });
            foo.on('done', function (await) {
                await(Promise.delay(40));
            });
            return foo.run();
        });
        it('\'await\' should allow node-style async functions', function () {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                tokens: ['foo']
            });
            foo.on('done', function (await) {
                await(function (cb) {
                    setTimeout(cb, 40);
                });
            });
            return foo.run();
        });
    });
    describe('coverage', function () {
        xit('should wrap \'init.js\' in istanbul hooks if coverage is enabled', function () {
            var order = [ ];
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                _istanbul: function () {
                    return {
                        hook: function () { order.push('hook'); },
                        unhook: function () { order.push('unhook'); }
                    };
                },
                doCov: true,
                tokens: ['foo']
            });
            foo.__test = function () { order.push('init'); }

            return foo.run().then(function () {
                order.should.eql(['hook', 'init', 'unhook']);
            });
        });
        it('should inject the runner into the istanbul callback', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                _istanbul: function (sourceDirs, opts, runner) {
                    ran = true;
                    runner.should.equal(foo);
                    return { hook: noop, unhook: noop, writeReport: noop };
                },
                doCov: true,
                tokens: ['foo']
            });

            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should provide the source dirs to the istanbul callback', function () {
            var ran = false;
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                _istanbul: function (sourceDirs, opts, runner) {
                    ran = true;
                    sourceDirs.should.eql([ __dirname+'/fake-app/lib' ]);
                    return { hook: noop, unhook: noop, writeReport: noop };
                },
                doCov: true,
                tokens: ['foo']
            });

            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should provide specified options to the istanbul callback', function () {
            var ran = false, bar = { };
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return noop },
                _istanbul: function (sourceDirs, opts, runner) {
                    ran = true;
                    sourceDirs.should.eql([ __dirname+'/fake-app/lib' ]);
                    return { hook: noop, unhook: noop, writeReport: noop };
                },
                coverage: bar,
                doCov: true,
                tokens: ['foo']
            });

            return foo.run().then(function () {
                ran.should.equal(true);
            });
        });
        it('should unhook require if mocha passes errors', function () {
            var ran = false;
            var foo = new Runner({
                env: 'testing',
                baseDir: __dirname + '/fake-app',
                _mocha: function () {
                    return function () { throw new Error('foo'); }
                },
                _istanbul: function (sourceDirs, opts, runner) {
                    return {
                        hook: noop,
                        unhook: function () { ran = true; },
                        writeReport: noop
                    };
                },
                coverage: { },
                doCov: true,
                tokens: ['foo']
            });

            return foo.run().then(function () {
                ran.should.equal(true);
            }).catch(function () {
                // swallow the error
            });
        });
    });

    xdescribe('init.js', function () {
        it('should load \'init.js\' if present', function (done) {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () { return function () { }; }
            });
            foo.__test = done;
            return foo.run();
        });
        it('should be passed the test context as \'this\'', function (done) {
            var foo = new Runner({
                baseDir: __dirname + '/fake-app',
                _mocha: function () {
                    return function (files, ctx, runner) {
                        ctx.foo.should.equal('bar');
                    };
                }
            });
            foo.__test = done;
            foo.testList.filter(['foo']);
            return foo.run();
        });
    });
});
