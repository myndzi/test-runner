'use strict';

var fs = require('fs'),
    PATH = require('path'),
    Promise = require('bluebird');

var jshint = require('jshint'),
    JSHINT = jshint.JSHINT,
    extract = jshint.extract,
    lint = jshint.lint,
    getConfig = require('jshint/src/cli').getConfig;

Promise.promisifyAll(fs, { suffix: '$' });

var baseDir = PATH.resolve(__dirname, '..');

var checkDirs = ['app', 'lib'];

var reporters = [];

function readdirRecursive(dir) {
    return fs.readdir$(PATH.join(baseDir, dir)).reduce(function (ret, path) {
        var fullpath = PATH.join(baseDir, dir, path);
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

module.exports = function (app, opts) {
    var results = [ ],
        data = [ ];
    
    if (!opts.quiet) {
        reporters.push(
            { reporter: require('jshint-stylish-ex/stylish.js').reporter,
              stream: process.stdout }
        );
    }
    if (opts.report) {
        reporters.push(
            { reporter: require('jshint/src/reporters/checkstyle').reporter,
              stream: PATH.join(baseDir, 'reports') }
        );
    }
    
    return Promise.reduce(checkDirs, function (ret, cur) {
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
    }).each(function (file) {
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
            var cl = console.log, filename;
            if (typeof r.stream === 'string') {
                filename = PATH.join(r.stream, 'jshint.xml');
                r.stream = fs.createWriteStream(filename);
            }
            console.log = function (str) {
                r.stream.write(str+'\n');
            };
            r.reporter(results, data, { verbose: false });
            console.log = cl;
            if (filename) { r.stream.end(); }
        });
    });
}
