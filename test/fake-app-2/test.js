'use strict';

var Runner = require('../../lib/runner');

var runner = new Runner({
    baseDir: __dirname,
    _injectedTestListConfig: {
        sourceDirs: ['lib'],
        testDirs: ['success', 'failure'],
    },
    doLint: true,
    doCov: true,
    //tokens: ['success']
});

runner.run();
