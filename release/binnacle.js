/* ===========================================================
# Binnacle JS - v0.2.2
# ==============================================================
# Copyright (c) 2016 Brian Sam-Bodden
# Licensed MIT.
*/
/**
 * Atmosphere.js
 * https://github.com/Atmosphere/atmosphere-javascript
 *
 * API reference
 * https://github.com/Atmosphere/atmosphere/wiki/jQuery.atmosphere.js-API
 *
 * Highly inspired by
 * - Portal by Donghwan Kim http://flowersinthesand.github.io/portal/
 */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD
        define(factory);
    } else if(typeof exports !== 'undefined') {
        // CommonJS
        module.exports = factory();
    } else {
        // Browser globals, Window
        root.atmosphere = factory();
    }
}(this, function () {

    "use strict";

    var atmosphere = {},
        guid,
        offline = false,
        requests = [],
        callbacks = [],
        uuid = 0,
        hasOwn = Object.prototype.hasOwnProperty;

    atmosphere = {
        version: "2.3.2-javascript",
        onError: function (response) {
        },
        onClose: function (response) {
        },
        onOpen: function (response) {
        },
        onReopen: function (response) {
        },
        onMessage: function (response) {
        },
        onReconnect: function (request, response) {
        },
        onMessagePublished: function (response) {
        },
        onTransportFailure: function (errorMessage, _request) {
        },
        onLocalMessage: function (response) {
        },
        onFailureToReconnect: function (request, response) {
        },
        onClientTimeout: function (request) {
        },
        onOpenAfterResume: function (request) {
        },

        /**
         * Creates an object based on an atmosphere subscription that exposes functions defined by the Websocket interface.
         *
         * @class WebsocketApiAdapter
         * @param {Object} request the request object to build the underlying subscription
         * @constructor
         */
        WebsocketApiAdapter: function (request) {
            var _socket, _adapter;

            /**
             * Overrides the onMessage callback in given request.
             *
             * @method onMessage
             * @param {Object} e the event object
             */
            request.onMessage = function (e) {
                _adapter.onmessage({data: e.responseBody});
            };

            /**
             * Overrides the onMessagePublished callback in given request.
             *
             * @method onMessagePublished
             * @param {Object} e the event object
             */
            request.onMessagePublished = function (e) {
                _adapter.onmessage({data: e.responseBody});
            };

            /**
             * Overrides the onOpen callback in given request to proxy the event to the adapter.
             *
             * @method onOpen
             * @param {Object} e the event object
             */
            request.onOpen = function (e) {
                _adapter.onopen(e);
            };

            _adapter = {
                close: function () {
                    _socket.close();
                },

                send: function (data) {
                    _socket.push(data);
                },

                onmessage: function (e) {
                },

                onopen: function (e) {
                },

                onclose: function (e) {
                },

                onerror: function (e) {

                }
            };
            _socket = new atmosphere.subscribe(request);

            return _adapter;
        },

        AtmosphereRequest: function (options) {

            /**
             * {Object} Request parameters.
             *
             * @private
             */
            var _request = {
                timeout: 300000,
                method: 'GET',
                headers: {},
                contentType: '',
                callback: null,
                url: '',
                data: '',
                suspend: true,
                maxRequest: -1,
                reconnect: true,
                maxStreamingLength: 10000000,
                lastIndex: 0,
                logLevel: 'info',
                requestCount: 0,
                fallbackMethod: 'GET',
                fallbackTransport: 'streaming',
                transport: 'long-polling',
                webSocketImpl: null,
                webSocketBinaryType: null,
                dispatchUrl: null,
                webSocketPathDelimiter: "@@",
                enableXDR: false,
                rewriteURL: false,
                attachHeadersAsQueryString: true,
                executeCallbackBeforeReconnect: false,
                readyState: 0,
                withCredentials: false,
                trackMessageLength: false,
                messageDelimiter: '|',
                connectTimeout: -1,
                reconnectInterval: 0,
                dropHeaders: true,
                uuid: 0,
                async: true,
                shared: false,
                readResponsesHeaders: false,
                maxReconnectOnClose: 5,
                enableProtocol: true,
                disableDisconnect: false,
                pollingInterval: 0,
                heartbeat: {
                    client: null,
                    server: null
                },
                ackInterval: 0,
                closeAsync: false,
                reconnectOnServerError: true,
                handleOnlineOffline: true,
                onError: function (response) {
                },
                onClose: function (response) {
                },
                onOpen: function (response) {
                },
                onMessage: function (response) {
                },
                onReopen: function (request, response) {
                },
                onReconnect: function (request, response) {
                },
                onMessagePublished: function (response) {
                },
                onTransportFailure: function (reason, request) {
                },
                onLocalMessage: function (request) {
                },
                onFailureToReconnect: function (request, response) {
                },
                onClientTimeout: function (request) {
                },
                onOpenAfterResume: function (request) {
                }
            };

            /**
             * {Object} Request's last response.
             *
             * @private
             */
            var _response = {
                status: 200,
                reasonPhrase: "OK",
                responseBody: '',
                messages: [],
                headers: [],
                state: "messageReceived",
                transport: "polling",
                error: null,
                request: null,
                partialMessage: "",
                errorHandled: false,
                closedByClientTimeout: false,
                ffTryingReconnect: false
            };

            /**
             * {websocket} Opened web socket.
             *
             * @private
             */
            var _websocket = null;

            /**
             * {SSE} Opened SSE.
             *
             * @private
             */
            var _sse = null;

            /**
             * {XMLHttpRequest, ActiveXObject} Opened ajax request (in case of http-streaming or long-polling)
             *
             * @private
             */
            var _activeRequest = null;

            /**
             * {Object} Object use for streaming with IE.
             *
             * @private
             */
            var _ieStream = null;

            /**
             * {Object} Object use for jsonp transport.
             *
             * @private
             */
            var _jqxhr = null;

            /**
             * {boolean} If request has been subscribed or not.
             *
             * @private
             */
            var _subscribed = true;

            /**
             * {number} Number of test reconnection.
             *
             * @private
             */
            var _requestCount = 0;

            /**
             * The Heartbeat interval send by the server.
             * @type {int}
             * @private
             */
            var _heartbeatInterval = 0;

            /**
             * The Heartbeat bytes send by the server.
             * @type {string}
             * @private
             */
            var _heartbeatPadding = 'X';

            /**
             * {boolean} If request is currently aborted.
             *
             * @private
             */
            var _abortingConnection = false;

            /**
             * A local "channel' of communication.
             *
             * @private
             */
            var _localSocketF = null;

            /**
             * The storage used.
             *
             * @private
             */
            var _storageService;

            /**
             * Local communication
             *
             * @private
             */
            var _localStorageService = null;

            /**
             * A Unique ID
             *
             * @private
             */
            var guid = atmosphere.util.now();

            /** Trace time */
            var _traceTimer;

            /** Key for connection sharing */
            var _sharingKey;

            /**
             * {boolean} If window beforeUnload event has been called.
             * Flag will be reset after 5000 ms
             *
             * @private
             */
            var _beforeUnloadState = false;

            // Automatic call to subscribe
            _subscribe(options);

            /**
             * Initialize atmosphere request object.
             *
             * @private
             */
            function _init() {
                _subscribed = true;
                _abortingConnection = false;
                _requestCount = 0;

                _websocket = null;
                _sse = null;
                _activeRequest = null;
                _ieStream = null;
            }

            /**
             * Re-initialize atmosphere object.
             *
             * @private
             */
            function _reinit() {
                _clearState();
                _init();
            }

            /**
             * Returns true if the given level is equal or above the configured log level.
             *
             * @private
             */
            function _canLog(level) {
                if (level == 'debug') {
                    return _request.logLevel === 'debug';
                } else if (level == 'info') {
                    return _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else if (level == 'warn') {
                    return _request.logLevel === 'warn' || _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else if (level == 'error') {
                    return _request.logLevel === 'error' || _request.logLevel === 'warn' || _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else {
                    return false;
                }
            }

            function _debug(msg) {
                if (_canLog('debug')) {
                    atmosphere.util.debug(new Date() + " Atmosphere: " + msg);
                }
            }

            /**
             *
             * @private
             */
            function _verifyStreamingLength(ajaxRequest, rq) {
                // Wait to be sure we have the full message before closing.
                if (_response.partialMessage === "" && (rq.transport === 'streaming') && (ajaxRequest.responseText.length > rq.maxStreamingLength)) {
                    return true;
                }
                return false;
            }

            /**
             * Disconnect
             *
             * @private
             */
            function _disconnect() {
                if (_request.enableProtocol && !_request.disableDisconnect && !_request.firstMessage) {
                    var query = "X-Atmosphere-Transport=close&X-Atmosphere-tracking-id=" + _request.uuid;

                    atmosphere.util.each(_request.headers, function (name, value) {
                        var h = atmosphere.util.isFunction(value) ? value.call(this, _request, _request, _response) : value;
                        if (h != null) {
                            query += "&" + encodeURIComponent(name) + "=" + encodeURIComponent(h);
                        }
                    });

                    var url = _request.url.replace(/([?&])_=[^&]*/, query);
                    url = url + (url === _request.url ? (/\?/.test(_request.url) ? "&" : "?") + query : "");

                    var rq = {
                        connected: false
                    };
                    var closeR = new atmosphere.AtmosphereRequest(rq);
                    closeR.connectTimeout = _request.connectTimeout;
                    closeR.attachHeadersAsQueryString = false;
                    closeR.dropHeaders = true;
                    closeR.url = url;
                    closeR.contentType = "text/plain";
                    closeR.transport = 'polling';
                    closeR.method = 'GET';
                    closeR.data = '';
                    closeR.heartbeat = null;
                    if (_request.enableXDR) {
                        closeR.enableXDR = _request.enableXDR
                    }
                    closeR.async = _request.closeAsync;
                    _pushOnClose("", closeR);
                }
            }

            /**
             * Close request.
             *
             * @private
             */
            function _close() {
                _debug("Closing (AtmosphereRequest._close() called)");

                _abortingConnection = true;
                if (_request.reconnectId) {
                    clearTimeout(_request.reconnectId);
                    delete _request.reconnectId;
                }

                if (_request.heartbeatTimer) {
                    clearTimeout(_request.heartbeatTimer);
                }

                _request.reconnect = false;
                _response.request = _request;
                _response.state = 'unsubscribe';
                _response.responseBody = "";
                _response.status = 408;
                _response.partialMessage = "";
                _invokeCallback();
                _disconnect();
                _clearState();
            }

            function _clearState() {
                _response.partialMessage = "";
                if (_request.id) {
                    clearTimeout(_request.id);
                }

                if (_request.heartbeatTimer) {
                    clearTimeout(_request.heartbeatTimer);
                }

                // https://github.com/Atmosphere/atmosphere/issues/1860#issuecomment-74707226
                if(_request.reconnectId) {
                    clearTimeout(_request.reconnectId);
                    delete _request.reconnectId;
                }

                if (_ieStream != null) {
                    _ieStream.close();
                    _ieStream = null;
                }
                if (_jqxhr != null) {
                    _jqxhr.abort();
                    _jqxhr = null;
                }
                if (_activeRequest != null) {
                    _activeRequest.abort();
                    _activeRequest = null;
                }
                if (_websocket != null) {
                    if (_websocket.canSendMessage) {
                        _debug("invoking .close() on WebSocket object");
                        _websocket.close();
                    }
                    _websocket = null;
                }
                if (_sse != null) {
                    _sse.close();
                    _sse = null;
                }
                _clearStorage();
            }

            function _clearStorage() {
                // Stop sharing a connection
                if (_storageService != null) {
                    // Clears trace timer
                    clearInterval(_traceTimer);
                    // Removes the trace
                    document.cookie = _sharingKey + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
                    // The heir is the parent unless unloading
                    _storageService.signal("close", {
                        reason: "",
                        heir: !_abortingConnection ? guid : (_storageService.get("children") || [])[0]
                    });
                    _storageService.close();
                }
                if (_localStorageService != null) {
                    _localStorageService.close();
                }
            }

            /**
             * Subscribe request using request transport. <br>
             * If request is currently opened, this one will be closed.
             *
             * @param {Object} Request parameters.
             * @private
             */
            function _subscribe(options) {
                _reinit();

                _request = atmosphere.util.extend(_request, options);
                // Allow at least 1 request
                _request.mrequest = _request.reconnect;
                if (!_request.reconnect) {
                    _request.reconnect = true;
                }
            }

            /**
             * Check if web socket is supported (check for custom implementation provided by request object or browser implementation).
             *
             * @returns {boolean} True if web socket is supported, false otherwise.
             * @private
             */
            function _supportWebsocket() {
                return _request.webSocketImpl != null || window.WebSocket || window.MozWebSocket;
            }

            /**
             * Check if server side events (SSE) is supported (check for custom implementation provided by request object or browser implementation).
             *
             * @returns {boolean} True if web socket is supported, false otherwise.
             * @private
             */
            function _supportSSE() {
                // Origin parts
                var url = atmosphere.util.getAbsoluteURL(_request.url.toLowerCase());
                var parts = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/.exec(url);
                var crossOrigin = !!(parts && (
                    // protocol
                parts[1] != window.location.protocol ||
                    // hostname
                parts[2] != window.location.hostname ||
                    // port
                (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (window.location.port || (window.location.protocol === "http:" ? 80 : 443))
                ));
                return window.EventSource && (!crossOrigin || !atmosphere.util.browser.safari || atmosphere.util.browser.vmajor >= 7);
            }

            /**
             * Open request using request transport. <br>
             * If request transport is 'websocket' but websocket can't be opened, request will automatically reconnect using fallback transport.
             *
             * @private
             */
            function _execute() {
                // Shared across multiple tabs/windows.
                if (_request.shared) {
                    _localStorageService = _local(_request);
                    if (_localStorageService != null) {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Storage service available. All communication will be local");
                        }

                        if (_localStorageService.open(_request)) {
                            // Local connection.
                            return;
                        }
                    }

                    if (_canLog('debug')) {
                        atmosphere.util.debug("No Storage service available.");
                    }
                    // Wasn't local or an error occurred
                    _localStorageService = null;
                }

                // Protocol
                _request.firstMessage = uuid == 0 ? true : false;
                _request.isOpen = false;
                _request.ctime = atmosphere.util.now();

                // We carry any UUID set by the user or from a previous connection.
                if (_request.uuid === 0) {
                    _request.uuid = uuid;
                }
                _response.closedByClientTimeout = false;

                if (_request.transport !== 'websocket' && _request.transport !== 'sse') {
                    _executeRequest(_request);

                } else if (_request.transport === 'websocket') {
                    if (!_supportWebsocket()) {
                        _reconnectWithFallbackTransport("Websocket is not supported, using request.fallbackTransport (" + _request.fallbackTransport
                        + ")");
                    } else {
                        _executeWebSocket(false);
                    }
                } else if (_request.transport === 'sse') {
                    if (!_supportSSE()) {
                        _reconnectWithFallbackTransport("Server Side Events(SSE) is not supported, using request.fallbackTransport ("
                        + _request.fallbackTransport + ")");
                    } else {
                        _executeSSE(false);
                    }
                }
            }

            function _local(request) {
                var trace, connector, orphan, name = "atmosphere-" + request.url, connectors = {
                    storage: function () {
                        function onstorage(event) {
                            if (event.key === name && event.newValue) {
                                listener(event.newValue);
                            }
                        }

                        if (!atmosphere.util.storage) {
                            return;
                        }

                        var storage = window.localStorage,
                            get = function (key) {
                                return atmosphere.util.parseJSON(storage.getItem(name + "-" + key));
                            },
                            set = function (key, value) {
                                storage.setItem(name + "-" + key, atmosphere.util.stringifyJSON(value));
                            };

                        return {
                            init: function () {
                                set("children", get("children").concat([guid]));
                                atmosphere.util.on(window, "storage", onstorage);
                                return get("opened");
                            },
                            signal: function (type, data) {
                                storage.setItem(name, atmosphere.util.stringifyJSON({
                                    target: "p",
                                    type: type,
                                    data: data
                                }));
                            },
                            close: function () {
                                var children = get("children");

                                atmosphere.util.off(window, "storage", onstorage);
                                if (children) {
                                    if (removeFromArray(children, request.id)) {
                                        set("children", children);
                                    }
                                }
                            }
                        };
                    },
                    windowref: function () {
                        var win = window.open("", name.replace(/\W/g, ""));

                        if (!win || win.closed || !win.callbacks) {
                            return;
                        }

                        return {
                            init: function () {
                                win.callbacks.push(listener);
                                win.children.push(guid);
                                return win.opened;
                            },
                            signal: function (type, data) {
                                if (!win.closed && win.fire) {
                                    win.fire(atmosphere.util.stringifyJSON({
                                        target: "p",
                                        type: type,
                                        data: data
                                    }));
                                }
                            },
                            close: function () {
                                // Removes traces only if the parent is alive
                                if (!orphan) {
                                    removeFromArray(win.callbacks, listener);
                                    removeFromArray(win.children, guid);
                                }
                            }

                        };
                    }
                };

                function removeFromArray(array, val) {
                    var i, length = array.length;

                    for (i = 0; i < length; i++) {
                        if (array[i] === val) {
                            array.splice(i, 1);
                        }
                    }

                    return length !== array.length;
                }

                // Receives open, close and message command from the parent
                function listener(string) {
                    var command = atmosphere.util.parseJSON(string), data = command.data;

                    if (command.target === "c") {
                        switch (command.type) {
                            case "open":
                                _open("opening", 'local', _request);
                                break;
                            case "close":
                                if (!orphan) {
                                    orphan = true;
                                    if (data.reason === "aborted") {
                                        _close();
                                    } else {
                                        // Gives the heir some time to reconnect
                                        if (data.heir === guid) {
                                            _execute();
                                        } else {
                                            setTimeout(function () {
                                                _execute();
                                            }, 100);
                                        }
                                    }
                                }
                                break;
                            case "message":
                                _prepareCallback(data, "messageReceived", 200, request.transport);
                                break;
                            case "localMessage":
                                _localMessage(data);
                                break;
                        }
                    }
                }

                function findTrace() {
                    var matcher = new RegExp("(?:^|; )(" + encodeURIComponent(name) + ")=([^;]*)").exec(document.cookie);
                    if (matcher) {
                        return atmosphere.util.parseJSON(decodeURIComponent(matcher[2]));
                    }
                }

                // Finds and validates the parent socket's trace from the cookie
                trace = findTrace();
                if (!trace || atmosphere.util.now() - trace.ts > 1000) {
                    return;
                }

                // Chooses a connector
                connector = connectors.storage() || connectors.windowref();
                if (!connector) {
                    return;
                }

                return {
                    open: function () {
                        var parentOpened;

                        // Checks the shared one is alive
                        _traceTimer = setInterval(function () {
                            var oldTrace = trace;
                            trace = findTrace();
                            if (!trace || oldTrace.ts === trace.ts) {
                                // Simulates a close signal
                                listener(atmosphere.util.stringifyJSON({
                                    target: "c",
                                    type: "close",
                                    data: {
                                        reason: "error",
                                        heir: oldTrace.heir
                                    }
                                }));
                            }
                        }, 1000);

                        parentOpened = connector.init();
                        if (parentOpened) {
                            // Firing the open event without delay robs the user of the opportunity to bind connecting event handlers
                            setTimeout(function () {
                                _open("opening", 'local', request);
                            }, 50);
                        }
                        return parentOpened;
                    },
                    send: function (event) {
                        connector.signal("send", event);
                    },
                    localSend: function (event) {
                        connector.signal("localSend", atmosphere.util.stringifyJSON({
                            id: guid,
                            event: event
                        }));
                    },
                    close: function () {
                        // Do not signal the parent if this method is executed by the unload event handler
                        if (!_abortingConnection) {
                            clearInterval(_traceTimer);
                            connector.signal("close");
                            connector.close();
                        }
                    }
                };
            }

            function share() {
                var storageService, name = "atmosphere-" + _request.url, servers = {
                    // Powered by the storage event and the localStorage
                    // http://www.w3.org/TR/webstorage/#event-storage
                    storage: function () {
                        function onstorage(event) {
                            // When a deletion, newValue initialized to null
                            if (event.key === name && event.newValue) {
                                listener(event.newValue);
                            }
                        }

                        if (!atmosphere.util.storage) {
                            return;
                        }

                        var storage = window.localStorage;

                        return {
                            init: function () {
                                // Handles the storage event
                                atmosphere.util.on(window, "storage", onstorage);
                            },
                            signal: function (type, data) {
                                storage.setItem(name, atmosphere.util.stringifyJSON({
                                    target: "c",
                                    type: type,
                                    data: data
                                }));
                            },
                            get: function (key) {
                                return atmosphere.util.parseJSON(storage.getItem(name + "-" + key));
                            },
                            set: function (key, value) {
                                storage.setItem(name + "-" + key, atmosphere.util.stringifyJSON(value));
                            },
                            close: function () {
                                atmosphere.util.off(window, "storage", onstorage);
                                storage.removeItem(name);
                                storage.removeItem(name + "-opened");
                                storage.removeItem(name + "-children");
                            }

                        };
                    },
                    // Powered by the window.open method
                    // https://developer.mozilla.org/en/DOM/window.open
                    windowref: function () {
                        // Internet Explorer raises an invalid argument error
                        // when calling the window.open method with the name containing non-word characters
                        var neim = name.replace(/\W/g, ""), container = document.getElementById(neim), win;

                        if (!container) {
                            container = document.createElement("div");
                            container.id = neim;
                            container.style.display = "none";
                            container.innerHTML = '<iframe name="' + neim + '" />';
                            document.body.appendChild(container);
                        }

                        win = container.firstChild.contentWindow;

                        return {
                            init: function () {
                                // Callbacks from different windows
                                win.callbacks = [listener];
                                // In IE 8 and less, only string argument can be safely passed to the function in other window
                                win.fire = function (string) {
                                    var i;

                                    for (i = 0; i < win.callbacks.length; i++) {
                                        win.callbacks[i](string);
                                    }
                                };
                            },
                            signal: function (type, data) {
                                if (!win.closed && win.fire) {
                                    win.fire(atmosphere.util.stringifyJSON({
                                        target: "c",
                                        type: type,
                                        data: data
                                    }));
                                }
                            },
                            get: function (key) {
                                return !win.closed ? win[key] : null;
                            },
                            set: function (key, value) {
                                if (!win.closed) {
                                    win[key] = value;
                                }
                            },
                            close: function () {
                            }
                        };
                    }
                };

                // Receives send and close command from the children
                function listener(string) {
                    var command = atmosphere.util.parseJSON(string), data = command.data;

                    if (command.target === "p") {
                        switch (command.type) {
                            case "send":
                                _push(data);
                                break;
                            case "localSend":
                                _localMessage(data);
                                break;
                            case "close":
                                _close();
                                break;
                        }
                    }
                }

                _localSocketF = function propagateMessageEvent(context) {
                    storageService.signal("message", context);
                };

                function leaveTrace() {
                    document.cookie = _sharingKey + "=" +
                        // Opera's JSON implementation ignores a number whose a last digit of 0 strangely
                        // but has no problem with a number whose a last digit of 9 + 1
                    encodeURIComponent(atmosphere.util.stringifyJSON({
                        ts: atmosphere.util.now() + 1,
                        heir: (storageService.get("children") || [])[0]
                    })) + "; path=/";
                }

                // Chooses a storageService
                storageService = servers.storage() || servers.windowref();
                storageService.init();

                if (_canLog('debug')) {
                    atmosphere.util.debug("Installed StorageService " + storageService);
                }

                // List of children sockets
                storageService.set("children", []);

                if (storageService.get("opened") != null && !storageService.get("opened")) {
                    // Flag indicating the parent socket is opened
                    storageService.set("opened", false);
                }
                // Leaves traces
                _sharingKey = encodeURIComponent(name);
                leaveTrace();
                _traceTimer = setInterval(leaveTrace, 1000);

                _storageService = storageService;
            }

            /**
             * @private
             */
            function _open(state, transport, request) {
                if (_request.shared && transport !== 'local') {
                    share();
                }

                if (_storageService != null) {
                    _storageService.set("opened", true);
                }

                request.close = function () {
                    _close();
                };

                if (_requestCount > 0 && state === 're-connecting') {
                    request.isReopen = true;
                    _tryingToReconnect(_response);
                } else if (_response.error == null) {
                    _response.request = request;
                    var prevState = _response.state;
                    _response.state = state;
                    var prevTransport = _response.transport;
                    _response.transport = transport;

                    var _body = _response.responseBody;
                    _invokeCallback();
                    _response.responseBody = _body;

                    _response.state = prevState;
                    _response.transport = prevTransport;
                }
            }

            /**
             * Execute request using jsonp transport.
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             * @private
             */
            function _jsonp(request) {
                // When CORS is enabled, make sure we force the proper transport.
                request.transport = "jsonp";

                var rq = _request, script;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                _jqxhr = {
                    open: function () {
                        var callback = "atmosphere" + (++guid);

                        function _reconnectOnFailure() {
                            rq.lastIndex = 0;

                            if (rq.openId) {
                                clearTimeout(rq.openId);
                            }

                            if (rq.heartbeatTimer) {
                                clearTimeout(rq.heartbeatTimer);
                            }

                            if (rq.reconnect && _requestCount++ < rq.maxReconnectOnClose) {
                                _open('re-connecting', rq.transport, rq);
                                _reconnect(_jqxhr, rq, request.reconnectInterval);
                                rq.openId = setTimeout(function () {
                                    _triggerOpen(rq);
                                }, rq.reconnectInterval + 1000);
                            } else {
                                _onError(0, "maxReconnectOnClose reached");
                            }
                        }

                        function poll() {
                            var url = rq.url;
                            if (rq.dispatchUrl != null) {
                                url += rq.dispatchUrl;
                            }

                            var data = rq.data;
                            if (rq.attachHeadersAsQueryString) {
                                url = _attachHeaders(rq);
                                if (data !== '') {
                                    url += "&X-Atmosphere-Post-Body=" + encodeURIComponent(data);
                                }
                                data = '';
                            }

                            var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;

                            script = document.createElement("script");
                            script.src = url + "&jsonpTransport=" + callback;
                            //script.async = rq.async;
                            script.clean = function () {
                                script.clean = script.onerror = script.onload = script.onreadystatechange = null;
                                if (script.parentNode) {
                                    script.parentNode.removeChild(script);
                                }

                                if (++request.scriptCount === 2) {
                                    request.scriptCount = 1;
                                    _reconnectOnFailure();
                                }

                            };
                            script.onload = script.onreadystatechange = function () {
                                _debug("jsonp.onload");
                                if (!script.readyState || /loaded|complete/.test(script.readyState)) {
                                    script.clean();
                                }
                            };

                            script.onerror = function () {
                                _debug("jsonp.onerror");
                                request.scriptCount = 1;
                                script.clean();
                            };

                            head.insertBefore(script, head.firstChild);
                        }

                        // Attaches callback
                        window[callback] = function (msg) {
                            _debug("jsonp.window");
                            request.scriptCount = 0;
                            if (rq.reconnect && rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest) {

                                // _readHeaders(_jqxhr, rq);
                                if (!rq.executeCallbackBeforeReconnect) {
                                    _reconnect(_jqxhr, rq, rq.pollingInterval);
                                }

                                if (msg != null && typeof msg !== 'string') {
                                    try {
                                        msg = msg.message;
                                    } catch (err) {
                                        // The message was partial
                                    }
                                }
                                var skipCallbackInvocation = _trackMessageSize(msg, rq, _response);
                                if (!skipCallbackInvocation) {
                                    _prepareCallback(_response.responseBody, "messageReceived", 200, rq.transport);
                                }

                                if (rq.executeCallbackBeforeReconnect) {
                                    _reconnect(_jqxhr, rq, rq.pollingInterval);
                                }
                                _timeout(rq);
                            } else {
                                atmosphere.util.log(_request.logLevel, ["JSONP reconnect maximum try reached " + _request.requestCount]);
                                _onError(0, "maxRequest reached");
                            }
                        };
                        setTimeout(function () {
                            poll();
                        }, 50);
                    },
                    abort: function () {
                        if (script && script.clean) {
                            script.clean();
                        }
                    }
                };
                _jqxhr.open();
            }

            /**
             * Build websocket object.
             *
             * @param location {string} Web socket url.
             * @returns {websocket} Web socket object.
             * @private
             */
            function _getWebSocket(location) {
                if (_request.webSocketImpl != null) {
                    return _request.webSocketImpl;
                } else {
                    if (window.WebSocket) {
                        return new WebSocket(location);
                    } else {
                        return new MozWebSocket(location);
                    }
                }
            }

            /**
             * Build web socket url from request url.
             *
             * @return {string} Web socket url (start with "ws" or "wss" for secure web socket).
             * @private
             */
            function _buildWebSocketUrl() {
                return _attachHeaders(_request, atmosphere.util.getAbsoluteURL(_request.webSocketUrl || _request.url)).replace(/^http/, "ws");
            }

            /**
             * Build SSE url from request url.
             *
             * @return a url with Atmosphere's headers
             * @private
             */
            function _buildSSEUrl() {
                var url = _attachHeaders(_request);
                return url;
            }

            /**
             * Open SSE. <br>
             * Automatically use fallback transport if SSE can't be opened.
             *
             * @private
             */
            function _executeSSE(sseOpened) {

                _response.transport = "sse";

                var location = _buildSSEUrl();

                if (_canLog('debug')) {
                    atmosphere.util.debug("Invoking executeSSE");
                    atmosphere.util.debug("Using URL: " + location);
                }

                if (sseOpened && !_request.reconnect) {
                    if (_sse != null) {
                        _clearState();
                    }
                    return;
                }

                try {
                    _sse = new EventSource(location, {
                        withCredentials: _request.withCredentials
                    });
                } catch (e) {
                    _onError(0, e);
                    _reconnectWithFallbackTransport("SSE failed. Downgrading to fallback transport and resending");
                    return;
                }

                if (_request.connectTimeout > 0) {
                    _request.id = setTimeout(function () {
                        if (!sseOpened) {
                            _clearState();
                        }
                    }, _request.connectTimeout);
                }

                _sse.onopen = function (event) {
                    _debug("sse.onopen");
                    _timeout(_request);
                    if (_canLog('debug')) {
                        atmosphere.util.debug("SSE successfully opened");
                    }

                    if (!_request.enableProtocol) {
                        if (!sseOpened) {
                            _open('opening', "sse", _request);
                        } else {
                            _open('re-opening', "sse", _request);
                        }
                    } else if (_request.isReopen) {
                        _request.isReopen = false;
                        _open('re-opening', _request.transport, _request);
                    }

                    sseOpened = true;

                    if (_request.method === 'POST') {
                        _response.state = "messageReceived";
                        _sse.send(_request.data);
                    }
                };

                _sse.onmessage = function (message) {
                    _debug("sse.onmessage");
                    _timeout(_request);

                    if (!_request.enableXDR && window.location.host && message.origin && message.origin !== window.location.protocol + "//" + window.location.host) {
                        atmosphere.util.log(_request.logLevel, ["Origin was not " + window.location.protocol + "//" + window.location.host]);
                        return;
                    }

                    _response.state = 'messageReceived';
                    _response.status = 200;

                    message = message.data;
                    var skipCallbackInvocation = _trackMessageSize(message, _request, _response);

                    // https://github.com/remy/polyfills/blob/master/EventSource.js
                    // Since we polling.
                    /* if (_sse.URL) {
                     _sse.interval = 100;
                     _sse.URL = _buildSSEUrl();
                     } */

                    if (!skipCallbackInvocation) {
                        _invokeCallback();
                        _response.responseBody = '';
                        _response.messages = [];
                    }
                };

                _sse.onerror = function (message) {
                    _debug("sse.onerror");
                    clearTimeout(_request.id);

                    if (_request.heartbeatTimer) {
                        clearTimeout(_request.heartbeatTimer);
                    }

                    if (_response.closedByClientTimeout) {
                        return;
                    }

                    _invokeClose(sseOpened);
                    _clearState();

                    if (_abortingConnection) {
                        atmosphere.util.log(_request.logLevel, ["SSE closed normally"]);
                    } else if (!sseOpened) {
                        _reconnectWithFallbackTransport("SSE failed. Downgrading to fallback transport and resending");
                    } else if (_request.reconnect && (_response.transport === 'sse')) {
                        if (_requestCount++ < _request.maxReconnectOnClose) {
                            _open('re-connecting', _request.transport, _request);
                            if (_request.reconnectInterval > 0) {
                                _request.reconnectId = setTimeout(function () {
                                    _executeSSE(true);
                                }, _request.reconnectInterval);
                            } else {
                                _executeSSE(true);
                            }
                            _response.responseBody = "";
                            _response.messages = [];
                        } else {
                            atmosphere.util.log(_request.logLevel, ["SSE reconnect maximum try reached " + _requestCount]);
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };
            }

            /**
             * Open web socket. <br>
             * Automatically use fallback transport if web socket can't be opened.
             *
             * @private
             */
            function _executeWebSocket(webSocketOpened) {

                _response.transport = "websocket";

                var location = _buildWebSocketUrl(_request.url);
                if (_canLog('debug')) {
                    atmosphere.util.debug("Invoking executeWebSocket, using URL: " + location);
                }

                if (webSocketOpened && !_request.reconnect) {
                    if (_websocket != null) {
                        _clearState();
                    }
                    return;
                }

                _websocket = _getWebSocket(location);
                if (_request.webSocketBinaryType != null) {
                    _websocket.binaryType = _request.webSocketBinaryType;
                }

                if (_request.connectTimeout > 0) {
                    _request.id = setTimeout(function () {
                        if (!webSocketOpened) {
                            var _message = {
                                code: 1002,
                                reason: "",
                                wasClean: false
                            };
                            _websocket.onclose(_message);
                            // Close it anyway
                            try {
                                _clearState();
                            } catch (e) {
                            }
                            return;
                        }

                    }, _request.connectTimeout);
                }

                _websocket.onopen = function (message) {
                    _debug("websocket.onopen");
                    _timeout(_request);
                    offline = false;

                    if (_canLog('debug')) {
                        atmosphere.util.debug("Websocket successfully opened");
                    }

                    var reopening = webSocketOpened;

                    if (_websocket != null) {
                        _websocket.canSendMessage = true;
                    }

                    if (!_request.enableProtocol) {
                        webSocketOpened = true;
                        if (reopening) {
                            _open('re-opening', "websocket", _request);
                        } else {
                            _open('opening', "websocket", _request);
                        }
                    }

                    if (_websocket != null) {
                        if (_request.method === 'POST') {
                            _response.state = "messageReceived";
                            _websocket.send(_request.data);
                        }
                    }
                };

                _websocket.onmessage = function (message) {
                    _debug("websocket.onmessage");
                    _timeout(_request);

                    // We only consider it opened if we get the handshake data
                    // https://github.com/Atmosphere/atmosphere-javascript/issues/74
                    if (_request.enableProtocol) {
                        webSocketOpened = true;
                    }

                    _response.state = 'messageReceived';
                    _response.status = 200;

                    message = message.data;
                    var isString = typeof (message) === 'string';
                    if (isString) {
                        var skipCallbackInvocation = _trackMessageSize(message, _request, _response);
                        if (!skipCallbackInvocation) {
                            _invokeCallback();
                            _response.responseBody = '';
                            _response.messages = [];
                        }
                    } else {
                        message = _handleProtocol(_request, message);
                        if (message === "")
                            return;

                        _response.responseBody = message;
                        _invokeCallback();
                        _response.responseBody = null;
                    }
                };

                _websocket.onerror = function (message) {
                    _debug("websocket.onerror");
                    clearTimeout(_request.id);

                    if (_request.heartbeatTimer) {
                        clearTimeout(_request.heartbeatTimer);
                    }
                };

                _websocket.onclose = function (message) {
                    _debug("websocket.onclose");
                    clearTimeout(_request.id);
                    if (_response.state === 'closed')
                        return;

                    var reason = message.reason;
                    if (reason === "") {
                        switch (message.code) {
                            case 1000:
                                reason = "Normal closure; the connection successfully completed whatever purpose for which it was created.";
                                break;
                            case 1001:
                                reason = "The endpoint is going away, either because of a server failure or because the "
                                + "browser is navigating away from the page that opened the connection.";
                                break;
                            case 1002:
                                reason = "The endpoint is terminating the connection due to a protocol error.";
                                break;
                            case 1003:
                                reason = "The connection is being terminated because the endpoint received data of a type it "
                                + "cannot accept (for example, a text-only endpoint received binary data).";
                                break;
                            case 1004:
                                reason = "The endpoint is terminating the connection because a data frame was received that is too large.";
                                break;
                            case 1005:
                                reason = "Unknown: no status code was provided even though one was expected.";
                                break;
                            case 1006:
                                reason = "Connection was closed abnormally (that is, with no close frame being sent).";
                                break;
                        }
                    }

                    if (_canLog('warn')) {
                        atmosphere.util.warn("Websocket closed, reason: " + reason + ' - wasClean: ' + message.wasClean);
                    }

                    if (_response.closedByClientTimeout || (_request.handleOnlineOffline && offline)) {
                        // IFF online/offline events are handled and we happen to be offline, we stop all reconnect attempts and
                        // resume them in the "online" event (if we get here in that case, something else went wrong as the
                        // offline handler should stop any reconnect attempt).
                        //
                        // On the other hand, if we DO NOT handle online/offline events, we continue as before with reconnecting
                        // even if we are offline. Failing to do so would stop all reconnect attemps forever.
                        if (_request.reconnectId) {
                            clearTimeout(_request.reconnectId);
                            delete _request.reconnectId;
                        }
                        return;
                    }

                    _invokeClose(webSocketOpened);

                    _response.state = 'closed';

                    if (_abortingConnection) {
                        atmosphere.util.log(_request.logLevel, ["Websocket closed normally"]);
                    } else if (!webSocketOpened) {
                        _reconnectWithFallbackTransport("Websocket failed on first connection attempt. Downgrading to " + _request.fallbackTransport + " and resending");

                    } else if (_request.reconnect && _response.transport === 'websocket' ) {
                        _clearState();
                        if (_requestCount++ < _request.maxReconnectOnClose) {
                            _open('re-connecting', _request.transport, _request);
                            if (_request.reconnectInterval > 0) {
                                _request.reconnectId = setTimeout(function () {
                                    _response.responseBody = "";
                                    _response.messages = [];
                                    _executeWebSocket(true);
                                }, _request.reconnectInterval);
                            } else {
                                _response.responseBody = "";
                                _response.messages = [];
                                _executeWebSocket(true);
                            }
                        } else {
                            atmosphere.util.log(_request.logLevel, ["Websocket reconnect maximum try reached " + _requestCount]);
                            if (_canLog('warn')) {
                                atmosphere.util.warn("Websocket error, reason: " + message.reason);
                            }
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };

                var ua = navigator.userAgent.toLowerCase();
                var isAndroid = ua.indexOf("android") > -1;
                if (isAndroid && _websocket.url === undefined) {
                    // Android 4.1 does not really support websockets and fails silently
                    _websocket.onclose({
                        reason: "Android 4.1 does not support websockets.",
                        wasClean: false
                    });
                }
            }

            function _handleProtocol(request, message) {

                var nMessage = message;
                if (request.transport === 'polling') return nMessage;

                if (request.enableProtocol && request.firstMessage && atmosphere.util.trim(message).length !== 0) {
                    var pos = request.trackMessageLength ? 1 : 0;
                    var messages = message.split(request.messageDelimiter);

                    if (messages.length <= pos + 1) {
                        // Something went wrong, normally with IE or when a message is written before the
                        // handshake has been received.
                        return nMessage;
                    }

                    request.firstMessage = false;
                    request.uuid = atmosphere.util.trim(messages[pos]);

                    if (messages.length <= pos + 2) {
                        atmosphere.util.log('error', ["Protocol data not sent by the server. " +
                        "If you enable protocol on client side, be sure to install JavascriptProtocol interceptor on server side." +
                        "Also note that atmosphere-runtime 2.2+ should be used."]);
                    }

                    _heartbeatInterval = parseInt(atmosphere.util.trim(messages[pos + 1]), 10);
                    _heartbeatPadding = messages[pos + 2];

                    if (request.transport !== 'long-polling') {
                        _triggerOpen(request);
                    }
                    uuid = request.uuid;
                    nMessage = "";

                    // We have trailing messages
                    pos = request.trackMessageLength ? 4 : 3;
                    if (messages.length > pos + 1) {
                        for (var i = pos; i < messages.length; i++) {
                            nMessage += messages[i];
                            if (i + 1 !== messages.length) {
                                nMessage += request.messageDelimiter;
                            }
                        }
                    }

                    if (request.ackInterval !== 0) {
                        setTimeout(function () {
                            _push("...ACK...");
                        }, request.ackInterval);
                    }
                } else if (request.enableProtocol && request.firstMessage && atmosphere.util.browser.msie && +atmosphere.util.browser.version.split(".")[0] < 10) {
                    // In case we are getting some junk from IE
                    atmosphere.util.log(_request.logLevel, ["Receiving unexpected data from IE"]);
                } else {
                    _triggerOpen(request);
                }
                return nMessage;
            }

            function _timeout(_request) {
                clearTimeout(_request.id);
                if (_request.timeout > 0 && _request.transport !== 'polling') {
                    _request.id = setTimeout(function () {
                        _onClientTimeout(_request);
                        _disconnect();
                        _clearState();
                    }, _request.timeout);
                }
            }

            function _onClientTimeout(_request) {
                _response.closedByClientTimeout = true;
                _response.state = 'closedByClient';
                _response.responseBody = "";
                _response.status = 408;
                _response.messages = [];
                _invokeCallback();
            }

            function _onError(code, reason) {
                _clearState();
                clearTimeout(_request.id);
                _response.state = 'error';
                _response.reasonPhrase = reason;
                _response.responseBody = "";
                _response.status = code;
                _response.messages = [];
                _invokeCallback();
            }

            /**
             * Track received message and make sure callbacks/functions are only invoked when the complete message has been received.
             *
             * @param message
             * @param request
             * @param response
             */
            function _trackMessageSize(message, request, response) {
                message = _handleProtocol(request, message);
                if (message.length === 0)
                    return true;

                response.responseBody = message;

                if (request.trackMessageLength) {
                    // prepend partialMessage if any
                    message = response.partialMessage + message;

                    var messages = [];
                    var messageStart = message.indexOf(request.messageDelimiter);
                    if (messageStart != -1) {
                        while (messageStart !== -1) {
                            var str = message.substring(0, messageStart);
                            var messageLength = +str;
                            if (isNaN(messageLength))
                                throw new Error('message length "' + str + '" is not a number');
                            messageStart += request.messageDelimiter.length;
                            if (messageStart + messageLength > message.length) {
                                // message not complete, so there is no trailing messageDelimiter
                                messageStart = -1;
                            } else {
                                // message complete, so add it
                                messages.push(message.substring(messageStart, messageStart + messageLength));
                                // remove consumed characters
                                message = message.substring(messageStart + messageLength, message.length);
                                messageStart = message.indexOf(request.messageDelimiter);
                            }
                        }

                        /* keep any remaining data */
                        response.partialMessage = message;

                        if (messages.length !== 0) {
                            response.responseBody = messages.join(request.messageDelimiter);
                            response.messages = messages;
                            return false;
                        } else {
                            response.responseBody = "";
                            response.messages = [];
                            return true;
                        }
                    }
                }
                response.responseBody = message;
                response.messages = [message];
                return false;
            }

            /**
             * Reconnect request with fallback transport. <br>
             * Used in case websocket can't be opened.
             *
             * @private
             */
            function _reconnectWithFallbackTransport(errorMessage) {
                atmosphere.util.log(_request.logLevel, [errorMessage]);

                if (typeof (_request.onTransportFailure) !== 'undefined') {
                    _request.onTransportFailure(errorMessage, _request);
                } else if (typeof (atmosphere.util.onTransportFailure) !== 'undefined') {
                    atmosphere.util.onTransportFailure(errorMessage, _request);
                }

                _request.transport = _request.fallbackTransport;
                var reconnectInterval = _request.connectTimeout === -1 ? 0 : _request.connectTimeout;
                if (_request.reconnect && _request.transport !== 'none' || _request.transport == null) {
                    _request.method = _request.fallbackMethod;
                    _response.transport = _request.fallbackTransport;
                    _request.fallbackTransport = 'none';
                    if (reconnectInterval > 0) {
                        _request.reconnectId = setTimeout(function () {
                            _execute();
                        }, reconnectInterval);
                    } else {
                        _execute();
                    }
                } else {
                    _onError(500, "Unable to reconnect with fallback transport");
                }
            }

            /**
             * Get url from request and attach headers to it.
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             *
             * @returns {Object} Request object, if undefined, _request object will be used.
             * @private
             */
            function _attachHeaders(request, url) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                if (url == null) {
                    url = rq.url;
                }

                // If not enabled
                if (!rq.attachHeadersAsQueryString)
                    return url;

                // If already added
                if (url.indexOf("X-Atmosphere-Framework") !== -1) {
                    return url;
                }

                url += (url.indexOf('?') !== -1) ? '&' : '?';
                url += "X-Atmosphere-tracking-id=" + rq.uuid;
                url += "&X-Atmosphere-Framework=" + atmosphere.version;
                url += "&X-Atmosphere-Transport=" + rq.transport;

                if (rq.trackMessageLength) {
                    url += "&X-Atmosphere-TrackMessageSize=" + "true";
                }

                if (rq.heartbeat !== null && rq.heartbeat.server !== null) {
                    url += "&X-Heartbeat-Server=" + rq.heartbeat.server;
                }

                if (rq.contentType !== '') {
                    //Eurk!
                    url += "&Content-Type=" + (rq.transport === 'websocket' ? rq.contentType : encodeURIComponent(rq.contentType));
                }

                if (rq.enableProtocol) {
                    url += "&X-atmo-protocol=true";
                }

                atmosphere.util.each(rq.headers, function (name, value) {
                    var h = atmosphere.util.isFunction(value) ? value.call(this, rq, request, _response) : value;
                    if (h != null) {
                        url += "&" + encodeURIComponent(name) + "=" + encodeURIComponent(h);
                    }
                });

                return url;
            }

            function _triggerOpen(rq) {
                if (!rq.isOpen) {
                    rq.isOpen = true;
                    _open('opening', rq.transport, rq);
                } else if (rq.isReopen) {
                    rq.isReopen = false;
                    _open('re-opening', rq.transport, rq);
                } else if (_response.state === 'messageReceived' && (rq.transport === 'jsonp' || rq.transport === 'long-polling')) {
                    _openAfterResume(_response);
                } else {
                    return;
                }

                _startHeartbeat(rq);
            }

            function _startHeartbeat(rq) {
                if (rq.heartbeatTimer != null) {
                    clearTimeout(rq.heartbeatTimer);
                }

                if (!isNaN(_heartbeatInterval) && _heartbeatInterval > 0) {
                    var _pushHeartbeat = function () {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Sending heartbeat");
                        }
                        _push(_heartbeatPadding);
                        rq.heartbeatTimer = setTimeout(_pushHeartbeat, _heartbeatInterval);
                    };
                    rq.heartbeatTimer = setTimeout(_pushHeartbeat, _heartbeatInterval);
                }
            }

            /**
             * Execute ajax request. <br>
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             * @private
             */
            function _executeRequest(request) {
                var rq = _request;
                if ((request != null) || (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                rq.lastIndex = 0;
                rq.readyState = 0;

                // CORS fake using JSONP
                if ((rq.transport === 'jsonp') || ((rq.enableXDR) && (atmosphere.util.checkCORSSupport()))) {
                    _jsonp(rq);
                    return;
                }

                if (atmosphere.util.browser.msie && +atmosphere.util.browser.version.split(".")[0] < 10) {
                    if ((rq.transport === 'streaming')) {
                        if (rq.enableXDR && window.XDomainRequest) {
                            _ieXDR(rq);
                        } else {
                            _ieStreaming(rq);
                        }
                        return;
                    }

                    if ((rq.enableXDR) && (window.XDomainRequest)) {
                        _ieXDR(rq);
                        return;
                    }
                }

                var reconnectFExec = function (force) {
                    rq.lastIndex = 0;
                    _requestCount++; // Increase also when forcing reconnect as _open checks _requestCount
                    if (force || (rq.reconnect && _requestCount <= rq.maxReconnectOnClose)) {
                        var delay = force ? 0 : request.reconnectInterval; // Reconnect immediately if the server resumed the connection (timeout)
                        _response.ffTryingReconnect = true;
                        _open('re-connecting', request.transport, request);
                        _reconnect(ajaxRequest, rq, delay);
                    } else {
                        _onError(0, "maxReconnectOnClose reached");
                    }
                };

                var reconnectF = function (force){
                    if(atmosphere._beforeUnloadState){
                        // ATMOSPHERE-JAVASCRIPT-143: Delay reconnect to avoid reconnect attempts before an actual unload (we don't know if an unload will happen, yet)
                        atmosphere.util.debug(new Date() + " Atmosphere: reconnectF: execution delayed due to _beforeUnloadState flag");
                        setTimeout(function () {
                            reconnectFExec(force);
                        }, 5000);
                    }else {
                        reconnectFExec(force);
                    }
                };

                var disconnected = function () {
                    // Prevent onerror callback to be called
                    _response.errorHandled = true;
                    _clearState();
                    reconnectF(false);
                };

                if (rq.force || (rq.reconnect && (rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest))) {
                    rq.force = false;

                    var ajaxRequest = atmosphere.util.xhr();
                    ajaxRequest.hasData = false;

                    _doRequest(ajaxRequest, rq, true);

                    if (rq.suspend) {
                        _activeRequest = ajaxRequest;
                    }

                    if (rq.transport !== 'polling') {
                        _response.transport = rq.transport;

                        ajaxRequest.onabort = function () {
                            _debug("ajaxrequest.onabort")
                            _invokeClose(true);
                        };

                        ajaxRequest.onerror = function () {
                            _debug("ajaxrequest.onerror")
                            _response.error = true;
                            _response.ffTryingReconnect = true;
                            try {
                                _response.status = XMLHttpRequest.status;
                            } catch (e) {
                                _response.status = 500;
                            }

                            if (!_response.status) {
                                _response.status = 500;
                            }
                            if (!_response.errorHandled) {
                                _clearState();
                                reconnectF(false);
                            }
                        };
                    }

                    ajaxRequest.onreadystatechange = function () {
                        _debug("ajaxRequest.onreadystatechange, new state: " + ajaxRequest.readyState);
                        if (_abortingConnection) {
                            _debug("onreadystatechange has been ignored due to _abortingConnection flag");
                            return;
                        }

                        _response.error = null;
                        var skipCallbackInvocation = false;
                        var update = false;

                        if (rq.transport === 'streaming' && rq.readyState > 2 && ajaxRequest.readyState === 4) {
                            _clearState();
                            reconnectF(false);
                            return;
                        }

                        rq.readyState = ajaxRequest.readyState;

                        if (rq.transport === 'streaming' && ajaxRequest.readyState >= 3) {
                            update = true;
                        } else if (rq.transport === 'long-polling' && ajaxRequest.readyState === 4) {
                            update = true;
                        }
                        _timeout(_request);

                        if (rq.transport !== 'polling') {
                            // MSIE 9 and lower status can be higher than 1000, Chrome can be 0
                            var status = 200;
                            if (ajaxRequest.readyState === 4) {
                                status = ajaxRequest.status > 1000 ? 0 : ajaxRequest.status;
                            }

                            if (!rq.reconnectOnServerError && (status >= 300 && status < 600)) {
                                _onError(status, ajaxRequest.statusText);
                                return;
                            }

                            if (status >= 300 || status === 0) {
                                disconnected();
                                return;
                            }

                            // Firefox incorrectly send statechange 0->2 when a reconnect attempt fails. The above checks ensure that onopen is not called for these
                            if ((!rq.enableProtocol || !request.firstMessage) && ajaxRequest.readyState === 2) {
                                // Firefox incorrectly send statechange 0->2 when a reconnect attempt fails. The above checks ensure that onopen is not called for these
                                // In that case, ajaxRequest.onerror will be called just after onreadystatechange is called, so we delay the trigger until we are
                                // guarantee the connection is well established.
                                if (atmosphere.util.browser.mozilla && _response.ffTryingReconnect) {
                                    _response.ffTryingReconnect = false;
                                    setTimeout(function () {
                                        if (!_response.ffTryingReconnect) {
                                            _triggerOpen(rq);
                                        }
                                    }, 500);
                                } else {
                                    _triggerOpen(rq);
                                }
                            }

                        } else if (ajaxRequest.readyState === 4) {
                            update = true;
                        }

                        if (update) {
                            var responseText = ajaxRequest.responseText;
                            _response.errorHandled = false;

                            // IE behave the same way when resuming long-polling or when the server goes down.
                            if (rq.transport === 'long-polling' && atmosphere.util.trim(responseText).length === 0) {
                                // For browser that aren't support onabort
                                if (!ajaxRequest.hasData) {
                                    reconnectF(true);
                                } else {
                                    ajaxRequest.hasData = false;
                                }
                                return;
                            }
                            ajaxRequest.hasData = true;

                            _readHeaders(ajaxRequest, _request);

                            if (rq.transport === 'streaming') {
                                if (!atmosphere.util.browser.opera) {
                                    var message = responseText.substring(rq.lastIndex, responseText.length);
                                    skipCallbackInvocation = _trackMessageSize(message, rq, _response);

                                    rq.lastIndex = responseText.length;
                                    if (skipCallbackInvocation) {
                                        return;
                                    }
                                } else {
                                    atmosphere.util.iterate(function () {
                                        if (_response.status !== 500 && ajaxRequest.responseText.length > rq.lastIndex) {
                                            try {
                                                _response.status = ajaxRequest.status;
                                                _response.headers = atmosphere.util.parseHeaders(ajaxRequest.getAllResponseHeaders());

                                                _readHeaders(ajaxRequest, _request);

                                            } catch (e) {
                                                _response.status = 404;
                                            }
                                            _timeout(_request);

                                            _response.state = "messageReceived";
                                            var message = ajaxRequest.responseText.substring(rq.lastIndex);
                                            rq.lastIndex = ajaxRequest.responseText.length;

                                            skipCallbackInvocation = _trackMessageSize(message, rq, _response);
                                            if (!skipCallbackInvocation) {
                                                _invokeCallback();
                                            }

                                            if (_verifyStreamingLength(ajaxRequest, rq)) {
                                                _reconnectOnMaxStreamingLength(ajaxRequest, rq);
                                                return;
                                            }
                                        } else if (_response.status > 400) {
                                            // Prevent replaying the last message.
                                            rq.lastIndex = ajaxRequest.responseText.length;
                                            return false;
                                        }
                                    }, 0);
                                }
                            } else {
                                skipCallbackInvocation = _trackMessageSize(responseText, rq, _response);
                            }
                            var closeStream = _verifyStreamingLength(ajaxRequest, rq);

                            try {
                                _response.status = ajaxRequest.status;
                                _response.headers = atmosphere.util.parseHeaders(ajaxRequest.getAllResponseHeaders());

                                _readHeaders(ajaxRequest, rq);
                            } catch (e) {
                                _response.status = 404;
                            }

                            if (rq.suspend) {
                                _response.state = _response.status === 0 ? "closed" : "messageReceived";
                            } else {
                                _response.state = "messagePublished";
                            }

                            var isAllowedToReconnect = !closeStream && request.transport !== 'streaming' && request.transport !== 'polling';
                            if (isAllowedToReconnect && !rq.executeCallbackBeforeReconnect) {
                                _reconnect(ajaxRequest, rq, rq.pollingInterval);
                            }

                            if (_response.responseBody.length !== 0 && !skipCallbackInvocation)
                                _invokeCallback();

                            if (isAllowedToReconnect && rq.executeCallbackBeforeReconnect) {
                                _reconnect(ajaxRequest, rq, rq.pollingInterval);
                            }

                            if (closeStream) {
                                _reconnectOnMaxStreamingLength(ajaxRequest, rq);
                            }
                        }
                    };

                    try {
                        ajaxRequest.send(rq.data);
                        _subscribed = true;
                    } catch (e) {
                        atmosphere.util.log(rq.logLevel, ["Unable to connect to " + rq.url]);
                        _onError(0, e);
                    }

                } else {
                    if (rq.logLevel === 'debug') {
                        atmosphere.util.log(rq.logLevel, ["Max re-connection reached."]);
                    }
                    _onError(0, "maxRequest reached");
                }
            }

            function _reconnectOnMaxStreamingLength(ajaxRequest, rq) {
                _response.messages = [];
                rq.isReopen = true;
                _close();
                _abortingConnection = false;
                _reconnect(ajaxRequest, rq, 500);
            }

            /**
             * Do ajax request.
             *
             * @param ajaxRequest Ajax request.
             * @param request Request parameters.
             * @param create If ajax request has to be open.
             */
            function _doRequest(ajaxRequest, request, create) {
                // Prevent Android to cache request
                var url = request.url;
                if (request.dispatchUrl != null && request.method === 'POST') {
                    url += request.dispatchUrl;
                }
                url = _attachHeaders(request, url);
                url = atmosphere.util.prepareURL(url);

                if (create) {
                    ajaxRequest.open(request.method, url, request.async);
                    if (request.connectTimeout > 0) {
                        request.id = setTimeout(function () {
                            if (request.requestCount === 0) {
                                _clearState();
                                _prepareCallback("Connect timeout", "closed", 200, request.transport);
                            }
                        }, request.connectTimeout);
                    }
                }

                if (_request.withCredentials && _request.transport !== 'websocket') {
                    if ("withCredentials" in ajaxRequest) {
                        ajaxRequest.withCredentials = true;
                    }
                }

                if (!_request.dropHeaders) {
                    ajaxRequest.setRequestHeader("X-Atmosphere-Framework", atmosphere.version);
                    ajaxRequest.setRequestHeader("X-Atmosphere-Transport", request.transport);

                    if (request.heartbeat !== null && request.heartbeat.server !== null) {
                        ajaxRequest.setRequestHeader("X-Heartbeat-Server", ajaxRequest.heartbeat.server);
                    }

                    if (request.trackMessageLength) {
                        ajaxRequest.setRequestHeader("X-Atmosphere-TrackMessageSize", "true");
                    }
                    ajaxRequest.setRequestHeader("X-Atmosphere-tracking-id", request.uuid);

                    atmosphere.util.each(request.headers, function (name, value) {
                        var h = atmosphere.util.isFunction(value) ? value.call(this, ajaxRequest, request, create, _response) : value;
                        if (h != null) {
                            ajaxRequest.setRequestHeader(name, h);
                        }
                    });
                }

                if (request.contentType !== '') {
                    ajaxRequest.setRequestHeader("Content-Type", request.contentType);
                }
            }

            function _reconnect(ajaxRequest, request, delay) {

                if (_response.closedByClientTimeout) {
                    return;
                }

                if (request.reconnect || (request.suspend && _subscribed)) {
                    var status = 0;
                    if (ajaxRequest && ajaxRequest.readyState > 1) {
                        status = ajaxRequest.status > 1000 ? 0 : ajaxRequest.status;
                    }
                    _response.status = status === 0 ? 204 : status;
                    _response.reason = status === 0 ? "Server resumed the connection or down." : "OK";

                    clearTimeout(request.id);
                    if (request.reconnectId) {
                        clearTimeout(request.reconnectId);
                        delete request.reconnectId;
                    }

                    if (delay > 0) {
                        // For whatever reason, never cancel a reconnect timeout as it is mandatory to reconnect.
                        _request.reconnectId = setTimeout(function () {
                            _executeRequest(request);
                        }, delay);
                    } else {
                        _executeRequest(request);
                    }
                }
            }

            function _tryingToReconnect(response) {
                response.state = 're-connecting';
                _invokeFunction(response);
            }

            function _openAfterResume(response) {
                response.state = 'openAfterResume';
                _invokeFunction(response);
                response.state = 'messageReceived';
            }

            function _ieXDR(request) {
                if (request.transport !== "polling") {
                    _ieStream = _configureXDR(request);
                    _ieStream.open();
                } else {
                    _configureXDR(request).open();
                }
            }

            function _configureXDR(request) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                var transport = rq.transport;
                var lastIndex = 0;
                var xdr = new window.XDomainRequest();
                var reconnect = function () {
                    if (rq.transport === "long-polling" && (rq.reconnect && (rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest))) {
                        xdr.status = 200;
                        _ieXDR(rq);
                    }
                };

                var rewriteURL = rq.rewriteURL || function (url) {
                        // Maintaining session by rewriting URL
                        // http://stackoverflow.com/questions/6453779/maintaining-session-by-rewriting-url
                        var match = /(?:^|;\s*)(JSESSIONID|PHPSESSID)=([^;]*)/.exec(document.cookie);

                        switch (match && match[1]) {
                            case "JSESSIONID":
                                return url.replace(/;jsessionid=[^\?]*|(\?)|$/, ";jsessionid=" + match[2] + "$1");
                            case "PHPSESSID":
                                return url.replace(/\?PHPSESSID=[^&]*&?|\?|$/, "?PHPSESSID=" + match[2] + "&").replace(/&$/, "");
                        }
                        return url;
                    };

                // Handles open and message event
                xdr.onprogress = function () {
                    handle(xdr);
                };
                // Handles error event
                xdr.onerror = function () {
                    // If the server doesn't send anything back to XDR will fail with polling
                    if (rq.transport !== 'polling') {
                        _clearState();
                        if (_requestCount++ < rq.maxReconnectOnClose) {
                            if (rq.reconnectInterval > 0) {
                                rq.reconnectId = setTimeout(function () {
                                    _open('re-connecting', request.transport, request);
                                    _ieXDR(rq);
                                }, rq.reconnectInterval);
                            } else {
                                _open('re-connecting', request.transport, request);
                                _ieXDR(rq);
                            }
                        } else {
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };

                // Handles close event
                xdr.onload = function () {
                };

                var handle = function (xdr) {
                    clearTimeout(rq.id);
                    var message = xdr.responseText;

                    message = message.substring(lastIndex);
                    lastIndex += message.length;

                    if (transport !== 'polling') {
                        _timeout(rq);

                        var skipCallbackInvocation = _trackMessageSize(message, rq, _response);

                        if (transport === 'long-polling' && atmosphere.util.trim(message).length === 0)
                            return;

                        if (rq.executeCallbackBeforeReconnect) {
                            reconnect();
                        }

                        if (!skipCallbackInvocation) {
                            _prepareCallback(_response.responseBody, "messageReceived", 200, transport);
                        }

                        if (!rq.executeCallbackBeforeReconnect) {
                            reconnect();
                        }
                    }
                };

                return {
                    open: function () {
                        var url = rq.url;
                        if (rq.dispatchUrl != null) {
                            url += rq.dispatchUrl;
                        }
                        url = _attachHeaders(rq, url);
                        xdr.open(rq.method, rewriteURL(url));
                        if (rq.method === 'GET') {
                            xdr.send();
                        } else {
                            xdr.send(rq.data);
                        }

                        if (rq.connectTimeout > 0) {
                            rq.id = setTimeout(function () {
                                if (rq.requestCount === 0) {
                                    _clearState();
                                    _prepareCallback("Connect timeout", "closed", 200, rq.transport);
                                }
                            }, rq.connectTimeout);
                        }
                    },
                    close: function () {
                        xdr.abort();
                    }
                };
            }

            function _ieStreaming(request) {
                _ieStream = _configureIE(request);
                _ieStream.open();
            }

            function _configureIE(request) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                var stop;
                var doc = new window.ActiveXObject("htmlfile");

                doc.open();
                doc.close();

                var url = rq.url;
                if (rq.dispatchUrl != null) {
                    url += rq.dispatchUrl;
                }

                if (rq.transport !== 'polling') {
                    _response.transport = rq.transport;
                }

                return {
                    open: function () {
                        var iframe = doc.createElement("iframe");

                        url = _attachHeaders(rq);
                        if (rq.data !== '') {
                            url += "&X-Atmosphere-Post-Body=" + encodeURIComponent(rq.data);
                        }

                        // Finally attach a timestamp to prevent Android and IE caching.
                        url = atmosphere.util.prepareURL(url);

                        iframe.src = url;
                        doc.body.appendChild(iframe);

                        // For the server to respond in a consistent format regardless of user agent, we polls response text
                        var cdoc = iframe.contentDocument || iframe.contentWindow.document;

                        stop = atmosphere.util.iterate(function () {
                            try {
                                if (!cdoc.firstChild) {
                                    return;
                                }

                                var res = cdoc.body ? cdoc.body.lastChild : cdoc;
                                var readResponse = function () {
                                    // Clones the element not to disturb the original one
                                    var clone = res.cloneNode(true);

                                    // If the last character is a carriage return or a line feed, IE ignores it in the innerText property
                                    // therefore, we add another non-newline character to preserve it
                                    clone.appendChild(cdoc.createTextNode("."));

                                    var text = clone.innerText;

                                    text = text.substring(0, text.length - 1);
                                    return text;

                                };

                                // To support text/html content type
                                if (!cdoc.body || !cdoc.body.firstChild || cdoc.body.firstChild.nodeName.toLowerCase() !== "pre") {
                                    // Injects a plaintext element which renders text without interpreting the HTML and cannot be stopped
                                    // it is deprecated in HTML5, but still works
                                    var head = cdoc.head || cdoc.getElementsByTagName("head")[0] || cdoc.documentElement || cdoc;
                                    var script = cdoc.createElement("script");

                                    script.text = "document.write('<plaintext>')";

                                    head.insertBefore(script, head.firstChild);
                                    head.removeChild(script);

                                    // The plaintext element will be the response container
                                    res = cdoc.body.lastChild;
                                }

                                if (rq.closed) {
                                    rq.isReopen = true;
                                }

                                // Handles message and close event
                                stop = atmosphere.util.iterate(function () {
                                    var text = readResponse();
                                    if (text.length > rq.lastIndex) {
                                        _timeout(_request);

                                        _response.status = 200;
                                        _response.error = null;

                                        // Empties response every time that it is handled
                                        res.innerText = "";
                                        var skipCallbackInvocation = _trackMessageSize(text, rq, _response);
                                        if (skipCallbackInvocation) {
                                            return "";
                                        }

                                        _prepareCallback(_response.responseBody, "messageReceived", 200, rq.transport);
                                    }

                                    rq.lastIndex = 0;

                                    if (cdoc.readyState === "complete") {
                                        _invokeClose(true);
                                        _open('re-connecting', rq.transport, rq);
                                        if (rq.reconnectInterval > 0) {
                                            rq.reconnectId = setTimeout(function () {
                                                _ieStreaming(rq);
                                            }, rq.reconnectInterval);
                                        } else {
                                            _ieStreaming(rq);
                                        }
                                        return false;
                                    }
                                }, null);

                                return false;
                            } catch (err) {
                                _response.error = true;
                                _open('re-connecting', rq.transport, rq);
                                if (_requestCount++ < rq.maxReconnectOnClose) {
                                    if (rq.reconnectInterval > 0) {
                                        rq.reconnectId = setTimeout(function () {
                                            _ieStreaming(rq);
                                        }, rq.reconnectInterval);
                                    } else {
                                        _ieStreaming(rq);
                                    }
                                } else {
                                    _onError(0, "maxReconnectOnClose reached");
                                }
                                doc.execCommand("Stop");
                                doc.close();
                                return false;
                            }
                        });
                    },

                    close: function () {
                        if (stop) {
                            stop();
                        }

                        doc.execCommand("Stop");
                        _invokeClose(true);
                    }
                };
            }

            /**
             * Send message. <br>
             * Will be automatically dispatch to other connected.
             *
             * @param {Object, string} Message to send.
             * @private
             */
            function _push(message) {

                if (_localStorageService != null) {
                    _pushLocal(message);
                } else if (_activeRequest != null || _sse != null) {
                    _pushAjaxMessage(message);
                } else if (_ieStream != null) {
                    _pushIE(message);
                } else if (_jqxhr != null) {
                    _pushJsonp(message);
                } else if (_websocket != null) {
                    _pushWebSocket(message);
                } else {
                    _onError(0, "No suspended connection available");
                    atmosphere.util.error("No suspended connection available. Make sure atmosphere.subscribe has been called and request.onOpen invoked before trying to push data");
                }
            }

            function _pushOnClose(message, rq) {
                if (!rq) {
                    rq = _getPushRequest(message);
                }
                rq.transport = "polling";
                rq.method = "GET";
                rq.withCredentials = false;
                rq.reconnect = false;
                rq.force = true;
                rq.suspend = false;
                rq.timeout = 1000;
                _executeRequest(rq);
            }

            function _pushLocal(message) {
                _localStorageService.send(message);
            }

            function _intraPush(message) {
                // IE 9 will crash if not.
                if (message.length === 0)
                    return;

                try {
                    if (_localStorageService) {
                        _localStorageService.localSend(message);
                    } else if (_storageService) {
                        _storageService.signal("localMessage", atmosphere.util.stringifyJSON({
                            id: guid,
                            event: message
                        }));
                    }
                } catch (err) {
                    atmosphere.util.error(err);
                }
            }

            /**
             * Send a message using currently opened ajax request (using http-streaming or long-polling). <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushAjaxMessage(message) {
                var rq = _getPushRequest(message);
                _executeRequest(rq);
            }

            /**
             * Send a message using currently opened ie streaming (using http-streaming or long-polling). <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushIE(message) {
                if (_request.enableXDR && atmosphere.util.checkCORSSupport()) {
                    var rq = _getPushRequest(message);
                    // Do not reconnect since we are pushing.
                    rq.reconnect = false;
                    _jsonp(rq);
                } else {
                    _pushAjaxMessage(message);
                }
            }

            /**
             * Send a message using jsonp transport. <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushJsonp(message) {
                _pushAjaxMessage(message);
            }

            function _getStringMessage(message) {
                var msg = message;
                if (typeof (msg) === 'object') {
                    msg = message.data;
                }
                return msg;
            }

            /**
             * Build request use to push message using method 'POST' <br>. Transport is defined as 'polling' and 'suspend' is set to false.
             *
             * @return {Object} Request object use to push message.
             * @private
             */
            function _getPushRequest(message) {
                var msg = _getStringMessage(message);

                var rq = {
                    connected: false,
                    timeout: 60000,
                    method: 'POST',
                    url: _request.url,
                    contentType: _request.contentType,
                    headers: _request.headers,
                    reconnect: true,
                    callback: null,
                    data: msg,
                    suspend: false,
                    maxRequest: -1,
                    logLevel: 'info',
                    requestCount: 0,
                    withCredentials: _request.withCredentials,
                    async: _request.async,
                    transport: 'polling',
                    isOpen: true,
                    attachHeadersAsQueryString: true,
                    enableXDR: _request.enableXDR,
                    uuid: _request.uuid,
                    dispatchUrl: _request.dispatchUrl,
                    enableProtocol: false,
                    messageDelimiter: '|',
                    trackMessageLength: _request.trackMessageLength,
                    maxReconnectOnClose: _request.maxReconnectOnClose,
                    heartbeatTimer: _request.heartbeatTimer,
                    heartbeat: _request.heartbeat
                };

                if (typeof (message) === 'object') {
                    rq = atmosphere.util.extend(rq, message);
                }

                return rq;
            }

            /**
             * Send a message using currently opened websocket. <br>
             *
             */
            function _pushWebSocket(message) {
                var msg = atmosphere.util.isBinary(message) ? message : _getStringMessage(message);
                var data;
                try {
                    if (_request.dispatchUrl != null) {
                        data = _request.webSocketPathDelimiter + _request.dispatchUrl + _request.webSocketPathDelimiter + msg;
                    } else {
                        data = msg;
                    }

                    if (!_websocket.canSendMessage) {
                        atmosphere.util.error("WebSocket not connected.");
                        return;
                    }

                    _websocket.send(data);

                } catch (e) {
                    _websocket.onclose = function (message) {
                    };
                    _clearState();

                    _reconnectWithFallbackTransport("Websocket failed. Downgrading to " + _request.fallbackTransport + " and resending " + message);
                    _pushAjaxMessage(message);
                }
            }

            function _localMessage(message) {
                var m = atmosphere.util.parseJSON(message);
                if (m.id !== guid) {
                    if (typeof (_request.onLocalMessage) !== 'undefined') {
                        _request.onLocalMessage(m.event);
                    } else if (typeof (atmosphere.util.onLocalMessage) !== 'undefined') {
                        atmosphere.util.onLocalMessage(m.event);
                    }
                }
            }

            function _prepareCallback(messageBody, state, errorCode, transport) {

                _response.responseBody = messageBody;
                _response.transport = transport;
                _response.status = errorCode;
                _response.state = state;

                _invokeCallback();
            }

            function _readHeaders(xdr, request) {
                if (!request.readResponsesHeaders) {
                    if (!request.enableProtocol) {
                        request.uuid = guid;
                    }
                }
                else {
                    try {

                        var tempUUID = xdr.getResponseHeader('X-Atmosphere-tracking-id');
                        if (tempUUID && tempUUID != null) {
                            request.uuid = tempUUID.split(" ").pop();
                        }
                    } catch (e) {
                    }
                }
            }

            function _invokeFunction(response) {
                _f(response, _request);
                // Global
                _f(response, atmosphere.util);
            }

            function _f(response, f) {
                switch (response.state) {
                    case "messageReceived":
                        _debug("Firing onMessage");
                        _requestCount = 0;
                        if (typeof (f.onMessage) !== 'undefined')
                            f.onMessage(response);

                        if (typeof (f.onmessage) !== 'undefined')
                            f.onmessage(response);
                        break;
                    case "error":
                        var dbgReasonPhrase = (typeof(response.reasonPhrase) != 'undefined') ? response.reasonPhrase : 'n/a';
                        _debug("Firing onError, reasonPhrase: " + dbgReasonPhrase);
                        if (typeof (f.onError) !== 'undefined')
                            f.onError(response);

                        if (typeof (f.onerror) !== 'undefined')
                            f.onerror(response);
                        break;
                    case "opening":
                        delete _request.closed;
                        _debug("Firing onOpen");
                        if (typeof (f.onOpen) !== 'undefined')
                            f.onOpen(response);

                        if (typeof (f.onopen) !== 'undefined')
                            f.onopen(response);
                        break;
                    case "messagePublished":
                        _debug("Firing messagePublished");
                        if (typeof (f.onMessagePublished) !== 'undefined')
                            f.onMessagePublished(response);
                        break;
                    case "re-connecting":
                        _debug("Firing onReconnect");
                        if (typeof (f.onReconnect) !== 'undefined')
                            f.onReconnect(_request, response);
                        break;
                    case "closedByClient":
                        _debug("Firing closedByClient");
                        if (typeof (f.onClientTimeout) !== 'undefined')
                            f.onClientTimeout(_request);
                        break;
                    case "re-opening":
                        delete _request.closed;
                        _debug("Firing onReopen");
                        if (typeof (f.onReopen) !== 'undefined')
                            f.onReopen(_request, response);
                        break;
                    case "fail-to-reconnect":
                        _debug("Firing onFailureToReconnect");
                        if (typeof (f.onFailureToReconnect) !== 'undefined')
                            f.onFailureToReconnect(_request, response);
                        break;
                    case "unsubscribe":
                    case "closed":
                        var closed = typeof (_request.closed) !== 'undefined' ? _request.closed : false;

                        if (!closed) {
                            _debug("Firing onClose (" + response.state + " case)");
                            if (typeof (f.onClose) !== 'undefined') {
                                f.onClose(response);
                            }

                            if (typeof (f.onclose) !== 'undefined') {
                                f.onclose(response);
                            }
                        } else {
                            _debug("Request already closed, not firing onClose (" + response.state + " case)");
                        }
                        _request.closed = true;
                        break;
                    case "openAfterResume":
                        if (typeof (f.onOpenAfterResume) !== 'undefined')
                            f.onOpenAfterResume(_request);
                        break;
                }
            }

            function _invokeClose(wasOpen) {
                if (_response.state !== 'closed') {
                    _response.state = 'closed';
                    _response.responseBody = "";
                    _response.messages = [];
                    _response.status = !wasOpen ? 501 : 200;
                    _invokeCallback();
                }
            }

            /**
             * Invoke request callbacks.
             *
             * @private
             */
            function _invokeCallback() {
                var call = function (index, func) {
                    func(_response);
                };

                if (_localStorageService == null && _localSocketF != null) {
                    _localSocketF(_response.responseBody);
                }

                _request.reconnect = _request.mrequest;

                var isString = typeof (_response.responseBody) === 'string';
                var messages = (isString && _request.trackMessageLength) ? (_response.messages.length > 0 ? _response.messages : ['']) : new Array(
                    _response.responseBody);
                for (var i = 0; i < messages.length; i++) {

                    if (messages.length > 1 && messages[i].length === 0) {
                        continue;
                    }
                    _response.responseBody = (isString) ? atmosphere.util.trim(messages[i]) : messages[i];

                    if (_localStorageService == null && _localSocketF != null) {
                        _localSocketF(_response.responseBody);
                    }

                    if ((_response.responseBody.length === 0 ||
                        (isString && _heartbeatPadding === _response.responseBody)) && _response.state === "messageReceived") {
                        continue;
                    }

                    _invokeFunction(_response);

                    // Invoke global callbacks
                    if (callbacks.length > 0) {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Invoking " + callbacks.length + " global callbacks: " + _response.state);
                        }
                        try {
                            atmosphere.util.each(callbacks, call);
                        } catch (e) {
                            atmosphere.util.log(_request.logLevel, ["Callback exception" + e]);
                        }
                    }

                    // Invoke request callback
                    if (typeof (_request.callback) === 'function') {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Invoking request callbacks");
                        }
                        try {
                            _request.callback(_response);
                        } catch (e) {
                            atmosphere.util.log(_request.logLevel, ["Callback exception" + e]);
                        }
                    }
                }
            }

            this.subscribe = function (options) {
                _subscribe(options);
                _execute();
            };

            this.execute = function () {
                _execute();
            };

            this.close = function () {
                _close();
            };

            this.disconnect = function () {
                _disconnect();
            };

            this.getUrl = function () {
                return _request.url;
            };

            this.push = function (message, dispatchUrl) {
                if (dispatchUrl != null) {
                    var originalDispatchUrl = _request.dispatchUrl;
                    _request.dispatchUrl = dispatchUrl;
                    _push(message);
                    _request.dispatchUrl = originalDispatchUrl;
                } else {
                    _push(message);
                }
            };

            this.getUUID = function () {
                return _request.uuid;
            };

            this.pushLocal = function (message) {
                _intraPush(message);
            };

            this.enableProtocol = function (message) {
                return _request.enableProtocol;
            };

            this.init = function () {
                _init();
            };

            this.request = _request;
            this.response = _response;
        }
    };

    atmosphere.subscribe = function (url, callback, request) {
        if (typeof (callback) === 'function') {
            atmosphere.addCallback(callback);
        }

        if (typeof (url) !== "string") {
            request = url;
        } else {
            request.url = url;
        }

        // https://github.com/Atmosphere/atmosphere-javascript/issues/58
        uuid = ((typeof (request) !== 'undefined') && typeof (request.uuid) !== 'undefined') ? request.uuid : 0;

        var rq = new atmosphere.AtmosphereRequest(request);
        rq.execute();

        requests[requests.length] = rq;
        return rq;
    };

    atmosphere.unsubscribe = function () {
        if (requests.length > 0) {
            var requestsClone = [].concat(requests);
            for (var i = 0; i < requestsClone.length; i++) {
                var rq = requestsClone[i];
                rq.close();
                clearTimeout(rq.response.request.id);

                if (rq.heartbeatTimer) {
                    clearTimeout(rq.heartbeatTimer);
                }
            }
        }
        requests = [];
        callbacks = [];
    };

    atmosphere.unsubscribeUrl = function (url) {
        var idx = -1;
        if (requests.length > 0) {
            for (var i = 0; i < requests.length; i++) {
                var rq = requests[i];

                // Suppose you can subscribe once to an url
                if (rq.getUrl() === url) {
                    rq.close();
                    clearTimeout(rq.response.request.id);

                    if (rq.heartbeatTimer) {
                        clearTimeout(rq.heartbeatTimer);
                    }

                    idx = i;
                    break;
                }
            }
        }
        if (idx >= 0) {
            requests.splice(idx, 1);
        }
    };

    atmosphere.addCallback = function (func) {
        if (atmosphere.util.inArray(func, callbacks) === -1) {
            callbacks.push(func);
        }
    };

    atmosphere.removeCallback = function (func) {
        var index = atmosphere.util.inArray(func, callbacks);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    };

    atmosphere.util = {
        browser: {},

        parseHeaders: function (headerString) {
            var match, rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, headers = {};
            while (match = rheaders.exec(headerString)) {
                headers[match[1]] = match[2];
            }
            return headers;
        },

        now: function () {
            return new Date().getTime();
        },

        isArray: function (array) {
            return Object.prototype.toString.call(array) === "[object Array]";
        },

        inArray: function (elem, array) {
            if (!Array.prototype.indexOf) {
                var len = array.length;
                for (var i = 0; i < len; ++i) {
                    if (array[i] === elem) {
                        return i;
                    }
                }
                return -1;
            }
            return array.indexOf(elem);
        },

        isBinary: function (data) {
            // True if data is an instance of Blob, ArrayBuffer or ArrayBufferView
            return /^\[object\s(?:Blob|ArrayBuffer|.+Array)\]$/.test(Object.prototype.toString.call(data));
        },

        isFunction: function (fn) {
            return Object.prototype.toString.call(fn) === "[object Function]";
        },

        getAbsoluteURL: function (url) {
            if (typeof (document.createElement) === 'undefined') {
                // assuming the url to be already absolute when DOM is not supported
                return url;
            }
            var div = document.createElement("div");

            // Uses an innerHTML property to obtain an absolute URL
            div.innerHTML = '<a href="' + url + '"/>';

            // encodeURI and decodeURI are needed to normalize URL between IE and non-IE,
            // since IE doesn't encode the href property value and return it - http://jsfiddle.net/Yq9M8/1/
            return encodeURI(decodeURI(div.firstChild.href));
        },

        prepareURL: function (url) {
            // Attaches a time stamp to prevent caching
            var ts = atmosphere.util.now();
            var ret = url.replace(/([?&])_=[^&]*/, "$1_=" + ts);

            return ret + (ret === url ? (/\?/.test(url) ? "&" : "?") + "_=" + ts : "");
        },

        trim: function (str) {
            if (!String.prototype.trim) {
                return str.toString().replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, "").replace(/\s+/g, " ");
            } else {
                return str.toString().trim();
            }
        },

        param: function (params) {
            var prefix, s = [];

            function add(key, value) {
                value = atmosphere.util.isFunction(value) ? value() : (value == null ? "" : value);
                s.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }

            function buildParams(prefix, obj) {
                var name;

                if (atmosphere.util.isArray(obj)) {
                    atmosphere.util.each(obj, function (i, v) {
                        if (/\[\]$/.test(prefix)) {
                            add(prefix, v);
                        } else {
                            buildParams(prefix + "[" + (typeof v === "object" ? i : "") + "]", v);
                        }
                    });
                } else if (Object.prototype.toString.call(obj) === "[object Object]") {
                    for (name in obj) {
                        buildParams(prefix + "[" + name + "]", obj[name]);
                    }
                } else {
                    add(prefix, obj);
                }
            }

            for (prefix in params) {
                buildParams(prefix, params[prefix]);
            }

            return s.join("&").replace(/%20/g, "+");
        },

        storage: function () {
            try {
                return !!(window.localStorage && window.StorageEvent);
            } catch (e) {
                //Firefox throws an exception here, see
                //https://bugzilla.mozilla.org/show_bug.cgi?id=748620
                return false;
            }
        },

        iterate: function (fn, interval) {
            var timeoutId;

            // Though the interval is 0 for real-time application, there is a delay between setTimeout calls
            // For detail, see https://developer.mozilla.org/en/window.setTimeout#Minimum_delay_and_timeout_nesting
            interval = interval || 0;

            (function loop() {
                timeoutId = setTimeout(function () {
                    if (fn() === false) {
                        return;
                    }

                    loop();
                }, interval);
            })();

            return function () {
                clearTimeout(timeoutId);
            };
        },

        each: function (obj, callback, args) {
            if (!obj) return;
            var value, i = 0, length = obj.length, isArray = atmosphere.util.isArray(obj);

            if (args) {
                if (isArray) {
                    for (; i < length; i++) {
                        value = callback.apply(obj[i], args);

                        if (value === false) {
                            break;
                        }
                    }
                } else {
                    for (i in obj) {
                        value = callback.apply(obj[i], args);

                        if (value === false) {
                            break;
                        }
                    }
                }

                // A special, fast, case for the most common use of each
            } else {
                if (isArray) {
                    for (; i < length; i++) {
                        value = callback.call(obj[i], i, obj[i]);

                        if (value === false) {
                            break;
                        }
                    }
                } else {
                    for (i in obj) {
                        value = callback.call(obj[i], i, obj[i]);

                        if (value === false) {
                            break;
                        }
                    }
                }
            }

            return obj;
        },

        extend: function (target) {
            var i, options, name;

            for (i = 1; i < arguments.length; i++) {
                if ((options = arguments[i]) != null) {
                    for (name in options) {
                        target[name] = options[name];
                    }
                }
            }

            return target;
        },
        on: function (elem, type, fn) {
            if (elem.addEventListener) {
                elem.addEventListener(type, fn, false);
            } else if (elem.attachEvent) {
                elem.attachEvent("on" + type, fn);
            }
        },
        off: function (elem, type, fn) {
            if (elem.removeEventListener) {
                elem.removeEventListener(type, fn, false);
            } else if (elem.detachEvent) {
                elem.detachEvent("on" + type, fn);
            }
        },

        log: function (level, args) {
            if (window.console) {
                var logger = window.console[level];
                if (typeof logger === 'function') {
                    logger.apply(window.console, args);
                }
            }
        },

        warn: function () {
            atmosphere.util.log('warn', arguments);
        },

        info: function () {
            atmosphere.util.log('info', arguments);
        },

        debug: function () {
            atmosphere.util.log('debug', arguments);
        },

        error: function () {
            atmosphere.util.log('error', arguments);
        },
        xhr: function () {
            try {
                return new window.XMLHttpRequest();
            } catch (e1) {
                try {
                    return new window.ActiveXObject("Microsoft.XMLHTTP");
                } catch (e2) {
                }
            }
        },
        parseJSON: function (data) {
            return !data ? null : window.JSON && window.JSON.parse ? window.JSON.parse(data) : new Function("return " + data)();
        },
        // http://github.com/flowersinthesand/stringifyJSON
        stringifyJSON: function (value) {
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, meta = {
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };

            function quote(string) {
                return '"' + string.replace(escapable, function (a) {
                        var c = meta[a];
                        return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
                    }) + '"';
            }

            function f(n) {
                return n < 10 ? "0" + n : n;
            }

            return window.JSON && window.JSON.stringify ? window.JSON.stringify(value) : (function str(key, holder) {
                var i, v, len, partial, value = holder[key], type = typeof value;

                if (value && typeof value === "object" && typeof value.toJSON === "function") {
                    value = value.toJSON(key);
                    type = typeof value;
                }

                switch (type) {
                    case "string":
                        return quote(value);
                    case "number":
                        return isFinite(value) ? String(value) : "null";
                    case "boolean":
                        return String(value);
                    case "object":
                        if (!value) {
                            return "null";
                        }

                        switch (Object.prototype.toString.call(value)) {
                            case "[object Date]":
                                return isFinite(value.valueOf()) ? '"' + value.getUTCFullYear() + "-" + f(value.getUTCMonth() + 1) + "-"
                                + f(value.getUTCDate()) + "T" + f(value.getUTCHours()) + ":" + f(value.getUTCMinutes()) + ":" + f(value.getUTCSeconds())
                                + "Z" + '"' : "null";
                            case "[object Array]":
                                len = value.length;
                                partial = [];
                                for (i = 0; i < len; i++) {
                                    partial.push(str(i, value) || "null");
                                }

                                return "[" + partial.join(",") + "]";
                            default:
                                partial = [];
                                for (i in value) {
                                    if (hasOwn.call(value, i)) {
                                        v = str(i, value);
                                        if (v) {
                                            partial.push(quote(i) + ":" + v);
                                        }
                                    }
                                }

                                return "{" + partial.join(",") + "}";
                        }
                }
            })("", {
                "": value
            });
        },

        checkCORSSupport: function () {
            if (atmosphere.util.browser.msie && !window.XDomainRequest && +atmosphere.util.browser.version.split(".")[0] < 11) {
                return true;
            } else if (atmosphere.util.browser.opera && +atmosphere.util.browser.version.split(".") < 12.0) {
                return true;
            }

            // KreaTV 4.1 -> 4.4
            else if (atmosphere.util.trim(navigator.userAgent).slice(0, 16) === "KreaTVWebKit/531") {
                return true;
            }
            // KreaTV 3.8
            else if (atmosphere.util.trim(navigator.userAgent).slice(-7).toLowerCase() === "kreatel") {
                return true;
            }

            // Force older Android versions to use CORS as some version like 2.2.3 fail otherwise
            var ua = navigator.userAgent.toLowerCase();
            var androidVersionMatches = ua.match(/.+android ([0-9]{1,2})/i),
                majorVersion = parseInt((androidVersionMatches && androidVersionMatches[0]) || -1, 10);
            if (!isNaN(majorVersion) && majorVersion > -1 && majorVersion < 3) {
                return true;
            }
            return false;
        }
    };

    guid = atmosphere.util.now();

    // Browser sniffing
    (function () {
        var ua = navigator.userAgent.toLowerCase(),
            match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
                /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
                /(msie) ([\w.]+)/.exec(ua) ||
                /(trident)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
                ua.indexOf("android") < 0 && /version\/(.+) (safari)/.exec(ua) ||
                ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
                [];

        // Swaps variables
        if (match[2] === "safari") {
            match[2] = match[1];
            match[1] = "safari";
        }
        atmosphere.util.browser[match[1] || ""] = true;
        atmosphere.util.browser.version = match[2] || "0";
        atmosphere.util.browser.vmajor = atmosphere.util.browser.version.split(".")[0];

        // Trident is the layout engine of the Internet Explorer
        // IE 11 has no "MSIE: 11.0" token
        if (atmosphere.util.browser.trident) {
            atmosphere.util.browser.msie = true;
        }

        // The storage event of Internet Explorer and Firefox 3 works strangely
        if (atmosphere.util.browser.msie || (atmosphere.util.browser.mozilla && +atmosphere.util.browser.version.split(".")[0] === 1)) {
            atmosphere.util.storage = false;
        }
    })();

    atmosphere.util.on(window, "unload", function (event) {
        atmosphere.util.debug(new Date() + " Atmosphere: " + "unload event");
        atmosphere.unsubscribe();
    });

    atmosphere.util.on(window, "beforeunload", function (event) {
        atmosphere.util.debug(new Date() + " Atmosphere: " + "beforeunload event");

        // ATMOSPHERE-JAVASCRIPT-143: Delay reconnect to avoid reconnect attempts before an actual unload (we don't know if an unload will happen, yet)
        atmosphere._beforeUnloadState = true;
        setTimeout(function () {
            atmosphere.util.debug(new Date() + " Atmosphere: " + "beforeunload event timeout reached. Reset _beforeUnloadState flag");
            atmosphere._beforeUnloadState = false;
        }, 5000);
    });

    // Pressing ESC key in Firefox kills the connection
    // for your information, this is fixed in Firefox 20
    // https://bugzilla.mozilla.org/show_bug.cgi?id=614304
    atmosphere.util.on(window, "keypress", function (event) {
        if (event.charCode === 27 || event.keyCode === 27) {
            if (event.preventDefault) {
                event.preventDefault();
            }
        }
    });

    atmosphere.util.on(window, "offline", function () {
        atmosphere.util.debug(new Date() + " Atmosphere: offline event");
        offline = true;
        if (requests.length > 0) {
            var requestsClone = [].concat(requests);
            for (var i = 0; i < requestsClone.length; i++) {
                var rq = requestsClone[i];
                if(rq.request.handleOnlineOffline) {
                    rq.close();
                    clearTimeout(rq.response.request.id);

                    if (rq.heartbeatTimer) {
                        clearTimeout(rq.heartbeatTimer);
                    }
                }
            }
        }
    });

    atmosphere.util.on(window, "online", function () {
        atmosphere.util.debug(new Date() + " Atmosphere: online event");
        if (requests.length > 0) {
            for (var i = 0; i < requests.length; i++) {
                if(requests[i].request.handleOnlineOffline) {
                    requests[i].init();
                    requests[i].execute();
                }
            }
        }
        offline = false;
    });

    return atmosphere;
}));
/* jshint eqnull:true, noarg:true, noempty:true, eqeqeq:true, evil:true, laxbreak:true, undef:true, browser:true, indent:false, maxerr:50 */

//! moment.js
//! version : 2.13.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            m._isValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                m._isValid = m._isValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    function isUndefined(input) {
        return input === void 0;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (utils_hooks__hooks.deprecationHandler != null) {
                utils_hooks__hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(arguments).join(', ') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (utils_hooks__hooks.deprecationHandler != null) {
            utils_hooks__hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;
    utils_hooks__hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function isObject(input) {
        return Object.prototype.toString.call(input) === '[object Object]';
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    // internal storage for locale config files
    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale');
                config = mergeConfigs(locales[name]._config, config);
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    config = mergeConfigs(locales[config.parentLocale]._config, config);
                } else {
                    // treat as if there is no base config
                    deprecateSimple('parentLocaleUndefined',
                            'specified parentLocale is not defined yet');
                }
            }
            locales[name] = new Locale(config);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale;
            if (locales[name] != null) {
                config = mergeConfigs(locales[name]._config, config);
            }
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function locale_locales__listLocales() {
        return keys(locales);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function get_set__set (mom, unit, value) {
        if (mom.isValid()) {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;


    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        return isArray(this._months) ? this._months[m.month()] :
            this._months[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function units_month__handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = create_utc__createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return units_month__handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (typeof value !== 'number') {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));

        //the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? utils_hooks__hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(utils_hooks__hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // constant that refers to the ISO standard
    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (getParsingFlags(config).bigHour === true &&
                config._a[HOUR] <= 12 &&
                config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else if (isDate(input)) {
            config._d = input;
        } else {
            configFromInput(config);
        }

        if (!valid__isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date(utils_hooks__hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             if (this.isValid() && other.isValid()) {
                 return other < this ? this : other;
             } else {
                 return valid__createInvalid();
             }
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return valid__createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = ((string || '').match(matcher) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : local__createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
            } else if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(matchOffset, this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? local__createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? create_utc__createUTC(c._a) : local__createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?\d*)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format]() : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input,units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input,units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            delta, output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    utils_hooks__hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if (isFunction(Date.prototype.toISOString)) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? utils_hooks__hooks.defaultFormatUtc : utils_hooks__hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(local__createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }

        // 'date' is an alias for 'day', so it should be considered as such.
        if (units === 'date') {
            units = 'day';
        }

        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return this._offset ? new Date(this.valueOf()) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        return isArray(this._weekdays) ? this._weekdays[m.day()] :
            this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function day_of_week__handleStrictParse(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = create_utc__createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return day_of_week__handleStrictParse.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = create_utc__createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add               = add_subtract__add;
    momentPrototype__proto.calendar          = moment_calendar__calendar;
    momentPrototype__proto.clone             = clone;
    momentPrototype__proto.diff              = diff;
    momentPrototype__proto.endOf             = endOf;
    momentPrototype__proto.format            = format;
    momentPrototype__proto.from              = from;
    momentPrototype__proto.fromNow           = fromNow;
    momentPrototype__proto.to                = to;
    momentPrototype__proto.toNow             = toNow;
    momentPrototype__proto.get               = getSet;
    momentPrototype__proto.invalidAt         = invalidAt;
    momentPrototype__proto.isAfter           = isAfter;
    momentPrototype__proto.isBefore          = isBefore;
    momentPrototype__proto.isBetween         = isBetween;
    momentPrototype__proto.isSame            = isSame;
    momentPrototype__proto.isSameOrAfter     = isSameOrAfter;
    momentPrototype__proto.isSameOrBefore    = isSameOrBefore;
    momentPrototype__proto.isValid           = moment_valid__isValid;
    momentPrototype__proto.lang              = lang;
    momentPrototype__proto.locale            = locale;
    momentPrototype__proto.localeData        = localeData;
    momentPrototype__proto.max               = prototypeMax;
    momentPrototype__proto.min               = prototypeMin;
    momentPrototype__proto.parsingFlags      = parsingFlags;
    momentPrototype__proto.set               = getSet;
    momentPrototype__proto.startOf           = startOf;
    momentPrototype__proto.subtract          = add_subtract__subtract;
    momentPrototype__proto.toArray           = toArray;
    momentPrototype__proto.toObject          = toObject;
    momentPrototype__proto.toDate            = toDate;
    momentPrototype__proto.toISOString       = moment_format__toISOString;
    momentPrototype__proto.toJSON            = toJSON;
    momentPrototype__proto.toString          = toString;
    momentPrototype__proto.unix              = unix;
    momentPrototype__proto.valueOf           = to_type__valueOf;
    momentPrototype__proto.creationData      = creationData;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months            =        localeMonths;
    prototype__proto._months           = defaultLocaleMonths;
    prototype__proto.monthsShort       =        localeMonthsShort;
    prototype__proto._monthsShort      = defaultLocaleMonthsShort;
    prototype__proto.monthsParse       =        localeMonthsParse;
    prototype__proto._monthsRegex      = defaultMonthsRegex;
    prototype__proto.monthsRegex       = monthsRegex;
    prototype__proto._monthsShortRegex = defaultMonthsShortRegex;
    prototype__proto.monthsShortRegex  = monthsShortRegex;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    prototype__proto._weekdaysRegex      = defaultWeekdaysRegex;
    prototype__proto.weekdaysRegex       =        weekdaysRegex;
    prototype__proto._weekdaysShortRegex = defaultWeekdaysShortRegex;
    prototype__proto.weekdaysShortRegex  =        weekdaysShortRegex;
    prototype__proto._weekdaysMinRegex   = defaultWeekdaysMinRegex;
    prototype__proto.weekdaysMinRegex    =        weekdaysMinRegex;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = lists__get(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = locale_locales__getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return lists__get(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = lists__get(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function lists__listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function lists__listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function lists__listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function lists__listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes <= 1           && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   <= 1           && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    <= 1           && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  <= 1           && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   <= 1           && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        var seconds = iso_string__abs(this._milliseconds) / 1000;
        var days         = iso_string__abs(this._days);
        var months       = iso_string__abs(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds;
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.13.0';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.now                   = now;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.updateLocale          = updateLocale;
    utils_hooks__hooks.locales               = locale_locales__listLocales;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;
    utils_hooks__hooks.prototype             = momentPrototype;

    var _moment = utils_hooks__hooks;

    return _moment;

}));
var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.Http = (function() {
  var getParams;

  function Http(options) {
    var base;
    this.options = options;
    if (window.ActiveXObject) {
      this.xhr = new ActiveXObject('Microsoft.XMLHTTP');
    } else if (window.XMLHttpRequest) {
      this.xhr = new XMLHttpRequest;
    }
    if ((base = this.options).host == null) {
      base.host = {};
    }
  }

  Http.prototype.execute = function() {
    var contextType, isFirefox;
    if (this.xhr) {
      this.xhr.onreadystatechange = (function(_this) {
        return function() {
          var result;
          if (_this.xhr.readyState === 4 && _this.xhr.status === 200) {
            result = _this.xhr.responseText;
            if (_this.options.json && typeof JSON !== 'undefined') {
              result = JSON.parse(result);
            }
            _this.options.success && _this.options.success.apply(_this.options.host, [result, _this.xhr]);
          } else if (_this.xhr.readyState === 4) {
            _this.options.failure && _this.options.failure.apply(_this.options.host, [_this.xhr]);
          }
          return _this.options.ensure && _this.options.ensure.apply(_this.options.host, [_this.xhr]);
        };
      })(this);
      if (this.options.method === 'get') {
        this.xhr.open('GET', this.options.url + getParams(this.options.data, this.options.url), true);
      } else {
        isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (this.options.auth && !isFirefox) {
          this.xhr.open(this.options.method, this.options.url, true, this.options.user, this.options.password);
        } else {
          this.xhr.open(this.options.method, this.options.url, true);
        }
      }
      if (this.options.data) {
        contextType = this.options.json ? 'application/json' : 'application/x-www-form-urlencoded';
        this.setHeaders({
          'Content-Type': contextType
        });
      }
      this.setHeaders({
        'X-Requested-With': 'XMLHttpRequest'
      });
      if (this.options.auth) {
        this.setHeaders({
          'Authorization': 'Basic ' + btoa(this.options.user + ":" + this.options.password)
        });
        if ('withCredentials' in this.xhr) {
          this.xhr.withCredentials = 'true';
        }
      }
      this.setHeaders(this.options.headers);
      if (this.options.method === 'get') {
        return this.xhr.send();
      } else if (this.options.json) {
        return this.xhr.send(JSON.stringify(this.options.data));
      } else {
        return this.xhr.send(getParams(this.options.data));
      }
    }
  };

  Http.prototype.setHeaders = function(headers) {
    var name, results;
    results = [];
    for (name in headers) {
      results.push(this.xhr && this.xhr.setRequestHeader(name, headers[name]));
    }
    return results;
  };

  getParams = function(data, url) {
    var arr, name, str;
    arr = [];
    str = void 0;
    for (name in data) {
      arr.push(name + "=" + (encodeURIComponent(data[name])));
    }
    str = arr.join('&');
    if (str !== '') {
      if (url) {
        if (url.indexOf('?') < 0) {
          return "?" + str;
        } else {
          return "&" + str;
        }
      } else {
        return str;
      }
    }
    return '';
  };

  return Http;

})();

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
    this.recentsUrl = this.options.endPoint + "/api/events/" + this.options.contextId + "/recents";
    this.messagesReceived = 0;
    this.socket = atmosphere;
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

  Client.prototype.recents = function(params) {
    var http, limit, since, url;
    if (params == null) {
      params = {};
    }
    limit = params['limit'] || this.options.limit;
    since = params['since'] || this.options.since;
    url = this.recentsUrl;
    url += "?limit=" + limit + "&since=" + since;
    http = new Binnacle.Http({
      url: url,
      method: 'get',
      json: true,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret,
      success: this.options.onSignals
    });
    return http.execute();
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
    var request, sep;
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
    request.timeout = 86400000;
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
              _this.socket.unsubscribe();
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
    return this.socket.subscribe(request);
  };

  Client.prototype.unsubscribe = function() {
    return this.socket.unsubscribe();
  };

  Client.prototype.messagesReceived = Client.messagesReceived;

  configureMessage = function(message) {
    message.eventTime = moment(new Date(message['eventTime'])).format();
    message.clientEventTime = moment(new Date(message['clientEventTime'])).format();
    return message;
  };

  return Client;

})();
