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

    @logLevel ?= 'info'
    @missedMessages ?= {}

  signal: (event)->
    console.log "Signalling #{event}"
    post(@contextChannelUrl, event)

  subscribe: (subscribeToApp = false) ->
    socket = atmosphere
    request = new atmosphere.AtmosphereRequest()
    request.url = if subscribeToApp then @appChannelUrl else @contextChannelUrl
    request.contentType = 'application/json'
    request.logLevel = 'debug'
    request.transport = 'websocket'
    request.fallbackTransport = 'long-polling'
    request.reconnectInterval = 1500

    request.onOpen = (response) ->
      console.log "Binnacle connected using #{response.transport}"

    request.onError = (response) ->
      console.log 'Sorry, but there\'s some problem with your socket or the Binnacle server is down'

    request.onMessage = (response) =>
      @messagesReceived = @messagesReceived + 1
      json = response.responseBody
      try
        payload = JSON.parse(json)

        if Object::toString.call(payload) == '[object Array]'
          messages = configureMessage(message) for message in payload
          @options.onSignals(messages)
        else
          message = configureMessage(payload)
          @options.onSignal(message)
        end

        messageAsString = JSON.stringify(json)
        console.log "Received Message ==> \n#{messageAsString}"
      catch e
        console.log 'This doesn\'t look like valid JSON: ', message.data

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
