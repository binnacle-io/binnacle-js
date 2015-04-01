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

    @contextChannelUrl = @options.endPoint + '/api/subscribe/' + (x for x in [@options.accountId, @options.appId, @options.contextId] when x?).join('-')
    @appChannelUrl = @options.endPoint + '/api/subscribe/' + [@options.accountId, @options.appId].join('-')
    @messagesReceived = 0

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

    request.onOpen = (response) ->
      console.log 'Binnacle connected using ' + response.transport

    request.onError = (response) ->
      console.log 'Sorry, but there\'s some problem with your socket or the server is down'

    request.onMessage = (response) =>
      @messagesReceived = @messagesReceived + 1
      json = response.responseBody
      try
        message = JSON.parse(json)
        message.eventTime = moment(new Date(message['eventTime'])).format()
        message.clientEventTime = moment(new Date(message['clientEventTime'])).format()
        messageAsString = JSON.stringify(json)
        console.log 'Received Message ==> \n' + messageAsString
        @options.onSignal(message)

      catch e
        console.log 'This doesn\'t look like a valid JSON: ', message.data

    socket.subscribe(request)

  messagesReceived:
    @messagesReceived
