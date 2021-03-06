'use strict';

var mocha = require('../../lib/mocha');

var EventEmitter = require('events').EventEmitter,
    PATH = require('path');

var basedir = PATH.resolve(PATH.join(__dirname, '..', '..'));

require('should');

describe('mocha', function () {
    it('should not use any reporters if \'quiet\' is truthy', function () {
        var streams = { };
        mocha({ quiet: true, streams: streams });
        Object.keys(streams).should.be.an.Array().of.length(0);
    });
    it('should use local dot reporter to the screen by default', function () {
        var streams = { };
        mocha({ streams: streams });
        var path = require('path').resolve(__dirname + '/../../lib/dot-mod');
        streams[path].should.equal(process.stdout);
    });
    it('should use mocha-unfunk-reporter if \'spec\' is truthy', function () {
        var streams = { };
        mocha({ streams: streams, spec: true });
        streams['mocha-unfunk-reporter'].should.equal(process.stdout);
    });
    it('should log a warning if report is requested but no reportDir is specified', function () {
        var called = false, mock = {
            log: { warn: function (str) {
                called = true;
                str.should.match(/no report dir specified/);
            } }
        };

        mocha({ doReport: true }, mock);
        called.should.equal(true);
    });
    it('should begin an xml file if a report is requested', function () {
        var streams = { }, created = false, written = false;
        mocha({ streams: streams, doReport: true, quiet: true, reportDir: '.' }, new EventEmitter(), {
            fs: {
                createWriteStream: function () {
                    created = true;
                    return {
                        write: function (data) {
                            written = true;
                        }
                    };
                }
            }
        });
        created.should.equal(true);
        written.should.equal(true);
        streams[basedir+'/lib/xunit-mod'].should.be.ok;
    });
    it('should end the xml file on the \'done\' event', function () {
        var streams = { }, ended = false;
        var ee = new EventEmitter();
        mocha({ streams: streams, doReport: true, quiet: true, reportDir: '.' }, ee, {
            fs: {
                createWriteStream: function () {
                    return {
                        write: function () { },
                        end: function () { ended = true; }
                    };
                }
            }
        });
        ee.emit('done', function (cb) { cb(); });
        ended.should.equal(true);
    });
});
