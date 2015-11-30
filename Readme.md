# Swipe-it

Swipe a custom element out.

No test case right now, use with caution

[Demo](http://chemzqm.github.io/swipe-it/)

TODO: test

## Features

* Animation like ios messages
* Optional bind to [list-render](https://github.com/chemzqm/list-render)
* Custom render function
* Delegate event binding

## Example

``` js
var tap = require('component-tap-event')
var SwipeIt = require('swipe-it')
var template = require('./template.html')
var s = new SwipeIt(template)
s.bind(document.getElementById('list'), 'li')
s.delegate('touchstart', '.remove', tap(function(e, li) {
  // remove the swiped node
  li.parentNode.removeChild(li)
  // holder remove with transition
  s.removeHolder()
}))
```

## Events

* `start` emit with swipe element when swipe start
* `end` emit with swipe element just before swipe stat reset

## API

### SwipeIt(template)

`template` string or element for element swiped out

### .bind(parentNode, selector)

Bind swipe event to parentNode with delegated selector

### .bind(ListRender, selector)

Bind to [listRender](https://github.com/chemzqm/list-render) instance, which enables automate model [reative-lite](https://github.com/chemzqm/reactive-lite) bind

### .render(fn)

Set a optional render function for swiped out element , `fn` is passed with related swiped element(which matches the bind selector) and `template` string, `fn` should return an element

### .delegate(type, selector, handler)

Delegate `handler` of `type` event with matched `selector` within swiped out element, handler is called with original event and related swiped element.

### .reset()

Reset the swiped element to original stat

### .remove([duration], [ease])

Remove the swipe element and related holder with transition specified by `duration` (default 300) in millisecond and `ease` timing function

### .unbind()

Unbind all event listeners.
