#
# binnacle
# https://github.com/binnacle-io/binnacle-js
#
# Copyright (c) 2015 Binnacle, LLC.
# Licensed under the MIT license.
#

root = global ? window

root.Binnacle ?= {}

class Binnacle.Event
  constructor: (options) ->
    # defaults
    options.logLevel ?= 'EVENT'
    options.environment ?= {}
    options.tags ?= []
    options.json ?= {}

    @appId ?= options.appId
    @contextId ?= options.contextId
    @sessionId ?= options.sessionId
    @eventName ?= options.eventName
    @clientEventTime ?= options.clientEventTime
    @clientId ?= options.clientId
    @logLevel ?= options.logLevel
    @environment ?= options.environment
    @tags ?= options.tags
    @json ?= options.json

class Binnacle.Client
  constructor: (options) ->
    @options = options

    @contextChannelUrl =  "#{@options.endPoint}/api/subscribe/#{@options.contextId}"
    @appChannelUrl = "#{@options.endPoint}/api/subscribe/app/#{@options.appId}"
    @subscribersUrl = "#{@options.endPoint}/api/subscribers/#{@options.contextId}"
    @signalUrl = "#{@options.endPoint}/api/events/#{@options.contextId}"
    @messagesReceived = 0

  signal: (event)->
    http = new (Binnacle.Http)(
      url: @signalUrl
      method: 'post'
      json: true
      data: event
      auth: true
      user: @options.apiKey
      password: @options.apiSecret
    )
    http.execute()
    console.log "Signalling #{event}"

  subscribers: (callback)->
    http = new (Binnacle.Http)(
      url: @subscribersUrl
      method: 'get'
      json: true
      auth: true
      user: @options.apiKey
      password: @options.apiSecret
      success: callback
    )
    http.execute()

  subscribe: () ->
    socket = atmosphere
    request = new atmosphere.AtmosphereRequest()
    request.url = if @appChannelUrl then @appChannelUrl else @contextChannelUrl
    # missed messages configuration
    if @options.missedMessages
      request.url += "?mm=true"
      request.url += "&mm-limit=#{@options.limit}" if @options.limit
      request.url += "&mm-since=#{@options.since}" if @options.since

    # add filtering options
    if @options.filterBy
      sep = if @options.missedMessages then '&' else '?'
      request.url += "#{sep}filterBy=#{@options.filterBy}"
      request.url += "&filterByValue=#{@options.filterByValue}"

    if @options.identity
      sep = if @options.missedMessages then '&' else '?'
      request.url += "#{sep}psId=#{@options.identity}"

    request.contentType = 'application/json'
    request.logLevel = 'debug'
    request.transport = 'websocket'
    request.fallbackTransport = 'long-polling'
    request.reconnectInterval = 1500
    request.headers = Authorization : 'Basic ' + btoa("#{@options.apiKey}:#{@options.apiSecret}")

    request.onOpen = (response) ->
      console.log "Binnacle connected using #{response.transport}"

    request.onError = (response) ->
      console.log "Sorry, but there's some problem with your socket or the Binnacle server is down"

    request.onMessage = (response) =>
      @messagesReceived = @messagesReceived + 1
      json = response.responseBody
      try
        payload = JSON.parse(json)

        if Object::toString.call(payload) == '[object Array]'
          if @options.onSignals?
            messages = []
            for message in payload
              messages.push(configureMessage(message))
            @options.onSignals(messages)
        else
          if payload.eventName == 'subscriber_joined'
            @options.onSubscriberJoined(payload) if @options.onSubscriberJoined?
          else if payload.eventName == 'subscriber_left'
            @options.onSubscriberLeft(payload) if @options.onSubscriberLeft?
          else if payload.eventName == 'error'
            console.log("ERROR: #{payload.message}")
            socket.unsubscribe()
          else
            @options.onSignal(configureMessage(payload)) if @options.onSignal?

        messageAsString = JSON.stringify(json)
        console.log "Received Message: \n#{messageAsString}"
      catch e
        console.log "Error processing payload: \n #{json}", e

    socket.subscribe(request)

  messagesReceived:
    @messagesReceived

  #
  # Private Methods (sorta)
  #
  configureMessage = (message) ->
    message.eventTime = moment(new Date(message['eventTime'])).format()
    message.clientEventTime = moment(new Date(message['clientEventTime'])).format()
    message
