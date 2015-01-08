'use strict';

var PATH = require('path'),
    fs = require('fs');

var util = require('util');

var Promise = require('bluebird');
Promise.promisifyAll(fs, { suffix: '$' });

module.exports = function (baseDir, opts) {
    opts = opts || { };

    var playlog = require('@eros/sites-load-test/playlog');
    
    return playlog({
        baseDir: baseDir,
        node: true,
        logLevel: opts.logLevel
    }).then(function (results) {
        if (opts.logLevel === 'debug' || opts.logLevel === 'trace') {
            console.log(util.inspect(results, { depth: null }));
        }
        
        if (opts.doReport) {
            var reportFile = opts.reportFile || PATH.join(opts.reportDir, 'perf.xml');

            var RPS = results.node.info.RPS,
                fourohfours = results.node.info['404s'],
                errors = results.node.info.errors;
            
            var throughputXml =
                '<RPS>'+RPS+'</RPS>'+
                '<FourOhFours>'+fourohfours+'</FourOhFours>'+
                '<Errors>'+errors+'</Errors>'
            ;
            
            var methodMinXml = Object.keys(results.node.methods).map(function (key) {
                return '<'+key+'>'+results.node.methods[key].min+'</'+key+'>';
            }).join('');
            
            var methodAvgXml = Object.keys(results.node.methods).map(function (key) {
                return '<'+key+'>'+results.node.methods[key].avg+'</'+key+'>';
            }).join('');
            
            var methodMaxXml = Object.keys(results.node.methods).map(function (key) {
                return '<'+key+'>'+results.node.methods[key].max+'</'+key+'>';
            }).join('');

            var xmldata =
                '<Throughput>'+throughputXml+'</Throughput>\n'+
                '<MethodMin>'+methodMinXml+'</MethodMin>\n'+
                '<MethodAvg>'+methodAvgXml+'</MethodAvg>\n'+
                '<MethodMax>'+methodMaxXml+'</MethodMax>\n'
            ;
            
            return fs.writeFile$(reportFile, xmldata);
        }
    });
};
