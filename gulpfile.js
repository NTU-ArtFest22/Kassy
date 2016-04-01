var gulp = require('gulp'),
  livereload = require('gulp-livereload'),
  nodemon = require('gulp-nodemon'),
  watch = require('gulp-watch');

gulp.task('default', function() {
  nodemon('main.js debug facebook');
});