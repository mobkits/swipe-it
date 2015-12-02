var domify = require('domify')
var events = require('events')
var Reactive = require('reactive')
var Tween = require('tween')
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
var util = require('./util')

// max overlap 20px
var overlap = 20

/**
 * `template` string or element for element swiped out
 * `opts` optional options
 * `opts.ease` a ease function for reset&expand animation, default `out-quad`
 *
 * @param {String | Element} template
 * @param {Object} opts
 * @constructor
 * @public
 */
function SwipeIt(template, opts) {
  if (!(this instanceof SwipeIt)) return new SwipeIt(template, opts)
  this.opts = opts = opts || {}
  opts.ease = opts.ease || 'out-quad'
  this.handler = {}
  if (typeof template === 'string') {
    this.template = template
    this.templateEl = domify(template)
  } else {
    this.templateEl = template
    this.template = template.outerHTML
  }
  this.x = 0
  this._onresize = this.onresize.bind(this)
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
  this.list = list || this.list
  var parentNode
  if (list && Array.isArray(list.reactives)) {
    this.reactiveOpts = {}
    util.copy(this.reactiveOpts, {
      delegate: list.delegate,
      bindings: list.bindings,
      filters: list.filters
    })
    parentNode = list.parentNode
  } else if (list && list.nodeType === 1) {
    parentNode = list
  }
  this.selector = selector || this.selector
  if (!this.list) throw new Error('bind() expect a list argument')
  if (!this.selector) throw new Error('bind() expect a selector argument')
  this.events = events(parentNode, this)
  this.docEvent = events(document, this)
  this.events.bind('touchstart ' + selector)
  this.events.bind('touchmove ' + selector)
  this.events.bind('touchend ' + selector)
  this.events.bind('touchcancel', 'ontouchend')
  this.docEvent.bind('touchend')
  window.addEventListener('orientationchange', this._onresize, false)
  window.addEventListener('resize', this._onresize, false)
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchstart = function (e) {
  var el = e.delegateTarget
  if (this.stat === 'reseting' || classes(el).has('swipe-holder')) return
  if (this.tween) this.tween.stop()
  // already move
  var sel = this.swipeEl
  if (sel && el === sel) return this.reset()
  // faster to work with sortable
  if (sel) return this.reset('out-quad', 100)
  // do nothing if handled
  if (e.defaultPrevented) return
  var touch = util.getTouch(e)
  var sx = touch.clientX
  var sy = touch.clientY
  var start = this.x
  var at = Date.now()
  this.onstart = function (ev, cx, cy) {
    // only called once on move
    this.onstart = null
    // check direction
    var dx = cx - sx
    var dy = cy - sy
    if (dx === 0 && dy === 0) return
    if (Math.abs(dx/dy) < 1) return
    var target = ev.delegateTarget
    // not on the same element
    if (!target || target !== el) return
    ev.preventDefault()
    this.down = {x: sx, y: sy, start: start, at: at}
    // for speed calculate
    this.ts = at
    this.prevX = sx
    // show template and bind events
    var pel = util.getRelativeElement(el)
    var holder = this.holder = createHolder(el)
    this.swipeEl = el
    if (this.renderFn) {
      this.renderFn(holder)
    } else {
      holder.appendChild(this.templateEl)
    }
    var templateEl = this.templateEl
    util.copy(templateEl.style, {
      position: 'absolute',
      bottom: '0',
      right: '0'
    })
    templateEl.style.height = holder.style.height
    this.bindEvents(holder)
    this.orig = util.makeAbsolute(el, pel)
    classes(el).add('swipe-dragging')
    el.parentNode.insertBefore(holder, el)
    this.bindReactive(el, templateEl)
    this.min = - templateEl.clientWidth - overlap
    this.emit('start', el)
  }
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchmove = function (e) {
  if (this.stat === 'reseting') return
  if (this.onstart == null && this.down == null) return
  var touch = util.getTouch(e)
  var cx = touch.clientX
  var cy = touch.clientY
  if (this.onstart) return this.onstart(e, cx, cy)
  e.preventDefault()
  //calculate speed every 100 milisecond
  this.calculate(cx)
  var x = this.down.start + cx - this.down.x
  x = Math.min(0, x)
  x = Math.max(x, this.min)
  this.translate(x)
}

/**
 * @param  {Event}  e
 * @private
 */
SwipeIt.prototype.ontouchend = function (e) {
  this.onstart = null
  if (this.stat === 'reseting') return
  if (!this.down) return
  var target = e.delegateTarget
  var touch = util.getTouch(e)
  if (target && target !== this.holder) {
    this.calculate(touch.clientX)
    var m = this.momentum()
    if (!m || !m.x) return this.reset()
    this.animate(m.x, m.ease, m.duration).catch(function () {
    })
  } else {
    this.reset()
  }
  this.down = null
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
 * Calcute swipe speed and direction with clientX clientY
 *
 * @param {Number} x
 * @private
 */
SwipeIt.prototype.calculate = function (x) {
  var dt = this.down.at
  var now = Date.now()
  var duration = now - this.ts
  if (now - dt > 100 && duration < 100) return
  this.distance = x - this.prevX
  this.speed = Math.abs(this.distance/duration)
  if(duration > 100){
    this.ts = now
    this.prevX = x
  }
}

SwipeIt.prototype.momentum = function () {
  var x = this.x
  var deceleration = 0.0004
  var speed = Math.min(this.speed, 0.3)
  var minX = this.min + overlap
  var destination = x + ( speed * speed ) / ( 2 * deceleration ) * ( this.distance < 0 ? -1 : 1 )
  var moveSpeed = 0.1
  var ease = this.opts.ease
  var duration
  // already shown
  if (x < minX) {
    destination = minX
    duration = (minX - x)/moveSpeed
  // should be shown
  } else if (destination < minX/2) {
    destination = minX
    if (x > minX && speed >= 0.3) {
      ease = util.getOutBack(x - minX, overlap)
      duration = (x - minX + 2*overlap)/Math.max(speed, 0.15)
    } else {
      duration = 2*Math.abs(destination - x)/Math.max(speed, 0.4)
    }
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
  if (!this.swipeEl) return
  var s = this.swipeEl.style
  if (has3d) {
    s[transform] = 'translate3d(' + x + 'px, 0, 0)'
  } else {
    s[transform] = 'translateX(' + x + 'px)'
  }

  this.x = x
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
  var holder = this.holder
  var el = this.swipeEl
  if (!el || !holder) return
  this.stat = 'reseting'
  this.down = null
  this.unbindEvents()
  var self = this
  var promise = new Promise(function (resolve) {
    var promise = self.animate(0, ease, duration)
    promise.then(reset, reset)
    function reset() {
      // wait for sortable
      var trans = holder.style[transition]
      var succeed
      var end = function () {
        if (trans) event.unbind(holder, transitionend, end)
        // restore to original stat
        classes(el).remove('swipe-dragging')
        // improve performance
        el.style[transform] = 'none'
        util.copy(el.style, self.orig)
        holder.parentNode.removeChild(holder)
        self.stat = self.holder = self.swipeEl = null
        self.x = 0
        self.emit('end', el)
        succeed = true
        resolve()
      }
      // make sure called
      setTimeout(function () {
        if (!succeed) end()
      }, 300)
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
  if (x == this.x) return Promise.resolve(null)
  ease = ease || this.opts.ease
  if (!duration && typeof ease === 'string'&& /back/.test(ease)){
    duration = 500
  } else {
    duration = duration || 350
  }
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
      self.tween = null
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
  if (this.stat === 'reseting') return Promise.reject(new Error('clear() should not get called when reseting'))
  var el = this.holder
  var sel = this.swipeEl
  if (!el || !sel) return Promise.resolve(null)
  this.stat = 'reseting'
  this.down = null
  this.unbindEvents()
  duration = duration || 300
  ease = ease || 'ease-out'
  util.copy(sel.style, {
    transition: 'all ' + duration + 'ms ' + ease,
    transformOrigin: '0% 0%',
    webkitTransformOriginY: '0%',
    opacity: 0
  })
  var trans_prop = sel.style[transform]
  sel.style[transform] = trans_prop + ' rotateX(90deg)'
  el.style[transition] = 'height ' + duration + 'ms ' + ease
  this.emit('clear', sel)
  var self = this
  var promise = new Promise(function (resolve) {
    var succeed
    var end = function () {
      event.unbind(el, transitionend, end)
      if (el.parentNode) el.parentNode.removeChild(el)
      if (self.reactive) {
        self.reactive.model.remove()
      } else if(sel.parentNode) {
        sel.parentNode.removeChild(sel)
      }
      self.emit('end', sel)
      self.stat = self.holder = self.swipeEl = null
      self.x = 0
      succeed = true
      resolve()
    }
    setTimeout(function () {
      if (!succeed) end()
      resolve()
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
  window.addEventListener('orientationchange', this._onresize, false)
  window.addEventListener('resize', this._onresize, false)
  if (this.reactive) this.reactive.remove()
}

/**
 * window resize handler
 *
 * @private
 */
SwipeIt.prototype.onresize = function () {
  var el = this.swipeEl
  if (!el) return
  var holder = this.holder
  var pel = util.getRelativeElement(holder)
  var pos = util.getAbsolutePosition(holder, pel)
  util.copy(el.style, {
    height: pos.height + 'px',
    width: pos.width + 'px',
    left: pos.left + 'px',
    top: pos.top + 'px'
  })
}

SwipeIt.prototype.bindReactive = function (el, templateEl) {
  var opts = this.reactiveOpts
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
}

function createHolder(el) {
  var node = el.cloneNode(false)
  node.removeAttribute('id')
  classes(node).add('swipe-holder')
  var styleObj = getComputedStyle(el)
  var bh = parseInt(styleObj['border-top-width'], 10) + parseInt(styleObj['border-bottom-width'], 10)
  var w = el.style.width
  util.copy(node.style, {
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

module.exports = SwipeIt
