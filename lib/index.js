var domify = require('domify')
var events = require('events')
var Reactive = require('reactive')
var Tween = require('tween')
var doc = document.documentElement
var styles = require('computed-style')
var classes = require('classes')
var raf = require('raf')
var uid = require('uid')
var event = require('event')
var Emitter = require('emitter')
var detect = require('prop-detect')
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
  var parentNode
  if (Array.isArray(list.reactives)) {
    this.reactiveOpts = {}
    copy(this.reactiveOpts, {
      delegate: list.delegate,
      bindings: list.bindings,
      filters: list.filters
    })
    parentNode = list.parentNode
  } else {
    parentNode = list
  }
  this.selector = selector
  this.events = events(parentNode, this)
  this.docEvent = events(document, this)
  this.events.bind('touchstart ' + selector)
  this.events.bind('touchmove ' + selector)
  this.events.bind('touchend ' + selector)
  this.docEvent.bind('touchend')
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchstart = function (e) {
  var el = e.delegateTarget
  if (this.stat === 'reseting' || el === this.holder) return
  if (this.tween) this.tween.stop()
  // already moved
  var moved = this.x !== 0
  if (moved && el === this.swipeEl) return this.reset()
  if (moved) return this.reset('out-quad', 100)
  // do nothing if handled
  if (e.defaultPrevented) return
  var touch = this.getTouch(e)
  this.dx = 0
  this.ts = Date.now()
  this.clientX = touch.clientX
  this.down = {
    x: touch.clientX,
    y: touch.clientY,
    start: this.x,
    at: this.ts
  }
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
        this.reactive = new Reactive(templateEl, model, opts)
      } else {
        this.reactive.bind(model)
      }
    }
    this.min = - templateEl.clientWidth - 20
    this.emit('start', el)
  }
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchmove = function (e) {
  if (this.stat === 'reseting' || !this.down) return
  var touch = this.getTouch(e)
  var dx = touch.clientX - this.down.x
  var dy = touch.clientY - this.down.y
  // moving up and down
  if (Math.abs(dx/dy) < 1) return
  if (this.tween) this.tween.stop()
  if (this.onstart) this.onstart()
  this.moving = true
  var cx = touch.clientX
  this.clientX = this.clientX || cx
  //calculate speed every 100 milisecond
  this.calcuteSpeed(cx)
  var x = this.down.start + dx
  x = Math.min(0, x)
  x = Math.max(x, this.min)
  if (x !== 0) e.preventDefault()
  this.translate(x)
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchend = function (e) {
  this.onstart = null
  if (this.stat === 'reseting') return
  var target = e.delegateTarget
  if (target && isHolder(target)) return
  if (!this.down || !this.moving) return
  this.moving = false
  var touch = this.getTouch(e)
  this.calcuteSpeed(touch.clientX)
  var m = this.momentum()
  if (!m) return this.reset()
  if (!m.x) return this.reset(m.ease, m.duration)
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
    this.distance = x - this.clientX
    this.speed = Math.abs(this.distance/dt)
    this.ts = ts
    this.clientX = x
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
  this.stat = 'reseting'
  this.unbindEvents()
  this.emit('end', el)
  var self = this
  var promise = new Promise(function (resolve) {
    if (self.x === 0) {
      reset()
    } else {
      var promise = self.animate(0, ease, duration)
      promise.then(reset, reset)
    }
    function reset() {
      // restore to original stat
      classes(el).remove('swipe-dragging')
      // improve performance
      el.style[transform] = 'none'
      // wait
      var trans = holder.style[transition]
      var end = function () {
        if (trans) event.unbind(holder, transitionend, end)
        copy(el.style, self.orig)
        holder.parentNode.removeChild(holder)
        self.stat = self.holder = self.swipeEl = null
        resolve()
      }
      if (trans) {
        event.bind(holder, transitionend, end)
      } else {
        end()
      }
    }
  })
  return promise
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
  duration = duration || 350
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
 * Remove the swiped element and related holder with transition specified by `duration` (default 300) in millisecond and `ease` timing function
 *
 * @public
 * @param {Number} duration
 * @param {String} ease
 * @return {promise}
 */
SwipeIt.prototype.clear = function (duration, ease) {
  if (this.stat === 'reseting') return
  this.stat = 'reseting'
  var el = this.holder
  duration = duration || 300
  ease = ease || 'ease-out'
  var sel = this.swipeEl
  copy(sel.style, {
    transition: 'all ' + duration + 'ms ' + ease,
    transformOrigin: '0% 0%',
    webkitTransformOriginY: '0%',
    opacity: 0
  })
  var trans_prop = sel.style[transform]
  sel.style[transform] = trans_prop + ' rotateX(90deg)'
  el.style[transition] = 'height ' + duration + 'ms ' + ease
  this.down = null
  this.unbindEvents()
  this.emit('remove', sel)
  this.emit('end', sel)
  if (!el) return
  var self = this
  var promise = new Promise(function (resolve, reject) {
    var succeed
    var end = function () {
      event.unbind(el, transitionend, end)
      el.parentNode.removeChild(el)
      if (self.reactive) {
        self.reactive.model.remove()
      } else {
        sel.parentNode.removeChild(sel)
      }
      self.stat = self.holder = self.swipeEl = null
      self.x = 0
      succeed = true
      resolve()
    }
    setTimeout(function () {
      if (!succeed) {
        reject(new Error('Transitionend event not fired'))
        end()
      }
    }, duration)
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
    borderWidth: '0px',
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
    el = el.parentNode
    if (el === doc) return el
    var p = styles(el, 'position')
    if (p === 'absolute' || p === 'fixed' || p === 'relative') {
      return el
    }
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
