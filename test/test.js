/*global describe, it, before, after, beforeEach, afterEach*/
var expect = require('expect')
var SwipeIt = require('..')
var domify = require('domify')
var TouchSimulate = require('touch-simulate')
var List = require('mobile-list')
var Iscroll = require('iscroll')
var tap = require('tap-event')
var event = require('event')

function assign(to, from) {
  Object.keys(from).forEach(function (k) {
    to[k] = from[k]
  })
  return to
}


function createList() {
  var ul = document.createElement('ul')
  assign(ul.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '200px'
  })
  for (var i = 1; i < 5; i ++) {
    var li = document.createElement('li')
    assign(li.style, {
      height: '30px',
      listStyle: 'none'
    })
    li.textContent = i
    ul.appendChild(li)
  }
  document.body.appendChild(ul)
  return ul
}

describe('init', function() {
  var template = '<div>remove</div>'

  it('should init with template only', function () {
    var s = new SwipeIt(template)
    expect(s.template).toBe(template)
  })

  it('should init with template and option', function () {
    var s = new SwipeIt(template, {
      ease: 'out-back'
    })
    expect(s.opts.ease).toBe('out-back')
  })

  it('should init without new', function () {
    var s = SwipeIt(template, {ease: 'out-back'})
    expect(s.template).toBe(template)
    expect(s.opts.ease).toBe('out-back')
  })

  it('should init with element as template', function () {
    var s = SwipeIt(domify(template))
    expect(s.template).toBe(template)
  })
})

describe('.bind(list, selector)', function() {
  var template = '<div>remove</div>'

  it('should throw if no list provide', function () {
    var s = SwipeIt(domify(template))
    expect(function(){
      s.bind()
    }).toThrow(/list/)
  })

  it('should throw if no selector provide', function () {
    var s = SwipeIt(domify(template))
    var list = document.createElement('div')
    expect(function(){
      s.bind(list)
    }).toThrow(/selector/)
  })

  it('should throw if bind list invalid', function () {
    var s = SwipeIt(domify(template))
    expect(function(){
      s.bind('invalid', 'li')
    }).toThrow(/invalid/)
  })
})

describe('.render(fn)', function() {
  this.timeout(5000)
  it('should support render function', function () {
    var template = '<div class="remove" style="width:70px;">remove {index}</div>'
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    s.render(function (sel, template) {
      var index = parseInt(sel.textContent.trim(), 10)
      return domify(template.replace(/\{index\}/, index))
    })
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(35).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      var index = s.swipeEl.textContent.trim()
      expect(el.textContent).toBe('remove ' + index)
      list.parentNode.removeChild(list)
    })
  })

})

describe('.delegate(type, selector, handler)', function() {
  this.timeout(3000)

  it('should delegate event', function () {
    var template = '<div class="remove" style="width:70px;">remove</div>'
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var fired
    s.delegate('touchstart', '.remove', tap(function () {
      fired = true
    }))
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      var t = new TouchSimulate(el)
      return t.tap().then(function () {
        expect(fired).toBe(true)
        list.parentNode.removeChild(list)
      })
    })
  })

  it('should delegate event with same type and selector', function () {
    var template = '<div class="remove" style="width:70px;">remove</div>'
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var count = 0
    s.delegate('click', '.remove', function () {
      count++
    })
    s.delegate('click', '.remove', function () {
      count++
    })
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(10).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      el.click()
      expect(count).toBe(2)
      list.parentNode.removeChild(list)
    })
  })
})

