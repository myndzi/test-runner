'use strict';

var errors = require('errors');

errors.create({
    name: 'AbortTestsError',
    defaultMessage: 'Test run aborted due to a failure',
    scope: module.exports
});
