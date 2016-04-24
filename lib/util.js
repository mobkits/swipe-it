exports.getOutBack = function (dis, overlap) {
  var b = (dis + overlap)/dis
  return function (n) {
    var m = 0.75
    var a = b/(m * m)
    if (n <= m) {
      return -a *(n - m)*(n - m) + b
    }
    return b - (n - m)*(b - 1)/(1 - m)
  }
}

/**
 * Copy props from from to to
 * return original props
 *
 * @param {Object} to
 * @param {Object} from
 * @return {Object}
 * @api public
 */
exports.copy = function (to, from) {
  var orig = {}
  Object.keys(from).forEach(function (k) {
    orig[k] = to[k]
    to[k] = from[k]
  })
  return orig
}

/**
 * Get touch Object
 *
 * @private
 * @param  {Event}  e
 */
exports.getTouch = function (e) {
  if (e.changedTouches && e.changedTouches.length > 0) {
    return e.changedTouches[0]
  }
  return e
}

