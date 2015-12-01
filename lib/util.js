var doc = document.documentElement

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
var copy = exports.copy = function (to, from) {
  var orig = {}
  Object.keys(from).forEach(function (k) {
    orig[k] = to[k]
    to[k] = from[k]
  })
  return orig
}

 
/**
 * Get relative element of el
 *
 * @param  {Element}  el
 * @return {Element}
 */
exports.getRelativeElement = function (el) {
  do {
    el = el.parentNode
    if (el === doc) return el
    var p = getComputedStyle(el).position
    if (p === 'absolute' || p === 'fixed' || p === 'relative') {
      return el
    }
  } while(el)
}

/**
 * Get absolute left top width height
 *
 * @param  {Element}  el
 * @param {Element} pel
 * @return {Object}
 * @api public
 */
var getAbsolutePosition = exports.getAbsolutePosition = function (el, pel) {
  var r = el.getBoundingClientRect()
  var rect = pel.getBoundingClientRect()
  return {
    left: r.left - rect.left,
    top: r.top -rect.top,
    width: r.width || el.offsetWidth,
    height: r.height || el.offsetHeight
  }
}

/**
 * Make an element absolute, return origin props
 *
 * @param  {Element}  el
 * @param {Element} pel
 * @return {Object}
 */
exports.makeAbsolute = function (el, pel) {
  var pos = getAbsolutePosition(el, pel)
  var orig = copy(el.style, {
    height: pos.height + 'px',
    width: pos.width + 'px',
    left: pos.left + 'px',
    top: pos.top + 'px',
    position: 'absolute',
    float: 'none'
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

