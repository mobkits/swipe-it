# Swipe-it

Swipe a custom element out.

[![Dependency Status](https://david-dm.org/chemzqm/swipe-it.svg)](https://david-dm.org/chemzqm/swipe-it)
[![Build Status](https://secure.travis-ci.org/chemzqm/swipe-it.svg)](http://travis-ci.org/chemzqm/swipe-it)
[![Coverage Status](https://coveralls.io/repos/chemzqm/swipe-it/badge.svg?branch=master&service=github)](https://coveralls.io/github/chemzqm/swipe-it?branch=master)

Give me a [feed back](https://github.com/chemzqm/swipe-it/issues/new) if you have any problem with this.

[Demo](http://chemzqm.github.io/swipe-it/)


## Features

* Animation like ios messages
* Light weight and performance optimized
* Delegate event binding
* Custom animation
* Custom render function
* Support window orientation change & resize event
* Works with [sweet-sortable](https://github.com/chemzqm/sweet-sortable)
* Optional bind to [list-render](https://github.com/chemzqm/list-render)
* Temporarily disable by calling `bind` and `unbind`

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
  s.clear()
}))
```

## Events

* `start` emit with swipe element when swipe start
* `end` emit with swipe element just before swipe stat reset, could be used for change the transition when remove
* `clear` emit with swipe element just before remove transition begin, used for change the style of swiped element for transition

## API

### SwipeIt(template, [opts])

* `template` string or element for element swiped out
* `opts` optional options
* `opts.ease` a [ease function or string](https://github.com/component/ease) for reset&expand animation, default `out-quad`
* `opts.duration` duration for reset in millisecon, default 350

### .bind(parentNode, selector)

Bind swipe event to parentNode with delegated selector

### .bind(ListRender, selector)

Bind to [listRender](https://github.com/chemzqm/list-render) instance, which enables automate model [reative-lite](https://github.com/chemzqm/reactive-lite) bind

### .ignore(selector)

Ignore touchstart event from target that within element matches selector

### .render(fn)

Set a optional render function for swiped out element , `fn` is passed with related swiped element(which matches the bind selector) and `template` string, `fn` should return an element

### .delegate(type, selector, handler)

Delegate `handler` of `type` event with matched `selector` within swiped out element, handler is called with original event and related swiped element.

### .reset()

Reset the swiped element to original stat with animation, return promise

### .clear([duration], [ease])

Remove the swiped element and related holder with transition specified by `duration` (default 300) in millisecond and `ease` timing function, return promise.

### .unbind()

Unbind all event listeners, and reset status synchronize.