describe('bind element', function() {
  this.timeout(3000)
  var scrollable
  var list
  var swipe
  var first

  function append(ul, n) {
    for (var i = 0; i < n; i ++) {
      var li = document.createElement('li')
      assign(li.style, {
        lineHeight: '30px',
        height: '30px'
      })
      var index = ul.children.length + 1
      li.textContent = index
      ul.appendChild(li)
    }
  }

  before(function () {
    scrollable = document.createElement('div')
    document.body.appendChild(scrollable)
    assign(scrollable.style, {
      position: 'fixed',
      top: '50px',
      left: '50px',
      width: '100px',
      height: '150px',
      overflow: 'hidden'
    })
    var wrapper = document.createElement('div')
    scrollable.appendChild(wrapper)
    list = document.createElement('ul')
    wrapper.appendChild(list)
    assign(list.style, {
      padding: '0px',
      margin: '0px',
      listStyle: 'none'
    })
    append(list, 10)
    var template = '<div style="width:70px;"><span class="remove">x</span></div>'
    swipe = new SwipeIt(template)
    swipe.bind(list, 'li')
    first = list.querySelector('li:first-child')
  })

  after(function () {
    document.body.removeChild(scrollable)
  })


  it('should swipe out when destination reach half', function () {
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(10).wait(200).then(function () {
      expect(swipe.swipeEl).toExist()
      expect(swipe.holder).toExist()
      var el = swipe.parentNode.querySelector('.remove')
      expect(el).toExist()
    })
  })

  it('should reset when touch swiped element again', function () {
    var touch = new TouchSimulate(first)
    touch.start()
    expect(swipe.stat).toBe('reseting')
    return touch.wait(500).then(function () {
      expect(swipe.swipeEl).toNotExist()
      expect(swipe.holder).toNotExist()
      var el = swipe.parentNode.querySelector('.remove')
      expect(el).toNotExist()
    })
  })

  it('should reset when call reset function', function () {
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(40).wait(400).then(function () {
      var p = swipe.reset()
      expect(swipe.stat).toBe('reseting')
      return p.then(function () {
        expect(swipe.x).toBe(0)
        expect(swipe.stat).toNotExist()
        expect(swipe.holder).toNotExist()
        expect(swipe.swipeEl).toNotExist()
      })
    })
  })

  it('should fast reset when touch another element', function () {
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return swipe.reset().then(function () {
      return touch.start().moveLeft(40).wait(400).then(function () {
        var el = swipe.parentNode.querySelector('li:last-child')
        expect(el).toNotBe(first)
        var t = new TouchSimulate(el)
        return t.start().wait(200).then(function () {
          expect(swipe.swipeEl).toNotExist()
          expect(swipe.holder).toNotExist()
          var el = swipe.parentNode.querySelector('.remove')
          expect(el).toNotExist()
        })
      })
    })
  })

  it('should not swipe out when destination not reach half', function (done) {
    return swipe.reset().then(function () {
      var touch = new TouchSimulate(first)
      // low speed
      touch.speed(20)
      touch.start().moveLeft(5)
      swipe.once('end', function () {
        expect(swipe.swipeEl).toNotExist()
        expect(swipe.holder).toNotExist()
        var el = swipe.parentNode.querySelector('.remove')
        expect(el).toNotExist()
        done()
      })
    })
  })

  it('should not reset when tap element from template', function () {
    return swipe.reset().then(function () {
      var touch = new TouchSimulate(first)
      touch.speed(200)
      return touch.start().moveLeft(30).wait(500).then(function () {
        var el = swipe.parentNode.querySelector('.remove')
        expect(el).toExist()
        var t = new TouchSimulate(el)
        return t.tap().then(function () {
          expect(swipe.stat).toNotBe('reseting')
          expect(swipe.x).toNotBe(0)
          expect(swipe.holder).toExist()
        })
      })
    })
  })

  it('should able to tap swipe element when it\'s not swiped out', function () {
    return swipe.reset().then(function () {
      var t = new TouchSimulate(first)
      var fired
      var ontap = tap(function () {
        fired = true
      })
      event.bind(first, 'touchstart', ontap)
      return t.tap().then(function () {
        event.unbind(first, 'touchstart', ontap)
        expect(fired).toBe(true)
        var el = swipe.parentNode.querySelector('.remove')
        expect(el).toNotExist()
      })
    })
  })

  it('should not prevent scroll when moving up and down', function () {
     new Iscroll(scrollable)
    var count = 0
    var onscroll = function () {
      count++
    }
    var li = swipe.parentNode.querySelector('li:nth-child(3)')
    var t = new TouchSimulate(li)
    event.bind(scrollable, 'scroll', onscroll)
    return swipe.reset().then(function () {
      return t.start().moveUp(50).then(function () {
        expect(count).toBeGreaterThan(10)
      })
    })
  })
})

describe('.clear()', function() {
  var template = '<div class="remove" style="width:30px;">x</div>'

  it('should not throw when no swiped element', function () {
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    return s.clear().then(function (res) {
      expect(res).toNotExist()
      list.parentNode.removeChild(list)
    })
  })

  it('should reject when reset not finished', function (done) {
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(350)
    touch.start().moveLeft(20).wait(200).then(function () {
      var el = list.querySelector('.remove')
      var err
      expect(el).toExist()
      s.reset().then(function () {
        expect(err).toExist()
        list.parentNode.removeChild(list)
        done()
      })
      expect(s.stat).toBe('reseting')
      s.clear().catch(function (e) {
        err = e
      })
    })
  })

  it('should emit clear and end when clear', function () {
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(35).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      var count = 0
      s.on('clear', function (el) {
        expect(el).toBe(first)
        count++
      })
      s.on('end', function () {
        count++
      })
      return s.clear().then(function () {
        expect(count).toBe(2)
        list.parentNode.removeChild(list)
      })
    })
  })

  it('should reset stat and remove swiped element', function () {
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(35).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      return s.clear().then(function () {
        expect(s.stat).toNotExist()
        expect(first.parentNode).toNotExist()
        list.parentNode.removeChild(list)
      })
    })
  })
})

describe('.unbind()', function() {
  it('should unbind events', function () {
    var list = createList()
    var template = '<div class="remove" style="width:30px;">x</div>'
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    s.unbind()
    return touch.start().moveLeft(35).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toNotExist()
      list.parentNode.removeChild(list)
    })
  })

  it('should bind events when call bind again', function () {
    var list = createList()
    var template = '<div class="remove" style="width:30px;">x</div>'
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    s.unbind()
    s.bind(list, 'li')
    return touch.start().moveLeft(35).wait(200).then(function () {
      var el = list.querySelector('.remove')
      expect(el).toExist()
      list.parentNode.removeChild(list)
    })
  })
})

