'use strict';

var PATH = require('path');

describe('istanbul', function () {
    var istanbul = require('../../lib/istanbul'),
        EventEmitter = require('events').EventEmitter;
    
    function noop() { }
    
    describe('matchFn', function () {
        var matchFn;
        before(function () {
            matchFn = istanbul([
                PATH.join(__dirname, 'fake-app'),
                PATH.join(__dirname, '../..', 'node_modules', 'istanbul', 'lib'),
                PATH.join(__dirname, '../..', 'node_modules', 'istanbul')
            
            ], { }, new EventEmitter()).matchFn;
        });
        
        it('should only accept .js files', function () {
            matchFn(PATH.join(__dirname, 'fake-app', 'foo')).should.equal(false);
            matchFn(PATH.join(__dirname, 'fake-app', 'foo.js')).should.equal(true);
        });
        it('should not accept files in node_modules', function () {
            matchFn(PATH.join(__dirname, '../..', 'node_modules', 'foo.js')).should.equal(false);
        });
        it('should accept files in sourceDirs that are in node_modules', function () {
            matchFn(PATH.join(__dirname, '../..', 'node_modules', 'istanbul', 'bar.js')).should.equal(true);
        });
        it('should accept files in subdirectories', function () {
            matchFn(PATH.join(__dirname, 'fake-app', 'foo', 'bar', 'baz.js')).should.equal(true);
        });
        it('should reject files outside of sourceDirs', function () {
            matchFn('/foo/bar/baz.js').should.equal(false);
        });
    });
    
    it('should log a warning if report is requested but no report directory exists', function (done) {
        var ee = new EventEmitter();
        ee.log = {
            warn: function (str) {
                str.should.match(/no report dir/);
                done();
            }
        };
        
        istanbul([], { doReport: true }, ee);
        ee.emit('done')
    });
    
    it('should report a summary', function () {
        var ee = new EventEmitter(),
            args = [ ];
        
        istanbul([], { reportDir: '.' }, ee, {
            Reporter: function () {
                return {
                    add: function (arg) { args.push(arg); },
                    config: { reporting: { config: { } } },
                    write: noop
                };
            },
            Collector: function () {
                return { add: noop };
            }
        });
        
        ee.emit('done');
        args.should.eql(['text-summary']);
    });
    it('should not report a summary if \'quiet\' is set', function () {
        var ee = new EventEmitter(),
            args = [ ];
        
        istanbul([], { reportDir: '.', quiet: true }, ee, {
            Reporter: function () {
                return {
                    add: function (arg) { args.push(arg); },
                    config: { reporting: { config: { } } },
                    write: noop
                };
            },
            Collector: function () {
                return { add: noop };
            }
        });
        
        ee.emit('done');
        args.should.eql([]);
    });
    it('should add cobertura if doReport is set', function () {
        var ee = new EventEmitter(),
            args = [ ];
        
        istanbul([], { reportDir: '.', doReport: true }, ee, {
            Reporter: function () {
                return {
                    add: function (arg) { args.push(arg); },
                    config: { reporting: { config: { } } },
                    write: noop
                };
            },
            Collector: function () {
                return { add: noop };
            }
        });
        
        ee.emit('done');
        args.should.eql(['text-summary', 'cobertura']);
    });
});
