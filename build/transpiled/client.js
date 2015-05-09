var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.Client = (function() {
  var configureMessage;

  function Client(options) {
    var x;
    this.options = options;
    this.contextChannelUrl = (this.options.endPoint + "/api/subscribe/") + ((function() {
      var i, len, ref, results;
      ref = [this.options.accountId, this.options.appId, this.options.contextId];
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        x = ref[i];
        if (x != null) {
          results.push(x);
        }
      }
      return results;
    }).call(this)).join('-');
    this.appChannelUrl = (this.options.endPoint + "/api/subscribe/") + [this.options.accountId, this.options.appId].join('-');
    this.subscribersUrl = this.options.endPoint + "/api/subscribers/" + this.options.accountId + "/" + this.options.appId + "/" + this.options.contextId;
    this.messagesReceived = 0;
  }

  Client.prototype.signal = function(event) {
    console.log("Signalling " + event);
    return post(this.contextChannelUrl, event);
  };

  Client.prototype.subscribers = function(callback) {
    var http;
    http = new Binnacle.Http({
      url: this.subscribersUrl,
      method: 'get',
      json: true,
      sucess: callback
    });
    return http.execute();
  };

  Client.prototype.subscribe = function(subscribeToApp) {
    var request, sep, socket;
    if (subscribeToApp == null) {
      subscribeToApp = false;
    }
    socket = atmosphere;
    request = new atmosphere.AtmosphereRequest();
    request.url = subscribeToApp ? this.appChannelUrl : this.contextChannelUrl;
    if (this.options.missedMessages) {
      request.url += "?mm=true";
      if (this.options.limit) {
        request.url += "&mm-limit=" + this.options.limit;
      }
      if (this.options.since) {
        request.url += "&mm-since=" + this.options.since;
      }
    }
    if (this.options.identity) {
      sep = this.options.missedMessages ? '&' : '?';
      request.url += sep + "psId=" + this.options.identity;
    }
    request.contentType = 'application/json';
    request.logLevel = 'debug';
    request.transport = 'websocket';
    request.fallbackTransport = 'long-polling';
    request.reconnectInterval = 1500;
    request.onOpen = function(response) {
      return console.log("Binnacle connected using " + response.transport);
    };
    request.onError = function(response) {
      return console.log("Sorry, but there's some problem with your socket or the Binnacle server is down");
    };
    request.onMessage = (function(_this) {
      return function(response) {
        var e, i, json, len, message, messageAsString, messages, payload;
        _this.messagesReceived = _this.messagesReceived + 1;
        json = response.responseBody;
        try {
          payload = JSON.parse(json);
          if (Object.prototype.toString.call(payload) === '[object Array]') {
            if (_this.options.onSignals != null) {
              messages = [];
              for (i = 0, len = payload.length; i < len; i++) {
                message = payload[i];
                messages.push(configureMessage(message));
              }
              _this.options.onSignals(messages);
            }
          } else {
            if (payload.eventName === 'subscriber_joined') {
              if (_this.options.onSubscriberJoined != null) {
                _this.options.onSubscriberJoined(payload);
              }
            } else if (payload.eventName === 'subscriber_left') {
              if (_this.options.onSubscriberLeft != null) {
                _this.options.onSubscriberLeft(payload);
              }
            } else {
              if (_this.options.onSignal != null) {
                _this.options.onSignal(configureMessage(payload));
              }
            }
          }
          messageAsString = JSON.stringify(json);
          return console.log("Received Message: \n" + messageAsString);
        } catch (_error) {
          e = _error;
          return console.log("Error processing payload: \n " + json, e);
        }
      };
    })(this);
    return socket.subscribe(request);
  };

  Client.prototype.messagesReceived = Client.messagesReceived;

  configureMessage = function(message) {
    message.eventTime = moment(new Date(message['eventTime'])).format();
    message.clientEventTime = moment(new Date(message['clientEventTime'])).format();
    return message;
  };

  return Client;

})();
