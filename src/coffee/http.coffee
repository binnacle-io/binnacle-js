#
# binnacle
# https://github.com/integrallis/binnacle-js
#
# Copyright (c) 2015 Binnacle, LLC.
# Licensed under the MIT license.
#

root = global ? window

root.Binnacle ?= {}

class Binnacle.Http
  constructor: (options) ->
    @options = options

    if window.ActiveXObject
      @xhr = new ActiveXObject('Microsoft.XMLHTTP')
    else if window.XMLHttpRequest
      @xhr = new XMLHttpRequest

    @setHeaders(@options.headers)

  execute: ->
    result = null
    if @xhr
      if @options.method == 'get'
        @xhr.open 'GET', @options.url + getParams(@options.data, @options.url), @options.asynch
      else
        @xhr.open @options.method, @options.url, @options.asynch
        @setHeaders
          'X-Requested-With': 'XMLHttpRequest'
          'Content-type': 'application/x-www-form-urlencoded'

      if @options.method == 'get' then @xhr.send() else @xhr.send(getParams(@options.data))

      result = @xhr.responseText

      if @options.json == true and typeof JSON != 'undefined'
        result = JSON.parse(result)

    result

  setHeaders: (headers) ->
    for name of headers
      @xhr and @xhr.setRequestHeader(name, headers[name])

  getParams = (data, url) ->
    arr = []
    str = undefined
    for name of data
      arr.push "#{name}=#{encodeURIComponent(data[name])}"
    str = arr.join('&')
    if str != ''
      return if url then (if url.indexOf('?') < 0 then "?#{str}" else "&#{str}") else str
    ''
