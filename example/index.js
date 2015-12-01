if ('ontouchend' in window) {
  document.querySelector('#list .alert').style.display = 'none'
}
var detect = require('prop-detect')
var transform = detect.transform
var SwipeIt = require('..')
var tap = require('tap-event')
var Sortable = require('sweet-sortable')

!(function () {
  function hide(el) {
    el.style.display = 'none'
  }
  function show(el) {
    el.style.display = 'block'
  }
  var template = '<div class="remove">删除</div>'
  var list = document.getElementById('list')
  // before swipe-it
  var sortable = new Sortable(list)
  sortable.handle('.handler')
  sortable.bind('li')
  //sortable.ignore('.swipe-dragging')

  var swipe = SwipeIt(template)
  swipe.bind(list, 'li')
  swipe.on('start', function (el) {
    hide(el.querySelector('.handler'))
  })
  swipe.on('end', function (el) {
    show(el.querySelector('.handler'))
  })
  swipe.delegate('touchstart', '.remove', tap(function () {
    swipe.clear()
  }))
})()

!(function () {
var data = [{
  index: 1,
  language: 'javascript'
}, {
  index: 2,
  language: 'Ruby'
}, {
  index: 3,
  language: 'Python'
}, {
  index: 4,
  language: 'Php'
}, {
  index: 5,
  language: 'Go'
}, {
  index: 6,
  language: 'Rust'
}]
var List = require('mobile-list')
var tmpl = '<li>{language}</li>'
var colors = ['tomato', 'gold', 'lightgreen', 'deepskyblue', 'orange', 'violet']
var list = new List(tmpl, window, {
  selector: '#mobile-list',
  delegate: {
    remove: tap(function (e, model) {
      swipe.clear()
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
var swipe = SwipeIt(template)
swipe.bind(list, 'li')
// slide up
swipe.on('remove', function (el) {
  //el.style.zIndex = 'aoto'
  el.style[transform] = 'translateX(' + swipe.x + 'px) translateY(-100%)'
})
})()
