#
# binnacle
# https://github.com/binnacle-io/binnacle-js
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

    @options.host ?= {}

  execute: ->
    if @xhr
      # set xhr callbacks
      @xhr.onreadystatechange = =>
        if @xhr.readyState == 4 and @xhr.status == 200
          result = @xhr.responseText

          if @options.json and typeof JSON != 'undefined'
            result = JSON.parse(result)

          @options.success and @options.success.apply(@options.host, [result, @xhr])
        else if @xhr.readyState == 4
          @options.failure and @options.failure.apply(@options.host, [ @xhr ])

        @options.ensure and @options.ensure.apply(@options.host, [ @xhr ])

      # set request url plus headers
      if @options.method == 'get'
        @xhr.open 'GET', @options.url + getParams(@options.data, @options.url), true
      else
        if @options.auth
          @xhr.open @options.method, @options.url, true, @options.user, @options.password
        else
          @xhr.open @options.method, @options.url, true

      # set content type if there is data to send
      if @options.data
        contextType = if @options.json then 'application/json' else 'application/x-www-form-urlencoded'
        @setHeaders
          'Content-Type': contextType

      # set request-with
      @setHeaders
        'X-Requested-With': 'XMLHttpRequest'

      # set auth header
      if @options.auth
        @setHeaders
          'Authorization': 'Basic ' + btoa("#{@options.user}:#{@options.password}")

        @xhr.withCredentials = 'true' if 'withCredentials' of request

      @setHeaders(@options.headers)

      # execute the request
      if @options.method == 'get'
        @xhr.send()
      else if @options.json
        @xhr.send(JSON.stringify(@options.data))
      else
        @xhr.send(getParams(@options.data))

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
