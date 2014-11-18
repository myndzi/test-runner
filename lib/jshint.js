'use strict';

var fs = require('fs'),
    PATH = require('path'),
    Promise = require('bluebird');

var jshint = require('jshint'),
    JSHINT = jshint.JSHINT,
    getConfig = require('jshint/src/cli').getConfig;

// weird hack around color support
require('jshint-stylish-ex/node_modules/chalk');

Promise.promisifyAll(fs, { suffix: '$' });

var reporters = [];

module.exports = function (sourceDirs, opts, runner, _injected) { // jshint ignore: line
    _injected = _injected || { };
    
    var results = [ ],
        data = [ ];
    
    var fs = _injected.fs || require('fs');
    
    var streams = opts.streams || { };
    
    function readdirRecursive(dir) {
        return fs.readdir$(dir).reduce(function (ret, path) {
            var fullpath = PATH.join(dir, path);
            return fs.stat$(fullpath)
            .then(function (stat) {
                if (stat.isFile()) {
                    if (!/.js/.test(path)) { return ret; }
                    return ret.concat([fullpath]);
                } else {
                    return readdirRecursive(PATH.join(dir, path))
                    .then(function (paths) {
                        return ret.concat(paths);
                    });
                }
            });
        }, [ ]);
    }
    
    if (!opts.quiet) {
        streams['jshint-stylish-ex/stylish'] = process.stdout;
    }
    if (opts.doReport) {
        if (!opts.reportDir) {
            runner.log.warn('Lint: Report requested but no report dir specified');
        } else {
            var strim = fs.createWriteStream(PATH.join(opts.reportDir, 'jshint.xml'));
            streams['jshint/src/reporters/checkstyle'] = strim;
            runner.once('done', function () {
                strim.end();
            });
        }
    }
    
    if (!Object.keys(streams).length) { return; }
    
    Object.keys(streams).forEach(function (key) {
        reporters.push({
            reporter: require(key).reporter,
            stream: streams[key]
        });
    });
    
    return Promise.reduce(sourceDirs, function (ret, cur) {
        return readdirRecursive(cur)
        .then(function (paths) {
            return ret.concat(paths);
        });
    }, [ ]).map(function (fullpath) {
        return Promise.props({
            fullpath: fullpath,
            config: getConfig(fullpath),
            code: fs.readFile$(fullpath)
        });
    }).each(function (file) { //jshint maxstatements: 25
        var str = file.code.toString().replace(/^\uFEFF/, ""); // Remove potential Unicode BOM.
        var globals = { }, config = file.config;
        
        if (config.prereq) {
            throw new Error('Not supported');
        }
        if (config.globals) {
            globals = config.globals;
            delete config.globals;
        }
        if (config.overrides) {
            throw new Error('Not supported');
        }
        delete config.dirname;
        
        globals.describe = true;
        globals.before = true;
        globals.after = true;
        globals.it = true;
        
        var result = JSHINT(str, config, globals);

        if (!result) {
            JSHINT.errors.forEach(function (err) {
                if (err) {
                    results.push({ file: file.fullpath || "stdin", error: err });
                }
            });
        }

        var lintData = JSHINT.data();
        if (lintData) {
            lintData = file.fullpath;
            data.push(lintData);
        }
        
    }).then(function () {
        reporters.forEach(function (r) {
            var cl = console.log;
    
            console.log = function (str) {
                r.stream.write(str+'\n');
            };
            
            r.reporter(results, data, { verbose: false });
            
            console.log = cl;
        });
    });
};
