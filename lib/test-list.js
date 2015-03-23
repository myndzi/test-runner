'use strict';

var fs = require('fs'),
    PATH = require('path');

var Promise = require('bluebird');

Promise.promisifyAll(fs, { suffix: '$' });


/*
{
    sourceDirs: ['app', 'lib'],
    testDirs: ['services', 'api'],
    subModules: ['app-framework', 'test-runner', 'swag']
}
*/

function TestList(dir, _config) {
    dir = PATH.resolve(dir);
    var config;
    
    this.root = dir;
    
    try {
        config = _config || require(PATH.join(dir, 'test', '.runner.json'));
        
        this.sourceDirs = config.sourceDirs || [ ];
        this.testDirs = config.testDirs || [ ];
        this.subModules = config.subModules || [ ];
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') { throw e; }
        
        // set some defaults
        
        this.sourceDirs = [ ];
        var libDir = fs.statSync(PATH.join(dir, 'lib'));
        if (libDir.isDirectory()) {
            this.sourceDirs = [ 'lib' ];
        }
        
        this.testDirs = [ ];
        try {
            var testDir = fs.statSync(PATH.join(dir, 'test'));
            if (testDir.isDirectory()) {
                this.testDirs = fs.readdirSync(PATH.join(dir, 'test'))
                    .filter(function (pathName) {
                        var stat = fs.statSync(PATH.join(dir, 'test', pathName));
                        return stat.isDirectory();
                    });
            }
        } catch (e) {
            if (e.code !== 'ENOENT') { throw e; }
        }
        
        this.subModules = [ ];
    }
}

TestList.prototype.filter = function (_tokens) {
    var tokens = Array.isArray(_tokens) ? _tokens.slice() : [ ];
    
    var _testDirs = this.testDirs.filter(function (dirName) {
        var idx = tokens.indexOf(dirName);
        if (idx > -1) {
            tokens.splice(idx, 1);
            return true;
        }
        return false;
    });
    
    var _subModules = this.subModules.filter(function (moduleName) {
        var idx = tokens.indexOf(moduleName);
        if (idx > -1) {
            tokens.splice(idx, 1);
            return true;
        }
        return false;
    });
    
    if (_testDirs.length || _subModules.length) {
        this.testDirs = _testDirs;
        this.subModules = _subModules;
    }
    
    return tokens;
};
TestList.prototype.loadSubModules = function (_tokens, _injectedConfig) {
    var tokens = Array.isArray(_tokens) ? _tokens.slice() : [ ];
    
    this.subModules = this.subModules.map(function (moduleName) {
        var testList = new TestList(PATH.join(this.root, 'node_modules', moduleName), _injectedConfig);
        tokens = testList.filter(tokens);
        tokens = testList.loadSubModules(tokens);
        return testList;
    }, this);
    
    return tokens;
};
TestList.prototype.getSourceDirs = function () {
    var files = [ ],
        rootDir = this.root;
    
    this.subModules.forEach(function (testList) {
        files = files.concat(testList.getSourceDirs());
    });
    files = files.concat(this.sourceDirs.map(function (dir) {
        return PATH.join(rootDir, dir);
    }));
    
    return files;
};
TestList.prototype.getTestDirs = function () {
    var files = [ ],
        rootDir = this.root;
    
    this.subModules.forEach(function (testList) {
        files = files.concat(testList.getTestDirs());
    });
    // test dependents first, then this module's files
    files = files.concat(this.testDirs.map(function (dir) {
        return PATH.join(rootDir, 'test', dir);
    }));
    
    return files;
};
TestList.prototype.getTestFiles = function (tokens) {
    tokens = tokens || [ ];
    return Promise.reduce(this.getTestDirs(), function (obj, testDir) {
        return fs.readdir$(testDir)
        .each(function (filename) {
            if (!/\.js$/.test(filename)) { return; }

            var split = filename.split('.').slice(0, -1);
            
            var keep = tokens.length === 0 || split.reduce(function (ret, cur) {
                return ret || tokens.indexOf(cur) > -1;
            }, false);
            
            if (!keep) { return; }
            
            obj[testDir] = obj[testDir] || [ ];
            if (filename !== 'init.js') {
                obj[testDir].push(PATH.join(testDir, filename));
            }
        }).return(obj);
    }, { });
};

module.exports = TestList;

