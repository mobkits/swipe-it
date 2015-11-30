if ('ontouchend' in window) {
  document.querySelector('#list .alert').style.display = 'none'
}
var SwipeIt = require('..')
var tap = require('tap-event')

var template = '<div class="remove">删除</div>'
var list = document.getElementById('list')

var swipe = SwipeIt(template)
swipe.bind(list, 'li')
swipe.on('start', function (el) {
})
swipe.on('end', function (el) {
})
swipe.delegate('touchstart', '.remove', tap(function (e, el) {
  el.parentNode.removeChild(el)
  swipe.removeHolder()
}))
