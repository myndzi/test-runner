# Test-runner

It runs tests. And stuff.

# Usage

    npm install --save-dev @eros/test-runner

package.json:

    "scripts": {
        "test": "test-runner"
    }

Run tests:

    npm test [filters] [-- --switches]

# Command line arguments

Most of these will be explained further below.

- `-q` `--quiet` - sets log level to 'none'
- `-v` `--verbose` - sets log level to 'debug'
- `-V` `--trace` - sets log level to 'trace'
- `-r` `--do-report` - enables report output
- `-c` `--do-cov` - enables coverage report
- `-l` `--do-lint` - enables jshint
- `-P` `--perf-only` - do a performance test only, no unit tests, etc.
- `-L` `--lint-only` - run jshint only, no unit tests, etc.
- `--spec` - use spec reporter
- `--color` - enable color
- `--bail` - stop running tests after first error
- `--base-dir` - specify the app base dir
- `--report-dir` - specify the report dir

Any of the boolean switches can be negated by prefixing with `no-`, for example, `--no-color` will disable color output. Single-letter arguments can be crammed together in typical Linux fashion, e.g. `-rpc`

### Note:
Since npm can accept arguments itself, it is necessary to distinguish between 'arguments to be given to npm' and 'arguments to be given to test-runner' when using npm to run tests. The usual way to do that sort of thing in Linux is to separate the arguments with `--`

Therefore, if you wanted to use the `npm test` approach (and you do, because it's the only helpful way to run a local module without specifying a full path to its binary script!), you must do it like this when specifying switches:

    npm test -- -rpc --report-dir=./foo

Thankfully this is not necessy for using filters:

    npm test services

The above works just fine. **npm >= 2.0 is required for this behavior**

### Note:
Log level defaults to 'warn'; log level is passed on to all subtasks

# Configuration

There are some defaults but they're not that useful. You'll likely want to create `./test/.runner.json`; this file configures a few things about where the tests are and where the code is. The current configuration keys are:

- `preload` - a `.js` file to load and execute before running any tests
- `unload` - a `.js` file to load and execute after running all tests
- `perfTest` - a `.js` file to load and execute to run a performance test
- `soureDirs` - an array of strings relative to `<appRoot>` for directories that contain source code to instrument for coverage and to lint
- `testDirs` - an ordered array of strings relative to `<appRoot>/test` for directories that contain tests to run
- `subModules` - an array of module names to also run tests on, if possible

### Note:
`preload` and `unload` scripts should export a function like so:

    module.exports = function () {
    };

The `perfTest` script should export a function, and is passed a couple arguments like so:

    module.exports = function (baseDir, opts) {
    };

Where `baseDir` is the application base dir (not the test dir), and `opts` may contain `logLevel` (a log level threshold), `doReport` (a boolean, whether to write a report), and `reportDir` (a string, where to write the report to). 

`perfTest` should return a promise that resolves when the test is complete and the report has been written.

# Test ordering

By default, tests exit early at the first failure. Tests are run in the order of the `testDirs` specified in the config file. Ideally, the fastest tests (e.g. unit tests) come first and the slowest tests (e.g. integration tests) come last; this enables the test run to fail as fast as possible in the case of failure.

If `subModules` is specified, these tests are run prior to the above. This enables simultaneous development of packages that depend on other packages. `test-runner` will look for `.runner.json` in these other packages' own `test` directories to determine what to do. If submodule tests fail, the process will exit before running *any* tests of the module proper.

# Filtering

To further aid in easily targeting and running specific tests, `test-runner` implements a filtering system that enables you to run selected subsets of your tests; this is useful for example when you are trying to make a specific test pass and running the entire suite takes a while. To use filtering, simply supply keywords to filter by as arguments:

    npm test foo
    npm test foo bar baz

Specified filters are intersected -- only tests matching *all* specified filters will be run.

Filtering is a two-step process involving test *location* and test *filename*. All the given filters are compared against submodule names and test directory names first; matches will confine the tests being run to those locations. Any remaining filters are used to filter out specific files by matching against `.`-separated tokens in the filename.

To give a concrete example, `npm test unit` would load all test files in the `./test/unit` directory, provided it exists and is specified as a `testDir` in the config. Similarly, `npm test logger` would run against the `logger` submodule, provided it was specified in the `subModules` key of the config, existed (was installed into `node_modules`), and contained a `test` directory (possibly with its own `.runner.json` config file).

Filename-wise, `npm test services locations` would load all tests in the file `./test/services/locations.test.js` but ignore `./test/unit/locations.test.js` and `./test/services/categories.test.js`

It's a bit complicated to explain, but simple to use; in practice, just include enough keywords to target what you want. You can cross-cut your test directories and target a specific group of functionality to run unit and integration tests, or you can target just unit tests for everything, or just integration tests, and so on.

# Reporting

By default, no reports are created. If reporting is enabled, an xUnit compatible xml file is created for the results of the tests and a Cobertura compatible xml file is created for the results of the coverage tests.

Performance test results are up to the specified performance test module to create; `sites-backend` creates xml files that are usable by the Jenkins Plot plugin.

# Programmatic use

    var Runner = require('test-runner');
    var runner = new Runner(opts, baseDir);
    runner.run().then(...).catch(...);

`opts` are mostly as the command line switches, but are camelCased (`--do-cov` -> `doCov`). You can pass subtask-specific options here, too:

    var runner = new Runner({
        mocha: {
            logLevel: 'trace',
            doReport: false
        },
        perf: {
            logLevel: 'none',
            doReport: true
        }
    });

Valid subtasks are 'mocha', 'coverage', 'perf', and 'lint'