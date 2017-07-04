// TODO: replace gulp-shelter with a tool that places scripts directly
// in package.json
const gulp = require('gulp');
const shelter = require('gulp-shelter')(gulp);
const scripts = require('./scripts');

shelter(scripts);
