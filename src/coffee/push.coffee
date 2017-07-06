#
# binnacle
# https://github.com/binnacle-io/binnacle-js
#
# Copyright (c) 2017 Binnacle, LLC.
# Licensed under the MIT license.
#

root = global ? window

root.Binnacle ?= {}

class Binnacle.PushSubscription
  constructor: (options) ->
    # defaults
    options.subscriptionType ?= 'firebase'
    options.kvm ?= {}

    @channelId ?= options.channelId
    @subscriptionType ?= options.subscriptionType
    @userIdentifier ?= options.userIdentifier
    @ipAddress ?= options.ipAddress
    @token ?= options.token
    @kvm ?= options.kvm

#
# @options.endPoint
# @options.apiKey
# @options.apiSecret
# @options.channelId
# @options.firebaseServerKey
# @options.firebaseSenderId
# @options.userIdentifier
# @options.onMessage(payload)
# @options.onTokenRefresh()
# @options.onBeforePermissionRequest()
# @options.onPermissionGranted()
# @options.onPermissionFailed()
# @options.onTokenDeleted()
# @options.onErrorDeletingToken()
# @options.onErrorRetrievingToken()
# @options.onErrorRetrievingRefreshedToken()
#
class Binnacle.WebPushClient
  constructor: (options) ->
    @options = options

    # defaults
    @options.onMessage ?= (payload) ->
    @options.onTokenRefresh ?= () ->
    @options.onBeforePermissionRequest ?= () ->
    @options.onPermissionGranted ?= () ->
    @options.onPermissionFailed ?= () ->
    @options.onTokenDeleted ?= () ->
    @options.onErrorDeletingToken ?= () ->
    @options.onErrorRetrievingToken ?= () ->
    @options.onErrorRetrievingRefreshedToken ?= () ->

    @webPushTokenRegistrationUrl = "#{@options.endPoint}/api/push-subscriptions/#{@options.channelId}"

  subscribe: ->
    @initialize() unless @messaging
    @getTokenAndSubscribe()

  initialize: () ->
    config =
      apiKey: @options.firebaseApiKey
      messagingSenderId: @options.firebaseMessagingSenderId
    if !firebase.apps.length
      firebase.initializeApp config
    @messaging = firebase.messaging()

    @messaging.onMessage (payload) =>
      console.log 'Message received. ', payload
      @options.onMessage(payload)

    @messaging.onTokenRefresh =>
      messaging.getToken().then((refreshedToken) =>
        setTokenSentToServer(false)
        sendTokenToServer(refreshedToken)
        @options.onTokenRefresh()
      ).catch (err) ->
        console.log 'Unable to retrieve refreshed token ', err
        @options.onErrorRetrievingRefreshedToken()

  getToken: () ->
    @messaging.getToken()
      
  getTokenAndSubscribe: () ->
    @messaging.getToken().then((currentToken) =>
      if currentToken
        @sendTokenToServer currentToken
      else
        @options.onBeforePermissionRequest()

        @messaging.requestPermission().then(=>
          @options.onPermissionGranted()
          @getToken()
        ).catch (err) =>
          console.log 'Unable to get permission to notify.', err
          @options.onPermissionFailed()

        setTokenSentToServer(false)
    ).catch (err) ->
      console.log 'An error occurred while retrieving token. ', err
      setTokenSentToServer(false)

  sendTokenToServer: (currentToken) ->
    if !isTokenSentToServer()
      pushSubscription = new (Binnacle.PushSubscription)(
        channelId: @options.channelId
        subscriptionType: 'firebase'
        userIdentifier: @options.userIdentifier
        token: currentToken
        ipAddress: ''
        kvm: {
          token: currentToken
        }
      )

      http = new (Binnacle.Http)(
        url: @webPushTokenRegistrationUrl
        method: 'POST'
        json: true
        auth: true
        user: @options.apiKey
        password: @options.apiSecret
        data: pushSubscription
      )
      http.execute()
      setTokenSentToServer true

  deleteToken: ->
    @messaging.getToken().then((currentToken) ->
      @messaging.deleteToken(currentToken).then(->
        setTokenSentToServer false
        @options.onTokenDeleted()
      ).catch (err) ->
        console.log 'Unable to delete token. ', err
        @options.onErrorDeletingToken()
    ).catch (err) ->
      console.log 'Error retrieving Instance ID token. ', err
      @options.onErrorRetrievingToken()
  #
  # Private
  #
  
  isTokenSentToServer = ->
    if window.localStorage.getItem('sentToServer') == 1 then true else false

  setTokenSentToServer = (sent) ->
    window.localStorage.setItem 'sentToServer', if sent then 1 else 0
