'use strict';

var jshint = require('../../lib/jshint');

var EventEmitter = require('events').EventEmitter,
    PassThrough = require('stream').PassThrough;

var Promise = require('bluebird');

require('should-eventually');

describe('jshint', function () {
    it('should not use any reporters if \'quiet\' is truthy', function () {
        var streams = { };
        jshint([ ], { quiet: true, streams: streams });
        Object.keys(streams).should.be.an.Array.of.length(0);
    });
    it('should use jshint-stylish-ex to the screen by default', function () {
        var streams = { };
        var pso = process.stdout;
        Object.defineProperty(process, 'stdout', {
            value: new PassThrough()
        });
        
        return jshint([ ], { streams: streams }).then(function () {
            streams['jshint-stylish-ex/stylish'].should.equal(process.stdout);
            
            Object.defineProperty(process, 'stdout', {
                value: pso
            });
        });
    });
    it('should log a warning if report is requested but no reportDir is specified', function () {
        var called = false, mock = {
            log: { warn: function (str) {
                called = true;
                str.should.match(/no report dir specified/);
            } }
        };
        
        return jshint([ ], { doReport: true, quiet: true }, mock)
        .then(function () {
            called.should.equal(true);
        });
    });
    it('should write to a report file if requested', function () {
        var streams = { }, created = false, written = false;
        return jshint([
            __dirname + '/fake-app/test/foo'
        ], {
            streams: streams,
            doReport: true,
            quiet: true,
            reportDir: '.'
        }, new EventEmitter(), {
            fs: {
                readdir$: function () { return Promise.resolve([ ]); },
                createWriteStream: function () {
                    created = true;
                    return { write: function (data) { written = true; } };
                }
            }
        }).then(function () {
            created.should.equal(true);
            written.should.equal(true);
            streams['jshint/src/reporters/checkstyle'].should.be.ok;
        });
    });
    it('should end the xml file on the \'done\' event', function () {
        var streams = { }, ended = false;
        var ee = new EventEmitter();
        return jshint([
            __dirname + '/fake-app/test/foo'
        ], {
            streams: streams,
            doReport: true,
            quiet: true,
            reportDir: '.'
        }, ee, {
            fs: {
                readdir$: function () { return Promise.resolve([ ]); },
                createWriteStream: function () {
                    return {
                        write: function () { },
                        end: function () { ended = true; }
                    };
                }
            }
        }).then(function () {
            ee.emit('done', function (cb) { cb(); });
            ended.should.equal(true);
        });
    });
});
