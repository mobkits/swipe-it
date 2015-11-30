var domify = require('domify')
var events = require('events')
var reactive = require('reactive')
var Tween = require('tween')
var doc = document.documentElement
var styles = require('computed-style')
var classes = require('classes')
var raf = require('raf')
var uid = require('uid')
var event = require('event')
var detect = require('prop-detect')
var Emitter = require('emitter')
var transform = detect.transform
var transition = detect.transition
var transitionend = detect.transitionend
var has3d = detect.has3d

/**
 * `template` string or element for element swiped out
 *
 * @param {String | Element} template
 * @constructor
 * @public
 */
function SwipeIt(template) {
  if (!(this instanceof SwipeIt)) return new SwipeIt(template)
  this.handler = {}
  if (typeof template === 'string') {
    this.template = template
    this.templateEl = domify(template)
  } else {
    this.templateEl = template
    this.template = template.outerHTML
  }
  copy(this.templateEl.style, {
    position: 'absolute',
    bottom: '0',
    right: '0'
  })
  this.x = 0
}

Emitter(SwipeIt.prototype)

/**
 * Bind swipe event to parentNode or ListRender with delegated selector
 *
 * @public
 * @param {Element | ListRender} list
 * @param {String} selector
 * @return {undefined}
 */
SwipeIt.prototype.bind = function (list, selector) {
  this.list = list
  if (Array.isArray(list.reactives)) {
    this.reactiveOpts = {}
    copy(this.reactiveOpts, {
      delegate: list.delegate,
      bindings: list.bindings,
      filters: list.filters
    })
  }
  this.selector = selector
  this.events = events(list, this)
  this.docEvent = events(document, this)
  this.events.bind('touchstart ' + selector)
  this.events.bind('touchmove ' + selector)
  this.docEvent.bind('touchend ' + selector)
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchstart = function (e) {
  if (this.stat === 'reseting') return
  if (this.tween) this.tween.stop()
  var el = e.delegateTarget
  if (isHolder(el)) return
  var touch = this.getTouch(e)
  this.dx = 0
  this.ts = Date.now()
  this.pageX = touch.pageX
  this.down = {
    x: touch.pageX,
    y: touch.pageY,
    start: this.x,
    at: this.ts
  }
  // already moved
  if (this.x !== 0 && this.swipeEl === el) return
  // another element have moved
  if (this.x !== 0) return this.reset()
  this.swipeEl = el
  this.onstart = function () {
    // only called once on move
    this.onstart = null
    // show template and bind events
    var pel = getRelativeElement(el)
    var holder = this.holder = createHolder(el)
    var templateEl = this.templateEl
    templateEl.style.height = holder.style.height
    var opts = this.reactiveOpts
    if (this.renderFn) {
      this.renderFn(holder)
    } else {
      holder.appendChild(templateEl)
    }
    this.bindEvents(holder)
    this.orig = makeAbsolute(el, pel)
    classes(el).add('swipe-dragging')
    el.parentNode.insertBefore(holder, el)
    if (opts) {
      // bind reactive
      var model = this.list.findModel(el)
      if (!model) throw new Error('no model find at ListRender with [' + el.outerHTML + ']')
      if (!this.reactive) {
        this.reactive = reactive(templateEl, model, opts)
      } else {
        this.reactive.bind(model)
      }
    }
    this.emit('start', el)
  }
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchmove = function (e) {
  if (isHolder(e.delegateTarget)) return
  if (this.stat === 'reseting') return
  if (!this.down) return
  e.preventDefault()
  var touch = this.getTouch(e)
  var dx = touch.pageX - this.down.x
  var dy = touch.pageY - this.down.y
  // moving up and down
  if (Math.abs(dx/dy) < 1) return
  if (this.tween) this.tween.stop()
  if (this.onstart) this.onstart()
  this.moving = true
  if (!this.pageX) this.pageX = touch.pageX
  //calculate speed every 100 milisecond
  this.calcuteSpeed(touch.pageX)
  var x = this.down.start + dx
  var w = this.templateEl.clientWidth
  x = Math.min(0, x)
  x = Math.max(x, -w - 15)
  this.translate(x)
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchend = function (e) {
  if (isHolder(e.delegateTarget)) return
  if (this.stat === 'reseting') return
  if (!this.down || !this.moving) return
  var touch = this.getTouch(e)
  this.calcuteSpeed(touch.pageX)
  var m = this.momentum()
  this.moving = false
  if (!m) return this.reset()
  if (!m.x || m.x === 0) return this.reset(m.ease, m.duration)
  this.down = null
  this.animate(m.x, m.ease, m.duration).catch(function () {
  })
}

/**
 * Set a custom render function
 *
 * @public
 * @param  {Function}  fn
 * @return {undefined}
 */
SwipeIt.prototype.render = function (fn) {
  var self = this
  this.renderFn = function (parentNode) {
    var el = self.templateEl = fn(self.swipeEl, self.template)
    parentNode.appendChild(el)
  }
}

/**
 * Delegate `handler` of `type` event with matched `selector` within swiped out element, handler is called with original event and relatived swiped element.
 *
 * @public
 * @param {String} type
 * @param {String} selector
 * @param {Function} handler
 */
SwipeIt.prototype.delegate = function (type, selector, handler) {
  var str = type + ' ' + selector
  // allow mulitiply handler for same event
  var id = str + ' $' + uid(5)
  var self = this
  this.handler[id] = function (e) {
    handler.call(self.swipeEl, e, self.swipeEl)
  }
}


/**
 * Bind events to holder
 *
 * @param {Element} holder
 */
SwipeIt.prototype.bindEvents = function (holder) {
  this.holderEvents = events(holder, this.handler)
  Object.keys(this.handler).forEach(function (key) {
    var str = key.replace(/\s\$[\w-]{5}$/, '')
    this.holderEvents.bind(str, key)
  }, this)
}

/**
 * Unbind events of holder
 *
 * @param {Element} holder
 */
SwipeIt.prototype.unbindEvents = function () {
  if (this.holderEvents) this.holderEvents.unbind()
  this.holderEvents = null
}

/**
 * Calcute swipe speed with translateX
 *
 * @param {Number} x
 * @private
 */
SwipeIt.prototype.calcuteSpeed = function (x) {
  var ts = Date.now()
  var dt = ts - this.ts
  if (ts - this.down.at < 100) {
    this.distance = x - this.down.x
    this.speed = Math.abs(this.distance/dt)
  } else if(dt > 100){
    this.distance = x - this.pageX
    this.speed = Math.abs(this.distance/dt)
    this.ts = ts
    this.pageX = x
  }
}

SwipeIt.prototype.momentum = function () {
  var x = this.x
  var deceleration = 0.0004
  var speed = Math.min(this.speed, 0.8)
  var minX = - this.templateEl.getBoundingClientRect().width
  var destination = x + ( speed * speed ) / ( 2 * deceleration ) * ( this.distance < 0 ? -1 : 1 )
  var moveSpeed = 0.1
  var ease = 'out-quad'
  var duration
  // already shown
  if (x < minX) {
    destination = minX
    duration = (minX - x)/moveSpeed
  // should be shown
  } else if (destination < minX/2) {
    destination = minX
    duration = 2*Math.abs(destination - x)/Math.max(speed, 0.4)
  // should not shown
  } else {
    destination = 0
    duration = -x/moveSpeed
  }
  return {
    x: destination,
    duration: duration,
    ease: ease
  }
}

/**
 * Translate template element
 *
 * @private
 * @param {Number} x
 */
SwipeIt.prototype.translate = function (x) {
  var s = this.swipeEl.style
  if (has3d) {
    s[transform] = 'translate3d(' + x + 'px, 0, 0)'
  } else {
    s[transform] = 'translateX(' + x + 'px)'
  }

  this.x = x
}

/**
 * Get touch Object
 *
 * @private
 * @param  {Event}  e
 */
SwipeIt.prototype.getTouch = function (e) {
  if (e.changedTouches && e.changedTouches.length > 0) {
    return e.changedTouches[0]
  }
  return e
}

/**
 * Reset element to original stat with optional ease and duration
 *
 * @public
 * @param {String} ease optional ease
 * @param {Number} duration optional duration
 */
SwipeIt.prototype.reset = function (ease, duration) {
  if (this.stat === 'reseting') return
  this.down = null
  var holder = this.holder
  var el = this.swipeEl
  if (!el || !holder) return
  this.unbindEvents()
  this.emit('end', el)
  this.stat = 'reseting'
  if (this.x === 0) {
    reset.call(this)
  } else {
    var promise = this.animate(0, ease, duration)
    promise.then(reset.bind(this), reset.bind(this))
  }
  function reset() {
    // restore to original stat
    holder.parentNode.removeChild(holder)
    classes(el).remove('swipe-dragging')
    copy(el.style, this.orig)
    // improve performance
    el.style[transform] = 'none'
    this.holder = this.swipeEl = null
    this.stat = null
  }
}

/**
 * Transform swipe el with animation
 *
 * @param {Number} x
 * @param {String} ease
 * @param {Number} duration
 * @return {Promise}
 */
SwipeIt.prototype.animate = function (x, ease, duration) {
  ease = ease || 'out-quad'
  duration = duration || 300
  var tween = this.tween = Tween({x : this.x})
  .ease(ease)
  .to({x : x})
  .duration(duration)

  var self = this
  tween.update(function(o){
    self.translate(o.x)
  })

  var promise = new Promise(function (resolve, reject) {
    var rejected
    tween.on('stop', function () {
      rejected = true
      reject()
    })
    tween.on('end', function(){
      self.tween = null
      animate = function(){} // eslint-disable-line
      if (!rejected) resolve()
    })
  })

  function animate() {
    raf(animate)
    tween.update()
  }

  animate()
  return promise
}

/**
 * Remove holder element with transtion
 *
 * @public
 * @param {Number} duration
 * @param {String} ease
 * @return {promise}
 */
SwipeIt.prototype.removeHolder = function (duration, ease) {
  if (this.stat === 'reseting') return
  var el = this.holder
  duration = duration || '300ms'
  ease = ease || 'ease-out'
  el.style[transition] = 'height ' + duration + ' ' + ease
  this.down = null
  this.unbindEvents()
  this.emit('end', this.swipeEl)
  if (!el) return
  var self = this
  var promise = new Promise(function (resolve) {
    var end = function () {
      event.unbind(el, transitionend, end)
      el.parentNode.removeChild(el)
      self.holder = self.swipeEl = null
      self.x = 0
      resolve()
    }
    event.bind(el, transitionend, end)
    el.style.height = '0px'
  })
  return promise
}

/**
 * Unbind all events
 *
 * @public
 * @return {undefined}
 */
SwipeIt.prototype.unbind = function () {
  this.unbindEvents()
  this.events.unbind()
  this.docEvent.unbind()
  if (this.reactive) this.reactive.remove()
}

function isHolder(el) {
  return classes(el).has('swipe-holder')
}

function createHolder(el) {
  var node = el.cloneNode(false)
  node.removeAttribute('id')
  classes(node).add('swipe-holder')
  var styleObj = getComputedStyle(el)
  var bh = parseInt(styleObj['border-top-width'], 10) + parseInt(styleObj['border-bottom-width'], 10)
  var w = el.style.width
  copy(node.style, {
    overflow: 'hidden',
    zIndex: 0,
    transform: 'none',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0)',
    height: (el.clientHeight + bh) + 'px',
    width: w
  })
  if (w) node.style.width = w
  return node
}

/**
 * Make an element absolute, return origin props
 *
 * @param  {Element}  el
 * @param {Element} pel
 * @return {Object}
 */
function makeAbsolute(el, pel) {
  var pos = getAbsolutePosition(el, pel)
  var orig = copy(el.style, {
    zIndex: 999,
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
 * Get absolute left top width height
 *
 * @param  {Element}  el
 * @param {Element} pel
 * @return {Object}
 * @api public
 */
function getAbsolutePosition(el, pel) {
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
 * Get relative element of el
 *
 * @param  {Element}  el
 * @return {Element}
 */
function getRelativeElement (el) {
  do {
    if (el === doc) return el
    var p = styles(el, 'position')
    if (p === 'absolute' || p === 'fixed' || p === 'relative') {
      return p
    }
    el = el.parentNode
  } while(el)
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
function copy (to, from) {
  var orig = {}
  Object.keys(from).forEach(function (k) {
    orig[k] = to[k]
    to[k] = from[k]
  })
  return orig
}

module.exports = SwipeIt