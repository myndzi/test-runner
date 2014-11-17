'use strict';

require('should-eventually');

var TestList = require('../../lib/test-list');

describe('TestList', function () {
    describe('.filter', function () {
        it('should have no effect if no tokens are specified', function () {
            var tl = new TestList(__dirname, {
                testDirs: [ 'foo', 'bar' ],
                subModules: [ 'baz' ]
            });
            
            tl.filter();
            
            tl.testDirs.should.eql([ 'foo', 'bar' ]);
            tl.subModules.should.eql([ 'baz' ]);
        });
        it('should return a new list of tokens, without any \'used\' ones', function () {
            var tl = new TestList(__dirname, {
                testDirs: [ 'foo', 'bar' ],
                subModules: [ 'baz' ]
            });
            
            var tokens = tl.filter(['foo']);
            
            tokens.should.eql([]);
        });
        it('should not use tokens that don\'t match test dirs or submodules', function () {
            var tl = new TestList(__dirname, {
                testDirs: [ 'foo', 'bar' ],
                subModules: [ 'baz' ]
            });
            
            var tokens = tl.filter(['quux']);
            
            tokens.should.eql(['quux']);
        });
        it('should reduce test dirs and submodules to only those matching the tokens', function () {
            var tl = new TestList(__dirname, {
                testDirs: [ 'foo', 'bar' ],
                subModules: [ 'baz' ]
            });
            
            tl.filter(['foo']);
            
            tl.testDirs.should.eql(['foo']);
            tl.subModules.should.eql([ ]);
        });
        it('should have no effect if there are no matches at all', function () {
            var tl = new TestList(__dirname, {
                testDirs: [ 'foo', 'bar' ],
                subModules: [ 'baz' ]
            });
            
            var tokens = tl.filter(['quux']);
            
            tl.testDirs.should.eql([ 'foo', 'bar' ]);
            tl.subModules.should.eql([ 'baz' ]);
        });
    });
    describe('.loadSubModules', function () {
        it('should map subModules to instances of TestList', function () {
            var tl = new TestList(__dirname, {
                subModules: [ 'baz' ]
            });
            
            tl.loadSubModules([ ], { });
            tl.subModules[0].should.be.an.instanceof(TestList);
        });
        it('should apply .filter to mapped subModules', function () {
            var tl = new TestList(__dirname, {
                subModules: [ 'baz' ]
            });
            
            var tokens = tl.loadSubModules(['foo'], {
                testDirs: [ 'foo', 'bar' ]
            });
            
            tokens.should.eql([ ]);
            tl.subModules[0].testDirs.should.eql(['foo']);
        });
    });
    describe('.getSourceDirs', function () {
        it('should return an array of full paths to source directories', function () {
            var tl = new TestList(__dirname, {
                sourceDirs: ['app']
            });
            var dirs = tl.getSourceDirs();
            dirs.should.eql([__dirname + '/app']);
        });
        it('should work recursively', function () {
            var tl = new TestList(__dirname, {
                sourceDirs: ['app'],
                subModules: ['foo']
            });
            tl.loadSubModules([ ], {
                sourceDirs: ['lib']
            });
            var dirs = tl.getSourceDirs();
            dirs.length.should.equal(2);
        });
        it('should place dependencies first', function () {
            var tl = new TestList(__dirname, {
                sourceDirs: ['app'],
                subModules: ['foo']
            });
            tl.loadSubModules([ ], {
                sourceDirs: ['lib']
            });
            var dirs = tl.getSourceDirs();
            dirs.should.eql([
                __dirname + '/node_modules/foo/lib',
                __dirname + '/app'
            ]);
        });
    });
    describe('.getTestDirs', function () {
        it('should return an array of full paths to test directories', function () {
            var tl = new TestList(__dirname, {
                testDirs: ['bar']
            });
            var dirs = tl.getTestDirs();
            dirs.should.eql([__dirname + '/test/bar']);
        });
        it('should work recursively', function () {
            var tl = new TestList(__dirname, {
                testDirs: ['bar'],
                subModules: ['foo']
            });
            tl.loadSubModules([ ], {
                testDirs: ['baz']
            });
            var dirs = tl.getTestDirs();
            dirs.length.should.equal(2);
        });
        it('should place dependencies first', function () {
            var tl = new TestList(__dirname, {
                testDirs: ['bar'],
                subModules: ['foo']
            });
            tl.loadSubModules([ ], {
                testDirs: ['baz']
            });
            var dirs = tl.getTestDirs();
            dirs.should.eql([
                __dirname + '/node_modules/foo/test/baz',
                __dirname + '/test/bar'
            ]);
        });
    });
    describe('.getTestFiles', function () {
        it('should return all files to be loaded for testing', function () {
            var tl = new TestList(__dirname + '/fake-app', {
                testDirs: ['foo', 'bar'],
                subModules: ['quux']
            });
            tl.loadSubModules([ ], {
                testDirs: ['baz', 'foo']
            });
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles().then(function (files) {
                files.should.eql(expected);
            });
        });
        it('should return only files matching the specified tokens', function () {
            var tl = new TestList(__dirname + '/fake-app', {
                testDirs: ['foo', 'bar'],
                subModules: ['quux']
            });
            tl.loadSubModules([ ], {
                testDirs: ['baz', 'foo']
            });
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            //addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            //addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles(['keke']).then(function (files) {
                files.should.eql(expected);
            });
        });
        it('should match tokens anywhere in the filename', function () {
            var tl = new TestList(__dirname + '/fake-app', {
                testDirs: ['foo', 'bar'],
                subModules: ['quux']
            });
            tl.loadSubModules([ ], {
                testDirs: ['baz', 'foo']
            });
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            //addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            //addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles(['hai']).then(function (files) {
                files.should.eql(expected);
            });
        });
    });
    describe('general', function () {
        it('should be able to match only submodule tests', function () {
            var tl = new TestList(__dirname + '/fake-app', {
                testDirs: ['foo', 'bar'],
                subModules: ['quux']
            });
            tl.filter(['quux']);
            tl.loadSubModules([ ], {
                testDirs: ['baz', 'foo']
            });
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            //addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            //addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles().then(function (files) {
                files.should.eql(expected);
            });
        });
        it('should be able to target children of a specific test directory', function () {
            var tl = new TestList(__dirname + '/fake-app', {
                testDirs: ['foo', 'bar'],
                subModules: ['quux']
            });
            tl.filter(['foo']);
            tl.loadSubModules([ ], {
                testDirs: ['baz', 'foo']
            });
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            //addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            //addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            //addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles(['keke']).then(function (files) {
                files.should.eql(expected);
            });
        });
        it('should read config files', function () {
            var tl = new TestList(__dirname + '/fake-app');
            tl.loadSubModules();
            
            var expected = { };
            function addFiles(path, file) {
                if (!Array.isArray(file)) { file = [ file ]; }
                var arr = expected[path] = [ ];
                
                file.forEach(function (file) {
                    arr.push(path + '/' + file);
                });
            }
            
            addFiles(__dirname + '/fake-app/node_modules/quux/test/baz', 'lar.hai.test.js');
            addFiles(__dirname + '/fake-app/node_modules/quux/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/foo', 'keke.test.js');
            addFiles(__dirname + '/fake-app/test/bar', 'lar.hai.test.js');

            return tl.getTestFiles().then(function (files) {
                files.should.eql(expected);
            });
        });
    });
});
