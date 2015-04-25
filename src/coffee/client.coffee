#
# binnacle
# https://github.com/integrallis/binnacle-js
#
# Copyright (c) 2015 Brian Sam-Bodden
# Licensed under the MIT license.
#

root = global ? window

root.Binnacle ?= {}

class Binnacle.Client
  constructor: (options) ->
    @options = options

    @contextChannelUrl =  "#{@options.endPoint}/api/subscribe/" + (x for x in [@options.accountId, @options.appId, @options.contextId] when x?).join('-')
    @appChannelUrl = "#{@options.endPoint}/api/subscribe/" + [@options.accountId, @options.appId].join('-')
    @messagesReceived = 0

  signal: (event)->
    console.log "Signalling #{event}"
    post(@contextChannelUrl, event)

  subscribe: (subscribeToApp = false) ->
    socket = atmosphere
    request = new atmosphere.AtmosphereRequest()
    request.url = if subscribeToApp then @appChannelUrl else @contextChannelUrl
    # missed messages configuration
    if @options.missedMessages
      request.url += "?mm=true"
      request.url += "&mm-limit=#{@options.limit}" if @options.limit
      request.url += "&mm-since=#{@options.since}" if @options.since

    request.contentType = 'application/json'
    request.logLevel = 'debug'
    request.transport = 'websocket'
    request.fallbackTransport = 'long-polling'
    request.reconnectInterval = 1500

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
          if @options.onSignal?
            message = configureMessage(payload)
            @options.onSignal(message)

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
