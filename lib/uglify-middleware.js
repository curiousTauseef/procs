var fs       = require("fs")
    UglifyJS = require("uglify-js"),
    path     = require("path"),
    mime     = require('mime');

exports.middleware = function (options) {
  // One entry per file, with mtime
  var cache = buildCache();

  // Always build on the first run
  build();

  function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
  }

  function buildCache() {
    var files = [path.join(options.src, "source.order")].concat(orderedFiles());

    var cache = {};
    files.forEach(function (file) {
      var stat = fs.statSync(file);
      var mtime = stat.mtime;
      cache[file] = mtime.getTime();
    });
    return cache;
  }

  // Return true if changed, false if not
  function cacheChanged(old, latest) {
    var oldKeys = Object.keys(old);
    var latestKeys = Object.keys(latest);
    var changed = false;

    if (oldKeys.length !== latestKeys.length) changed = true;

    oldKeys.forEach(function (key) {
      if (latestKeys.indexOf(key) === -1) changed = true;
      if (old[key] !== latest[key]) changed = true;
    });

    return changed;
  }

  function build() {
    var files = orderedFiles();
    var minified = "";
    if (files.length) {
      var minified = UglifyJS.minify(files).code;
    }

    fs.writeFileSync(options.dest, minified);
  }

  function orderedFiles() {
    var files = fs.readFileSync(path.join(options.src, "source.order"), "utf-8").trim();
    if (files) {
      return files.split("\n").map(function (file) {
        return path.join(options.src, file + ".js");
      });
    } else {
      return [];
    }
  }

  // Middleware
  return function (req, res, next) {
    var requestFile = req.url;
    var fileMime = mime.lookup(requestFile);

    if (fileMime === "application/javascript" && endsWith(options.dest, requestFile)) {
      // Check and compile
      if (fs.existsSync(options.dest)) {
        var newCache = buildCache();
        if (cacheChanged(cache, newCache)) {
          cache = newCache;
          build();
        } else {
        }
      } else {
        build();
      }
    }

    next();
  }
}
