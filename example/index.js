if ('ontouchend' in window) {
  document.querySelector('#list .alert').style.display = 'none'
}
var SwipeIt = require('..')
var tap = require('tap-event')
var Sortable = require('sweet-sortable')

var template = '<div class="remove">删除</div>'

var list = document.getElementById('list')
var swipe = SwipeIt(template)
swipe.bind(list, 'li')
swipe.delegate('touchstart', '.remove', tap(function () {
  swipe.remove()
}))

var renderEl = document.getElementById('render')
var sortable = new Sortable(renderEl)
sortable.handle('.handler')
sortable.bind('li')

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
!(function () {
var List = require('mobile-list')
var tmpl = '<li>{language}</li>'
var colors = ['tomato', 'gold', 'lightgreen', 'deepskyblue', 'orange', 'violet']
var list = new List(tmpl, window, {
  selector: '#mobile-list',
  delegate: {
    remove: tap(function (e, model, el) {
      //model.remove()
      console.log(12)
      swipe.remove()
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
})()