describe('bind mobile-list', function() {
  var data = [{
    index: 1,
    language: 'javascript'
  }, {
    index: 2,
    language: 'Ruby'
  }]

  var tmpl = '<li>{language}</li>'
  var colors = ['tomato', 'gold', 'lightgreen', 'deepskyblue', 'orange', 'violet']
  var ul = document.createElement('ul')
  ul.id = 'mobile-list'
  document.body.appendChild(ul)
  var s
  it('should render the template', function () {
    var list = new List(tmpl, window, {
      selector: '#mobile-list',
      delegate: {
        remove: tap(function () {
          s.clear()
        })
      },
      bindings: {
        'data-color': function (prop) {
          this.bind(prop, function (model, el) {
            var color = colors[model[prop] - 1]
            el.style.backgroundColor = color
          })
        }
      }
    })
    list.setData(data)
    var template = '<div class="remove" data-color="index" on-touchstart="remove">删除</div>'
    s = SwipeIt(template)
    s.bind(list, 'li')
    var first = ul.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      var el = ul.querySelector('.remove')
      expect(el).toExist()
      expect(el.style.backgroundColor).toBe('tomato')
      s.unbind()
      list.remove()
    })
  })

  it('should bind event to template', function (done) {
    var fired
    var first
    var list = new List(tmpl, window, {
      selector: '#mobile-list',
      delegate: {
        remove: tap(function () {
          fired = true
          s.clear().then(function () {
            expect(first.parentNode).toNotExist()
            s.unbind()
            list.remove()
            done()
          })
        })
      },
      bindings: {
        'data-color': function (prop) {
          this.bind(prop, function (model, el) {
            var color = colors[model[prop] - 1]
            el.style.backgroundColor = color
          })
        }
      }
    })
    list.setData(data)
    var template = '<div class="remove" data-color="index" on-touchstart="remove">删除</div>'
    s = SwipeIt(template)
    s.bind(list, 'li')
    first = ul.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    touch.start().moveLeft(50).wait(200).then(function () {
      var el = ul.querySelector('.remove')
      expect(el).toExist()
      var t = new TouchSimulate(el)
      return t.tap().then(function () {
        expect(fired).toBe(true)
      })
    })
  })

  it('should only trigger once after change swiped element', function () {
    var count = 0
    var list = new List(tmpl, window, {
      selector: '#mobile-list',
      delegate: {
        remove: tap(function () {
          count++
        })
      }
    })
    list.setData(data)
    var template = '<div class="remove" on-touchstart="remove">删除</div>'
    s = SwipeIt(template)
    s.bind(list, 'li')
    var first = ul.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      return s.reset()
    }).then(function () {
      touch.el = ul.querySelector('li:nth-child(2)')
      return touch.start().moveLeft(50).wait(200)
    }).then(function () {
      var el = ul.querySelector('.remove')
      expect(el).toExist()
      var t = new TouchSimulate(el)
      return t.tap().then(function () {
        expect(count).toBe(1)
      })
    }).then(function () {
      s.unbind()
      list.remove()
    })
  })
})

describe('.onresize()', function() {
  it('should work even if not dragging', function () {
    var template = '<div class="remove" style="width:70px;">remove {index}</div>'
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var err
    try {
      s.onresize()
    } catch(e) {
      err = e
    }
    expect(err).toNotExist()
    document.body.removeChild(list)
  })

  it('should change swipeEl style according to holder element', function () {
    var template = '<div class="remove" style="width:70px;">x</div>'
    var list = createList()
    var s = SwipeIt(template)
    s.bind(list, 'li')
    var first = list.querySelector('li:first-child')
    var touch = new TouchSimulate(first)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      expect(s.holder).toExist()
      s.holder.style.width = '50px'
      s.onresize()
      expect(s.swipeEl.style.width).toBe('50px')
      document.body.removeChild(list)
    })
  })
})

describe('.ignore', function() {
  var swipe
  var list
  var span
  beforeEach(function () {
    var template = '<div class="remove" style="width:70px;">x</div>'
    list = createList()
    var first = list.firstChild
    span = document.createElement('span')
    span.className = 'handle'
    first.appendChild(span)
    swipe = SwipeIt(template)
    swipe.bind(list, 'li')
    swipe.ignore('.handle')
  })

  afterEach(function () {
    document.body.removeChild(list)
    list = span = swipe = null
  })

  it('should ignore touch from ignored element', function () {
    var touch = new TouchSimulate(span)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      expect(swipe.swipeEl).toNotExist()
      expect(swipe.holder).toNotExist()
    })
  })

  it('should not ignore touch from other element', function () {
    var touch = new TouchSimulate(list.firstChild)
    touch.speed(200)
    return touch.start().moveLeft(50).wait(200).then(function () {
      expect(swipe.swipeEl).toExist()
      expect(swipe.holder).toExist()
    })
  })
})
