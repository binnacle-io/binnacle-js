var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.Event = (function() {
  function Event(options) {
    if (options.logLevel == null) {
      options.logLevel = 'EVENT';
    }
    if (options.environment == null) {
      options.environment = {};
    }
    if (options.tags == null) {
      options.tags = [];
    }
    if (options.json == null) {
      options.json = {};
    }
    if (this.accountId == null) {
      this.accountId = options.accountId;
    }
    if (this.appId == null) {
      this.appId = options.appId;
    }
    if (this.contextId == null) {
      this.contextId = options.contextId;
    }
    if (this.sessionId == null) {
      this.sessionId = options.sessionId;
    }
    if (this.eventName == null) {
      this.eventName = options.eventName;
    }
    if (this.clientEventTime == null) {
      this.clientEventTime = options.clientEventTime;
    }
    if (this.clientId == null) {
      this.clientId = options.clientId;
    }
    if (this.logLevel == null) {
      this.logLevel = options.logLevel;
    }
    if (this.environment == null) {
      this.environment = options.environment;
    }
    if (this.tags == null) {
      this.tags = options.tags;
    }
    if (this.json == null) {
      this.json = options.json;
    }
  }

  return Event;

})();

Binnacle.Client = (function() {
  var configureMessage;

  function Client(options) {
    this.options = options;
    this.contextChannelUrl = this.options.endPoint + "/api/subscribe/ctx/" + this.options.contextId;
    this.appChannelUrl = this.options.endPoint + "/api/subscribe/app/" + this.options.appId;
    this.subscribersUrl = this.options.endPoint + "/api/subscribers/" + this.options.contextId;
    this.notificationsUrl = this.options.endPoint + "/api/subscribe/ntf/" + this.options.accountId;
    this.signalUrl = this.options.endPoint + "/api/events/" + this.options.contextId;
    this.messagesReceived = 0;
  }

  Client.prototype.signal = function(event) {
    var http;
    http = new Binnacle.Http({
      url: this.signalUrl,
      method: 'post',
      json: true,
      data: event,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret
    });
    http.execute();
    return console.log("Signalling " + event);
  };

  Client.prototype.subscribers = function(callback) {
    var http;
    http = new Binnacle.Http({
      url: this.subscribersUrl,
      method: 'get',
      json: true,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret,
      success: callback
    });
    return http.execute();
  };

  Client.prototype.subscribe = function() {
    var request, sep, socket;
    socket = atmosphere;
    request = new atmosphere.AtmosphereRequest();
    if (this.options.accountId) {
      request.url = this.notificationsUrl;
    } else if (this.options.appId) {
      request.url = this.appChannelUrl;
    } else {
      request.url = this.contextChannelUrl;
    }
    if (this.options.missedMessages) {
      request.url += "?mm=true";
      if (this.options.limit) {
        request.url += "&mm-limit=" + this.options.limit;
      }
      if (this.options.since) {
        request.url += "&mm-since=" + this.options.since;
      }
    }
    if (this.options.filterBy) {
      sep = this.options.missedMessages ? '&' : '?';
      request.url += sep + "filterBy=" + this.options.filterBy;
      request.url += "&filterByValue=" + this.options.filterByValue;
    }
    if (this.options.identity) {
      sep = this.options.missedMessages ? '&' : '?';
      request.url += sep + "psId=" + this.options.identity;
    }
    request.contentType = 'application/json';
    request.logLevel = 'debug';
    request.transport = 'websocket';
    request.fallbackTransport = 'long-polling';
    request.reconnectInterval = 2000;
    request.maxReconnectOnClose = 300;
    request.headers = {
      Authorization: 'Basic ' + btoa(this.options.apiKey + ":" + this.options.apiSecret)
    };
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
            } else if (payload.eventName === 'error') {
              console.log("ERROR: " + payload.message);
              socket.unsubscribe();
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
