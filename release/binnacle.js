/* ===========================================================
# Binnacle JS - v0.2.6
# ==============================================================
# Copyright (c) 2017 Brian Sam-Bodden
# Licensed .
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

/*! @license Firebase v3.7.1
    Build: 3.7.1-rc.1
    Terms: https://firebase.google.com/terms/

    ---

    typedarray.js
    Copyright (c) 2010, Linden Research, Inc.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE. */
var firebase = null; (function() { var aa="function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,c){if(c.get||c.set)throw new TypeError("ES3 does not support getters and setters.");a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value)},k="undefined"!=typeof window&&window===this?this:"undefined"!=typeof global&&null!=global?global:this,l=function(){l=function(){};k.Symbol||(k.Symbol=ba)},ca=0,ba=function(a){return"jscomp_symbol_"+(a||"")+ca++},n=function(){l();var a=k.Symbol.iterator;a||(a=k.Symbol.iterator=
k.Symbol("iterator"));"function"!=typeof Array.prototype[a]&&aa(Array.prototype,a,{configurable:!0,writable:!0,value:function(){return m(this)}});n=function(){}},m=function(a){var b=0;return da(function(){return b<a.length?{done:!1,value:a[b++]}:{done:!0}})},da=function(a){n();a={next:a};a[k.Symbol.iterator]=function(){return this};return a},q=this,r=function(){},t=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);
if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},v=function(a){return"function"==t(a)},ea=function(a,
b,c){return a.call.apply(a.bind,arguments)},fa=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},w=function(a,b,c){w=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ea:fa;return w.apply(null,arguments)},x=function(a,b){var c=Array.prototype.slice.call(arguments,
1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}},y=function(a,b){function c(){}c.prototype=b.prototype;a.ha=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.base=function(a,c,h){for(var e=Array(arguments.length-2),d=2;d<arguments.length;d++)e[d-2]=arguments[d];return b.prototype[c].apply(a,e)}};var A;A="undefined"!==typeof window?window:"undefined"!==typeof self?self:global;
var __extends=function(a,b){function c(){this.constructor=a}for(var d in b)b.hasOwnProperty(d)&&(a[d]=b[d]);a.prototype=null===b?Object.create(b):(c.prototype=b.prototype,new c)},__assign=Object.assign||function(a){for(var b,c=1,d=arguments.length;c<d;c++){b=arguments[c];for(var e in b)Object.prototype.hasOwnProperty.call(b,e)&&(a[e]=b[e])}return a},__rest=function(a,b){var c={},d;for(d in a)Object.prototype.hasOwnProperty.call(a,d)&&0>b.indexOf(d)&&(c[d]=a[d]);if(null!=a&&"function"===typeof Object.getOwnPropertySymbols){var e=
0;for(d=Object.getOwnPropertySymbols(a);e<d.length;e++)0>b.indexOf(d[e])&&(c[d[e]]=a[d[e]])}return c},__decorate=function(a,b,c,d){var e=arguments.length,h=3>e?b:null===d?d=Object.getOwnPropertyDescriptor(b,c):d,g;g=A.Reflect;if("object"===typeof g&&"function"===typeof g.decorate)h=g.decorate(a,b,c,d);else for(var f=a.length-1;0<=f;f--)if(g=a[f])h=(3>e?g(h):3<e?g(b,c,h):g(b,c))||h;return 3<e&&h&&Object.defineProperty(b,c,h),h},__metadata=function(a,b){var c=A.Reflect;if("object"===typeof c&&"function"===
typeof c.metadata)return c.metadata(a,b)},__param=function(a,b){return function(c,d){b(c,d,a)}},__awaiter=function(a,b,c,d){return new (c||(c=Promise))(function(e,h){function g(a){try{p(d.next(a))}catch(u){h(u)}}function f(a){try{p(d["throw"](a))}catch(u){h(u)}}function p(a){a.done?e(a.value):(new c(function(b){b(a.value)})).then(g,f)}p((d=d.apply(a,b)).next())})},__generator=function(a,b){function c(a){return function(b){return d([a,b])}}function d(c){if(h)throw new TypeError("Generator is already executing.");
for(;e;)try{if(h=1,g&&(f=g[c[0]&2?"return":c[0]?"throw":"next"])&&!(f=f.call(g,c[1])).done)return f;if(g=0,f)c=[0,f.value];switch(c[0]){case 0:case 1:f=c;break;case 4:return e.label++,{value:c[1],done:!1};case 5:e.label++;g=c[1];c=[0];continue;case 7:c=e.G.pop();e.I.pop();continue;default:if(!(f=e.I,f=0<f.length&&f[f.length-1])&&(6===c[0]||2===c[0])){e=0;continue}if(3===c[0]&&(!f||c[1]>f[0]&&c[1]<f[3]))e.label=c[1];else if(6===c[0]&&e.label<f[1])e.label=f[1],f=c;else if(f&&e.label<f[2])e.label=f[2],
e.G.push(c);else{f[2]&&e.G.pop();e.I.pop();continue}}c=b.call(a,e)}catch(z){c=[6,z],g=0}finally{h=f=0}if(c[0]&5)throw c[1];return{value:c[0]?c[1]:void 0,done:!0}}var e={label:0,ga:function(){if(f[0]&1)throw f[1];return f[1]},I:[],G:[]},h,g,f;return{next:c(0),"throw":c(1),"return":c(2)}};
"undefined"!==typeof A.S&&A.S||(A.__extends=__extends,A.__assign=__assign,A.__rest=__rest,A.__extends=__extends,A.__decorate=__decorate,A.__metadata=__metadata,A.__param=__param,A.__awaiter=__awaiter,A.__generator=__generator);var B=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,B);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};y(B,Error);B.prototype.name="CustomError";var ga=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")};var C=function(a,b){b.unshift(a);B.call(this,ga.apply(null,b));b.shift()};y(C,B);C.prototype.name="AssertionError";var ha=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),h=d;else a&&(e+=": "+a,h=b);throw new C(""+e,h||[]);},D=function(a,b,c){a||ha("",null,b,Array.prototype.slice.call(arguments,2))},E=function(a,b,c){v(a)||ha("Expected function but got %s: %s.",[t(a),a],b,Array.prototype.slice.call(arguments,2))};var F=function(a,b,c){this.Y=c;this.T=a;this.Z=b;this.s=0;this.o=null};F.prototype.get=function(){var a;0<this.s?(this.s--,a=this.o,this.o=a.next,a.next=null):a=this.T();return a};F.prototype.put=function(a){this.Z(a);this.s<this.Y&&(this.s++,a.next=this.o,this.o=a)};var G;a:{var ia=q.navigator;if(ia){var ja=ia.userAgent;if(ja){G=ja;break a}}G=""};var ka=function(a){q.setTimeout(function(){throw a;},0)},H,la=function(){var a=q.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&-1==G.indexOf("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+
"//"+b.location.host,a=w(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&-1==G.indexOf("Trident")&&-1==G.indexOf("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(void 0!==c.next){c=c.next;var a=c.J;c.J=null;a()}};return function(a){d.next={J:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in
document.createElement("SCRIPT")?function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){q.setTimeout(a,0)}};var I=function(){this.v=this.g=null},ma=new F(function(){return new J},function(a){a.reset()},100);I.prototype.add=function(a,b){var c=ma.get();c.set(a,b);this.v?this.v.next=c:(D(!this.g),this.g=c);this.v=c};I.prototype.remove=function(){var a=null;this.g&&(a=this.g,this.g=this.g.next,this.g||(this.v=null),a.next=null);return a};var J=function(){this.next=this.scope=this.B=null};J.prototype.set=function(a,b){this.B=a;this.scope=b;this.next=null};
J.prototype.reset=function(){this.next=this.scope=this.B=null};var M=function(a,b){K||na();L||(K(),L=!0);oa.add(a,b)},K,na=function(){if(-1!=String(q.Promise).indexOf("[native code]")){var a=q.Promise.resolve(void 0);K=function(){a.then(pa)}}else K=function(){var a=pa;!v(q.setImmediate)||q.Window&&q.Window.prototype&&-1==G.indexOf("Edge")&&q.Window.prototype.setImmediate==q.setImmediate?(H||(H=la()),H(a)):q.setImmediate(a)}},L=!1,oa=new I,pa=function(){for(var a;a=oa.remove();){try{a.B.call(a.scope)}catch(b){ka(b)}ma.put(a)}L=!1};var O=function(a,b){this.b=0;this.R=void 0;this.j=this.h=this.u=null;this.m=this.A=!1;if(a!=r)try{var c=this;a.call(b,function(a){N(c,2,a)},function(a){try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(e){}N(c,3,a)})}catch(d){N(this,3,d)}},qa=function(){this.next=this.context=this.i=this.f=this.child=null;this.w=!1};qa.prototype.reset=function(){this.context=this.i=this.f=this.child=null;this.w=!1};
var ra=new F(function(){return new qa},function(a){a.reset()},100),sa=function(a,b,c){var d=ra.get();d.f=a;d.i=b;d.context=c;return d},ua=function(a,b,c){ta(a,b,c,null)||M(x(b,a))};O.prototype.then=function(a,b,c){null!=a&&E(a,"opt_onFulfilled should be a function.");null!=b&&E(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return va(this,v(a)?a:null,v(b)?b:null,c)};O.prototype.then=O.prototype.then;O.prototype.$goog_Thenable=!0;
O.prototype.ba=function(a,b){return va(this,null,a,b)};var xa=function(a,b){a.h||2!=a.b&&3!=a.b||wa(a);D(null!=b.f);a.j?a.j.next=b:a.h=b;a.j=b},va=function(a,b,c,d){var e=sa(null,null,null);e.child=new O(function(a,g){e.f=b?function(c){try{var e=b.call(d,c);a(e)}catch(z){g(z)}}:a;e.i=c?function(b){try{var e=c.call(d,b);a(e)}catch(z){g(z)}}:g});e.child.u=a;xa(a,e);return e.child};O.prototype.da=function(a){D(1==this.b);this.b=0;N(this,2,a)};
O.prototype.ea=function(a){D(1==this.b);this.b=0;N(this,3,a)};
var N=function(a,b,c){0==a.b&&(a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself")),a.b=1,ta(c,a.da,a.ea,a)||(a.R=c,a.b=b,a.u=null,wa(a),3!=b||ya(a,c)))},ta=function(a,b,c,d){if(a instanceof O)return null!=b&&E(b,"opt_onFulfilled should be a function."),null!=c&&E(c,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),xa(a,sa(b||r,c||null,d)),!0;var e;if(a)try{e=!!a.$goog_Thenable}catch(g){e=!1}else e=!1;if(e)return a.then(b,c,d),
!0;e=typeof a;if("object"==e&&null!=a||"function"==e)try{var h=a.then;if(v(h))return za(a,h,b,c,d),!0}catch(g){return c.call(d,g),!0}return!1},za=function(a,b,c,d,e){var h=!1,g=function(a){h||(h=!0,c.call(e,a))},f=function(a){h||(h=!0,d.call(e,a))};try{b.call(a,g,f)}catch(p){f(p)}},wa=function(a){a.A||(a.A=!0,M(a.V,a))},Aa=function(a){var b=null;a.h&&(b=a.h,a.h=b.next,b.next=null);a.h||(a.j=null);null!=b&&D(null!=b.f);return b};
O.prototype.V=function(){for(var a;a=Aa(this);){var b=this.b,c=this.R;if(3==b&&a.i&&!a.w){var d;for(d=this;d&&d.m;d=d.u)d.m=!1}if(a.child)a.child.u=null,Ba(a,b,c);else try{a.w?a.f.call(a.context):Ba(a,b,c)}catch(e){Ca.call(null,e)}ra.put(a)}this.A=!1};var Ba=function(a,b,c){2==b?a.f.call(a.context,c):a.i&&a.i.call(a.context,c)},ya=function(a,b){a.m=!0;M(function(){a.m&&Ca.call(null,b)})},Ca=ka;function P(a,b){if(!(b instanceof Object))return b;switch(b.constructor){case Date:return new Date(b.getTime());case Object:void 0===a&&(a={});break;case Array:a=[];break;default:return b}for(var c in b)b.hasOwnProperty(c)&&(a[c]=P(a[c],b[c]));return a};O.all=function(a){return new O(function(b,c){var d=a.length,e=[];if(d)for(var h=function(a,c){d--;e[a]=c;0==d&&b(e)},g=function(a){c(a)},f=0,p;f<a.length;f++)p=a[f],ua(p,x(h,f),g);else b(e)})};O.resolve=function(a){if(a instanceof O)return a;var b=new O(r);N(b,2,a);return b};O.reject=function(a){return new O(function(b,c){c(a)})};O.prototype["catch"]=O.prototype.ba;var Q=O;"undefined"!==typeof Promise&&(Q=Promise);var Da=Q;function Ea(a,b){a=new R(a,b);return a.subscribe.bind(a)}var R=function(a,b){var c=this;this.a=[];this.P=0;this.task=Da.resolve();this.l=!1;this.F=b;this.task.then(function(){a(c)}).catch(function(a){c.error(a)})};R.prototype.next=function(a){S(this,function(b){b.next(a)})};R.prototype.error=function(a){S(this,function(b){b.error(a)});this.close(a)};R.prototype.complete=function(){S(this,function(a){a.complete()});this.close()};
R.prototype.subscribe=function(a,b,c){var d=this,e;if(void 0===a&&void 0===b&&void 0===c)throw Error("Missing Observer.");e=Fa(a)?a:{next:a,error:b,complete:c};void 0===e.next&&(e.next=T);void 0===e.error&&(e.error=T);void 0===e.complete&&(e.complete=T);a=this.fa.bind(this,this.a.length);this.l&&this.task.then(function(){try{d.K?e.error(d.K):e.complete()}catch(h){}});this.a.push(e);return a};
R.prototype.fa=function(a){void 0!==this.a&&void 0!==this.a[a]&&(delete this.a[a],--this.P,0===this.P&&void 0!==this.F&&this.F(this))};var S=function(a,b){if(!a.l)for(var c=0;c<a.a.length;c++)Ga(a,c,b)},Ga=function(a,b,c){a.task.then(function(){if(void 0!==a.a&&void 0!==a.a[b])try{c(a.a[b])}catch(d){"undefined"!==typeof console&&console.error&&console.error(d)}})};R.prototype.close=function(a){var b=this;this.l||(this.l=!0,void 0!==a&&(this.K=a),this.task.then(function(){b.a=void 0;b.F=void 0}))};
function Fa(a){if("object"!==typeof a||null===a)return!1;var b;b=["next","error","complete"];n();var c=b[Symbol.iterator];b=c?c.call(b):m(b);for(c=b.next();!c.done;c=b.next())if(c=c.value,c in a&&"function"===typeof a[c])return!0;return!1}function T(){};var Ha=Error.captureStackTrace,V=function(a,b){this.code=a;this.message=b;if(Ha)Ha(this,U.prototype.create);else{var c=Error.apply(this,arguments);this.name="FirebaseError";Object.defineProperty(this,"stack",{get:function(){return c.stack}})}};V.prototype=Object.create(Error.prototype);V.prototype.constructor=V;V.prototype.name="FirebaseError";var U=function(a,b,c){this.$=a;this.aa=b;this.U=c;this.pattern=/\{\$([^}]+)}/g};
U.prototype.create=function(a,b){void 0===b&&(b={});var c=this.U[a];a=this.$+"/"+a;var c=void 0===c?"Error":c.replace(this.pattern,function(a,c){a=b[c];return void 0!==a?a.toString():"<"+c+"?>"}),c=this.aa+": "+c+" ("+a+").",c=new V(a,c),d;for(d in b)b.hasOwnProperty(d)&&"_"!==d.slice(-1)&&(c[d]=b[d]);return c};var W=Q,X=function(a,b,c){var d=this;this.M=c;this.N=!1;this.c={};this.D=b;this.H=P(void 0,a);a="serviceAccount"in this.H;("credential"in this.H||a)&&"undefined"!==typeof console&&console.log("The '"+(a?"serviceAccount":"credential")+"' property specified in the first argument to initializeApp() is deprecated and will be removed in the next major version. You should instead use the 'firebase-admin' package. See https://firebase.google.com/docs/admin/setup for details on how to get started.");Object.keys(c.INTERNAL.factories).forEach(function(a){var b=
c.INTERNAL.useAsService(d,a);null!==b&&(b=d.X.bind(d,b),d[a]=b)})};X.prototype.delete=function(){var a=this;return(new W(function(b){Y(a);b()})).then(function(){a.M.INTERNAL.removeApp(a.D);var b=[];Object.keys(a.c).forEach(function(c){Object.keys(a.c[c]).forEach(function(d){b.push(a.c[c][d])})});return W.all(b.map(function(a){return a.INTERNAL.delete()}))}).then(function(){a.N=!0;a.c={}})};
X.prototype.X=function(a,b){Y(this);"undefined"===typeof this.c[a]&&(this.c[a]={});var c=b||"[DEFAULT]";return"undefined"===typeof this.c[a][c]?(b=this.M.INTERNAL.factories[a](this,this.W.bind(this),b),this.c[a][c]=b):this.c[a][c]};X.prototype.W=function(a){P(this,a)};var Y=function(a){a.N&&Z("app-deleted",{name:a.D})};k.Object.defineProperties(X.prototype,{name:{configurable:!0,enumerable:!0,get:function(){Y(this);return this.D}},options:{configurable:!0,enumerable:!0,get:function(){Y(this);return this.H}}});
X.prototype.name&&X.prototype.options||X.prototype.delete||console.log("dc");
function Ia(){function a(a){a=a||"[DEFAULT]";var b=d[a];void 0===b&&Z("no-app",{name:a});return b}function b(a,b){Object.keys(e).forEach(function(d){d=c(a,d);if(null!==d&&h[d])h[d](b,a)})}function c(a,b){if("serverAuth"===b)return null;var c=b;a=a.options;"auth"===b&&(a.serviceAccount||a.credential)&&(c="serverAuth","serverAuth"in e||Z("sa-not-supported"));return c}var d={},e={},h={},g={__esModule:!0,initializeApp:function(a,c){void 0===c?c="[DEFAULT]":"string"===typeof c&&""!==c||Z("bad-app-name",
{name:c+""});void 0!==d[c]&&Z("duplicate-app",{name:c});a=new X(a,c,g);d[c]=a;b(a,"create");void 0!=a.INTERNAL&&void 0!=a.INTERNAL.getToken||P(a,{INTERNAL:{getUid:function(){return null},getToken:function(){return W.resolve(null)},addAuthTokenListener:function(){},removeAuthTokenListener:function(){}}});return a},app:a,apps:null,Promise:W,SDK_VERSION:"0.0.0",INTERNAL:{registerService:function(b,c,d,u){e[b]&&Z("duplicate-service",{name:b});e[b]=c;u&&(h[b]=u);c=function(c){void 0===c&&(c=a());return c[b]()};
void 0!==d&&P(c,d);return g[b]=c},createFirebaseNamespace:Ia,extendNamespace:function(a){P(g,a)},createSubscribe:Ea,ErrorFactory:U,removeApp:function(a){b(d[a],"delete");delete d[a]},factories:e,useAsService:c,Promise:O,deepExtend:P}};g["default"]=g;Object.defineProperty(g,"apps",{get:function(){return Object.keys(d).map(function(a){return d[a]})}});a.App=X;return g}function Z(a,b){throw Ja.create(a,b);}
var Ja=new U("app","Firebase",{"no-app":"No Firebase App '{$name}' has been created - call Firebase App.initializeApp()","bad-app-name":"Illegal App name: '{$name}","duplicate-app":"Firebase App named '{$name}' already exists","app-deleted":"Firebase App named '{$name}' already deleted","duplicate-service":"Firebase service named '{$name}' already registered","sa-not-supported":"Initializing the Firebase SDK with a service account is only allowed in a Node.js environment. On client devices, you should instead initialize the SDK with an api key and auth domain"});"undefined"!==typeof firebase&&(firebase=Ia()); }).call(this);
firebase.SDK_VERSION = "3.7.1";
(function(){var h,aa=aa||{},l=this,ba=function(){},m=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&
!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},ca=function(a){return null===a},da=function(a){return"array"==m(a)},ea=function(a){var b=m(a);return"array"==b||"object"==b&&"number"==typeof a.length},p=function(a){return"string"==typeof a},fa=function(a){return"number"==typeof a},q=function(a){return"function"==m(a)},ga=function(a){var b=typeof a;return"object"==b&&null!=a||"function"==b},ha=function(a,b,
c){return a.call.apply(a.bind,arguments)},ia=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},r=function(a,b,c){r=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ha:ia;return r.apply(null,arguments)},ja=function(a,b){var c=Array.prototype.slice.call(arguments,
1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}},ka=Date.now||function(){return+new Date},t=function(a,b){function c(){}c.prototype=b.prototype;a.pd=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Hf=function(a,c,f){for(var d=Array(arguments.length-2),e=2;e<arguments.length;e++)d[e-2]=arguments[e];return b.prototype[c].apply(a,d)}};var u=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,u);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};t(u,Error);u.prototype.name="CustomError";var la=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")},ma=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},na=/&/g,oa=/</g,pa=/>/g,qa=/"/g,ra=/'/g,sa=/\x00/g,ta=/[\x00&<>"']/,v=function(a,b){return-1!=a.indexOf(b)},ua=function(a,b){return a<b?-1:a>b?1:0};var va=function(a,b){b.unshift(a);u.call(this,la.apply(null,b));b.shift()};t(va,u);va.prototype.name="AssertionError";
var wa=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),f=d;else a&&(e+=": "+a,f=b);throw new va(""+e,f||[]);},w=function(a,b,c){a||wa("",null,b,Array.prototype.slice.call(arguments,2))},xa=function(a,b){throw new va("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));},ya=function(a,b,c){fa(a)||wa("Expected number but got %s: %s.",[m(a),a],b,Array.prototype.slice.call(arguments,2));return a},za=function(a,b,c){p(a)||wa("Expected string but got %s: %s.",[m(a),a],b,Array.prototype.slice.call(arguments,
2))},Aa=function(a,b,c){q(a)||wa("Expected function but got %s: %s.",[m(a),a],b,Array.prototype.slice.call(arguments,2))};var Ba=Array.prototype.indexOf?function(a,b,c){w(null!=a.length);return Array.prototype.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(p(a))return p(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},x=Array.prototype.forEach?function(a,b,c){w(null!=a.length);Array.prototype.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=p(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Ca=function(a,b){for(var c=p(a)?
a.split(""):a,d=a.length-1;0<=d;--d)d in c&&b.call(void 0,c[d],d,a)},Da=Array.prototype.map?function(a,b,c){w(null!=a.length);return Array.prototype.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=p(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},Ea=Array.prototype.some?function(a,b,c){w(null!=a.length);return Array.prototype.some.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=p(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return!0;return!1},
Ga=function(a){var b;a:{b=Fa;for(var c=a.length,d=p(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1}return 0>b?null:p(a)?a.charAt(b):a[b]},Ha=function(a,b){return 0<=Ba(a,b)},Ja=function(a,b){b=Ba(a,b);var c;(c=0<=b)&&Ia(a,b);return c},Ia=function(a,b){w(null!=a.length);return 1==Array.prototype.splice.call(a,b,1).length},Ka=function(a,b){var c=0;Ca(a,function(d,e){b.call(void 0,d,e,a)&&Ia(a,e)&&c++})},La=function(a){return Array.prototype.concat.apply([],arguments)},
Ma=function(a){var b=a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return[]};var Na=function(a,b){for(var c in a)b.call(void 0,a[c],c,a)},Oa=function(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b},Pa=function(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b},Qa=function(a){for(var b in a)return!1;return!0},Ra=function(a,b){for(var c in a)if(!(c in b)||a[c]!==b[c])return!1;for(c in b)if(!(c in a))return!1;return!0},Sa=function(a){var b={},c;for(c in a)b[c]=a[c];return b},Ta="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" "),
Ua=function(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<Ta.length;f++)c=Ta[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};var Va;a:{var Wa=l.navigator;if(Wa){var Ya=Wa.userAgent;if(Ya){Va=Ya;break a}}Va=""}var y=function(a){return v(Va,a)};var Za=function(a){Za[" "](a);return a};Za[" "]=ba;var ab=function(a,b){var c=$a;return Object.prototype.hasOwnProperty.call(c,a)?c[a]:c[a]=b(a)};var bb=y("Opera"),z=y("Trident")||y("MSIE"),cb=y("Edge"),db=cb||z,eb=y("Gecko")&&!(v(Va.toLowerCase(),"webkit")&&!y("Edge"))&&!(y("Trident")||y("MSIE"))&&!y("Edge"),fb=v(Va.toLowerCase(),"webkit")&&!y("Edge"),gb=function(){var a=l.document;return a?a.documentMode:void 0},hb;
a:{var ib="",jb=function(){var a=Va;if(eb)return/rv\:([^\);]+)(\)|;)/.exec(a);if(cb)return/Edge\/([\d\.]+)/.exec(a);if(z)return/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(fb)return/WebKit\/(\S+)/.exec(a);if(bb)return/(?:Version)[ \/]?(\S+)/.exec(a)}();jb&&(ib=jb?jb[1]:"");if(z){var kb=gb();if(null!=kb&&kb>parseFloat(ib)){hb=String(kb);break a}}hb=ib}
var lb=hb,$a={},B=function(a){return ab(a,function(){for(var b=0,c=ma(String(lb)).split("."),d=ma(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",k=d[f]||"";do{g=/(\d*)(\D*)(.*)/.exec(g)||["","","",""];k=/(\d*)(\D*)(.*)/.exec(k)||["","","",""];if(0==g[0].length&&0==k[0].length)break;b=ua(0==g[1].length?0:parseInt(g[1],10),0==k[1].length?0:parseInt(k[1],10))||ua(0==g[2].length,0==k[2].length)||ua(g[2],k[2]);g=g[3];k=k[3]}while(0==b)}return 0<=b})},mb;var nb=l.document;
mb=nb&&z?gb()||("CSS1Compat"==nb.compatMode?parseInt(lb,10):5):void 0;var ob=function(a){return Da(a,function(a){a=a.toString(16);return 1<a.length?a:"0"+a}).join("")};var pb=null,qb=null,sb=function(a){var b="";rb(a,function(a){b+=String.fromCharCode(a)});return b},rb=function(a,b){function c(b){for(;d<a.length;){var c=a.charAt(d++),e=qb[c];if(null!=e)return e;if(!/^[\s\xa0]*$/.test(c))throw Error("Unknown base64 encoding at char: "+c);}return b}tb();for(var d=0;;){var e=c(-1),f=c(0),g=c(64),k=c(64);if(64===k&&-1===e)break;b(e<<2|f>>4);64!=g&&(b(f<<4&240|g>>2),64!=k&&b(g<<6&192|k))}},tb=function(){if(!pb){pb={};qb={};for(var a=0;65>a;a++)pb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),
qb[pb[a]]=a,62<=a&&(qb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a)]=a)}};var ub=function(){this.za=-1};var xb=function(a,b){this.za=64;this.Wb=l.Uint8Array?new Uint8Array(this.za):Array(this.za);this.Ac=this.$a=0;this.h=[];this.Ze=a;this.Ld=b;this.Af=l.Int32Array?new Int32Array(64):Array(64);void 0!==vb||(vb=l.Int32Array?new Int32Array(wb):wb);this.reset()},vb;t(xb,ub);for(var yb=[],zb=0;63>zb;zb++)yb[zb]=0;var Ab=La(128,yb);xb.prototype.reset=function(){this.Ac=this.$a=0;this.h=l.Int32Array?new Int32Array(this.Ld):Ma(this.Ld)};
var Bb=function(a){var b=a.Wb;w(b.length==a.za);for(var c=a.Af,d=0,e=0;e<b.length;)c[d++]=b[e]<<24|b[e+1]<<16|b[e+2]<<8|b[e+3],e=4*d;for(b=16;64>b;b++){var e=c[b-15]|0,d=c[b-2]|0,f=(c[b-16]|0)+((e>>>7|e<<25)^(e>>>18|e<<14)^e>>>3)|0,g=(c[b-7]|0)+((d>>>17|d<<15)^(d>>>19|d<<13)^d>>>10)|0;c[b]=f+g|0}for(var d=a.h[0]|0,e=a.h[1]|0,k=a.h[2]|0,n=a.h[3]|0,A=a.h[4]|0,Xa=a.h[5]|0,Gb=a.h[6]|0,f=a.h[7]|0,b=0;64>b;b++)var gh=((d>>>2|d<<30)^(d>>>13|d<<19)^(d>>>22|d<<10))+(d&e^d&k^e&k)|0,g=A&Xa^~A&Gb,f=f+((A>>>6|
A<<26)^(A>>>11|A<<21)^(A>>>25|A<<7))|0,g=g+(vb[b]|0)|0,g=f+(g+(c[b]|0)|0)|0,f=Gb,Gb=Xa,Xa=A,A=n+g|0,n=k,k=e,e=d,d=g+gh|0;a.h[0]=a.h[0]+d|0;a.h[1]=a.h[1]+e|0;a.h[2]=a.h[2]+k|0;a.h[3]=a.h[3]+n|0;a.h[4]=a.h[4]+A|0;a.h[5]=a.h[5]+Xa|0;a.h[6]=a.h[6]+Gb|0;a.h[7]=a.h[7]+f|0};
xb.prototype.update=function(a,b){void 0===b&&(b=a.length);var c=0,d=this.$a;if(p(a))for(;c<b;)this.Wb[d++]=a.charCodeAt(c++),d==this.za&&(Bb(this),d=0);else if(ea(a))for(;c<b;){var e=a[c++];if(!("number"==typeof e&&0<=e&&255>=e&&e==(e|0)))throw Error("message must be a byte array");this.Wb[d++]=e;d==this.za&&(Bb(this),d=0)}else throw Error("message must be string or array");this.$a=d;this.Ac+=b};
xb.prototype.digest=function(){var a=[],b=8*this.Ac;56>this.$a?this.update(Ab,56-this.$a):this.update(Ab,this.za-(this.$a-56));for(var c=63;56<=c;c--)this.Wb[c]=b&255,b/=256;Bb(this);for(c=b=0;c<this.Ze;c++)for(var d=24;0<=d;d-=8)a[b++]=this.h[c]>>d&255;return a};
var wb=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,
4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];var Db=function(){xb.call(this,8,Cb)};t(Db,xb);var Cb=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];var Eb=!z||9<=Number(mb),Fb=z&&!B("9");!fb||B("528");eb&&B("1.9b")||z&&B("8")||bb&&B("9.5")||fb&&B("528");eb&&!B("8")||z&&B("9");var Hb=function(){this.Ba=this.Ba;this.nc=this.nc};Hb.prototype.Ba=!1;Hb.prototype.isDisposed=function(){return this.Ba};Hb.prototype.Wa=function(){if(this.nc)for(;this.nc.length;)this.nc.shift()()};var Ib=function(a,b){this.type=a;this.currentTarget=this.target=b;this.defaultPrevented=this.gb=!1;this.Wd=!0};Ib.prototype.preventDefault=function(){this.defaultPrevented=!0;this.Wd=!1};var Jb=function(a,b){Ib.call(this,a?a.type:"");this.relatedTarget=this.currentTarget=this.target=null;this.button=this.screenY=this.screenX=this.clientY=this.clientX=this.offsetY=this.offsetX=0;this.key="";this.charCode=this.keyCode=0;this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.Xa=this.state=null;a&&this.init(a,b)};t(Jb,Ib);
Jb.prototype.init=function(a,b){var c=this.type=a.type,d=a.changedTouches?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.currentTarget=b;if(b=a.relatedTarget){if(eb){var e;a:{try{Za(b.nodeName);e=!0;break a}catch(f){}e=!1}e||(b=null)}}else"mouseover"==c?b=a.fromElement:"mouseout"==c&&(b=a.toElement);this.relatedTarget=b;null===d?(this.offsetX=fb||void 0!==a.offsetX?a.offsetX:a.layerX,this.offsetY=fb||void 0!==a.offsetY?a.offsetY:a.layerY,this.clientX=void 0!==a.clientX?a.clientX:
a.pageX,this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0):(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0);this.button=a.button;this.keyCode=a.keyCode||0;this.key=a.key||"";this.charCode=a.charCode||("keypress"==c?a.keyCode:0);this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=a.shiftKey;this.metaKey=a.metaKey;this.state=a.state;this.Xa=
a;a.defaultPrevented&&this.preventDefault()};Jb.prototype.preventDefault=function(){Jb.pd.preventDefault.call(this);var a=this.Xa;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,Fb)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1}catch(b){}};Jb.prototype.Ee=function(){return this.Xa};var Kb="closure_listenable_"+(1E6*Math.random()|0),Lb=0;var Mb=function(a,b,c,d,e){this.listener=a;this.rc=null;this.src=b;this.type=c;this.capture=!!d;this.dc=e;this.key=++Lb;this.lb=this.Vb=!1},Nb=function(a){a.lb=!0;a.listener=null;a.rc=null;a.src=null;a.dc=null};var Ob=function(a){this.src=a;this.D={};this.Rb=0};Ob.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.D[f];a||(a=this.D[f]=[],this.Rb++);var g=Pb(a,b,d,e);-1<g?(b=a[g],c||(b.Vb=!1)):(b=new Mb(b,this.src,f,!!d,e),b.Vb=c,a.push(b));return b};Ob.prototype.remove=function(a,b,c,d){a=a.toString();if(!(a in this.D))return!1;var e=this.D[a];b=Pb(e,b,c,d);return-1<b?(Nb(e[b]),Ia(e,b),0==e.length&&(delete this.D[a],this.Rb--),!0):!1};
var Qb=function(a,b){var c=b.type;c in a.D&&Ja(a.D[c],b)&&(Nb(b),0==a.D[c].length&&(delete a.D[c],a.Rb--))};Ob.prototype.Oc=function(a,b,c,d){a=this.D[a.toString()];var e=-1;a&&(e=Pb(a,b,c,d));return-1<e?a[e]:null};var Pb=function(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.lb&&f.listener==b&&f.capture==!!c&&f.dc==d)return e}return-1};var Rb="closure_lm_"+(1E6*Math.random()|0),Sb={},Tb=0,Ub=function(a,b,c,d,e){if(da(b))for(var f=0;f<b.length;f++)Ub(a,b[f],c,d,e);else c=Vb(c),a&&a[Kb]?a.listen(b,c,d,e):Wb(a,b,c,!1,d,e)},Wb=function(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=!!e,k=Xb(a);k||(a[Rb]=k=new Ob(a));c=k.add(b,c,d,e,f);if(!c.rc){d=Yb();c.rc=d;d.src=a;d.listener=c;if(a.addEventListener)a.addEventListener(b.toString(),d,g);else if(a.attachEvent)a.attachEvent(Zb(b.toString()),d);else throw Error("addEventListener and attachEvent are unavailable.");
Tb++}},Yb=function(){var a=$b,b=Eb?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b},ac=function(a,b,c,d,e){if(da(b))for(var f=0;f<b.length;f++)ac(a,b[f],c,d,e);else c=Vb(c),a&&a[Kb]?bc(a,b,c,d,e):Wb(a,b,c,!0,d,e)},cc=function(a,b,c,d,e){if(da(b))for(var f=0;f<b.length;f++)cc(a,b[f],c,d,e);else c=Vb(c),a&&a[Kb]?a.aa.remove(String(b),c,d,e):a&&(a=Xb(a))&&(b=a.Oc(b,c,!!d,e))&&dc(b)},dc=function(a){if(!fa(a)&&a&&!a.lb){var b=a.src;if(b&&
b[Kb])Qb(b.aa,a);else{var c=a.type,d=a.rc;b.removeEventListener?b.removeEventListener(c,d,a.capture):b.detachEvent&&b.detachEvent(Zb(c),d);Tb--;(c=Xb(b))?(Qb(c,a),0==c.Rb&&(c.src=null,b[Rb]=null)):Nb(a)}}},Zb=function(a){return a in Sb?Sb[a]:Sb[a]="on"+a},fc=function(a,b,c,d){var e=!0;if(a=Xb(a))if(b=a.D[b.toString()])for(b=b.concat(),a=0;a<b.length;a++){var f=b[a];f&&f.capture==c&&!f.lb&&(f=ec(f,d),e=e&&!1!==f)}return e},ec=function(a,b){var c=a.listener,d=a.dc||a.src;a.Vb&&dc(a);return c.call(d,
b)},$b=function(a,b){if(a.lb)return!0;if(!Eb){if(!b)a:{b=["window","event"];for(var c=l,d;d=b.shift();)if(null!=c[d])c=c[d];else{b=null;break a}b=c}d=b;b=new Jb(d,this);c=!0;if(!(0>d.keyCode||void 0!=d.returnValue)){a:{var e=!1;if(0==d.keyCode)try{d.keyCode=-1;break a}catch(g){e=!0}if(e||void 0==d.returnValue)d.returnValue=!0}d=[];for(e=b.currentTarget;e;e=e.parentNode)d.push(e);a=a.type;for(e=d.length-1;!b.gb&&0<=e;e--){b.currentTarget=d[e];var f=fc(d[e],a,!0,b),c=c&&f}for(e=0;!b.gb&&e<d.length;e++)b.currentTarget=
d[e],f=fc(d[e],a,!1,b),c=c&&f}return c}return ec(a,new Jb(b,this))},Xb=function(a){a=a[Rb];return a instanceof Ob?a:null},gc="__closure_events_fn_"+(1E9*Math.random()>>>0),Vb=function(a){w(a,"Listener can not be null.");if(q(a))return a;w(a.handleEvent,"An object listener must have handleEvent method.");a[gc]||(a[gc]=function(b){return a.handleEvent(b)});return a[gc]};var hc=/^[+a-zA-Z0-9_.!#$%&'*\/=?^`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,63}$/;var jc=function(){this.xc="";this.me=ic};jc.prototype.hc=!0;jc.prototype.bc=function(){return this.xc};jc.prototype.toString=function(){return"Const{"+this.xc+"}"};var kc=function(a){if(a instanceof jc&&a.constructor===jc&&a.me===ic)return a.xc;xa("expected object of type Const, got '"+a+"'");return"type_error:Const"},ic={},lc=function(a){var b=new jc;b.xc=a;return b};lc("");var nc=function(){this.qc="";this.ne=mc};nc.prototype.hc=!0;nc.prototype.bc=function(){return this.qc};nc.prototype.toString=function(){return"TrustedResourceUrl{"+this.qc+"}"};var mc={};var pc=function(){this.ma="";this.le=oc};pc.prototype.hc=!0;pc.prototype.bc=function(){return this.ma};pc.prototype.toString=function(){return"SafeUrl{"+this.ma+"}"};
var qc=function(a){if(a instanceof pc&&a.constructor===pc&&a.le===oc)return a.ma;xa("expected object of type SafeUrl, got '"+a+"' of type "+m(a));return"type_error:SafeUrl"},rc=/^(?:(?:https?|mailto|ftp):|[^&:/?#]*(?:[/?#]|$))/i,tc=function(a){if(a instanceof pc)return a;a=a.hc?a.bc():String(a);rc.test(a)||(a="about:invalid#zClosurez");return sc(a)},oc={},sc=function(a){var b=new pc;b.ma=a;return b};sc("about:blank");var vc=function(){this.ma="";this.ke=uc};vc.prototype.hc=!0;vc.prototype.bc=function(){return this.ma};vc.prototype.toString=function(){return"SafeHtml{"+this.ma+"}"};var wc=function(a){if(a instanceof vc&&a.constructor===vc&&a.ke===uc)return a.ma;xa("expected object of type SafeHtml, got '"+a+"' of type "+m(a));return"type_error:SafeHtml"},uc={};vc.prototype.Pe=function(a){this.ma=a;return this};var xc="StopIteration"in l?l.StopIteration:{message:"StopIteration",stack:""},yc=function(){};yc.prototype.next=function(){throw xc;};yc.prototype.oe=function(){return this};var zc=function(a,b){this.ba={};this.w=[];this.sb=this.o=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1])}else a&&this.addAll(a)};zc.prototype.X=function(){Ac(this);for(var a=[],b=0;b<this.w.length;b++)a.push(this.ba[this.w[b]]);return a};zc.prototype.ka=function(){Ac(this);return this.w.concat()};zc.prototype.ub=function(a){return Bc(this.ba,a)};
zc.prototype.remove=function(a){return Bc(this.ba,a)?(delete this.ba[a],this.o--,this.sb++,this.w.length>2*this.o&&Ac(this),!0):!1};var Ac=function(a){if(a.o!=a.w.length){for(var b=0,c=0;b<a.w.length;){var d=a.w[b];Bc(a.ba,d)&&(a.w[c++]=d);b++}a.w.length=c}if(a.o!=a.w.length){for(var e={},c=b=0;b<a.w.length;)d=a.w[b],Bc(e,d)||(a.w[c++]=d,e[d]=1),b++;a.w.length=c}};h=zc.prototype;h.get=function(a,b){return Bc(this.ba,a)?this.ba[a]:b};
h.set=function(a,b){Bc(this.ba,a)||(this.o++,this.w.push(a),this.sb++);this.ba[a]=b};h.addAll=function(a){var b;a instanceof zc?(b=a.ka(),a=a.X()):(b=Pa(a),a=Oa(a));for(var c=0;c<b.length;c++)this.set(b[c],a[c])};h.forEach=function(a,b){for(var c=this.ka(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this)}};h.clone=function(){return new zc(this)};
h.oe=function(a){Ac(this);var b=0,c=this.sb,d=this,e=new yc;e.next=function(){if(c!=d.sb)throw Error("The map has changed since the iterator was created");if(b>=d.w.length)throw xc;var e=d.w[b++];return a?e:d.ba[e]};return e};var Bc=function(a,b){return Object.prototype.hasOwnProperty.call(a,b)};var Cc=function(a){if(a.X&&"function"==typeof a.X)return a.X();if(p(a))return a.split("");if(ea(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}return Oa(a)},Dc=function(a){if(a.ka&&"function"==typeof a.ka)return a.ka();if(!a.X||"function"!=typeof a.X){if(ea(a)||p(a)){var b=[];a=a.length;for(var c=0;c<a;c++)b.push(c);return b}return Pa(a)}},Ec=function(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(ea(a)||p(a))x(a,b,void 0);else for(var c=Dc(a),d=Cc(a),e=
d.length,f=0;f<e;f++)b.call(void 0,d[f],c&&c[f],a)};var Fc=function(a,b,c,d,e){this.reset(a,b,c,d,e)};Fc.prototype.Cd=null;var Gc=0;Fc.prototype.reset=function(a,b,c,d,e){"number"==typeof e||Gc++;d||ka();this.Bb=a;this.We=b;delete this.Cd};Fc.prototype.$d=function(a){this.Bb=a};var Hc=function(a){this.Xe=a;this.Id=this.Jc=this.Bb=this.s=null},Ic=function(a,b){this.name=a;this.value=b};Ic.prototype.toString=function(){return this.name};var Jc=new Ic("SEVERE",1E3),Kc=new Ic("CONFIG",700),Lc=new Ic("FINE",500);Hc.prototype.getParent=function(){return this.s};Hc.prototype.$d=function(a){this.Bb=a};var Mc=function(a){if(a.Bb)return a.Bb;if(a.s)return Mc(a.s);xa("Root logger has no level set.");return null};
Hc.prototype.log=function(a,b,c){if(a.value>=Mc(this).value)for(q(b)&&(b=b()),a=new Fc(a,String(b),this.Xe),c&&(a.Cd=c),c="log:"+a.We,l.console&&(l.console.timeStamp?l.console.timeStamp(c):l.console.markTimeline&&l.console.markTimeline(c)),l.msWriteProfilerMark&&l.msWriteProfilerMark(c),c=this;c;){var d=c,e=a;if(d.Id)for(var f=0;b=d.Id[f];f++)b(e);c=c.getParent()}};
var Nc={},Oc=null,Pc=function(a){Oc||(Oc=new Hc(""),Nc[""]=Oc,Oc.$d(Kc));var b;if(!(b=Nc[a])){b=new Hc(a);var c=a.lastIndexOf("."),d=a.substr(c+1),c=Pc(a.substr(0,c));c.Jc||(c.Jc={});c.Jc[d]=b;b.s=c;Nc[a]=b}return b};var C=function(a,b){a&&a.log(Lc,b,void 0)};var Sc=function(a){var b=[];Qc(new Rc,a,b);return b.join("")},Rc=function(){this.tc=void 0},Qc=function(a,b,c){if(null==b)c.push("null");else{if("object"==typeof b){if(da(b)){var d=b;b=d.length;c.push("[");for(var e="",f=0;f<b;f++)c.push(e),e=d[f],Qc(a,a.tc?a.tc.call(d,String(f),e):e,c),e=",";c.push("]");return}if(b instanceof String||b instanceof Number||b instanceof Boolean)b=b.valueOf();else{c.push("{");f="";for(d in b)Object.prototype.hasOwnProperty.call(b,d)&&(e=b[d],"function"!=typeof e&&(c.push(f),
Tc(d,c),c.push(":"),Qc(a,a.tc?a.tc.call(b,d,e):e,c),f=","));c.push("}");return}}switch(typeof b){case "string":Tc(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?String(b):"null");break;case "boolean":c.push(String(b));break;case "function":c.push("null");break;default:throw Error("Unknown type: "+typeof b);}}},Uc={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},Vc=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g,
Tc=function(a,b){b.push('"',a.replace(Vc,function(a){var b=Uc[a];b||(b="\\u"+(a.charCodeAt(0)|65536).toString(16).substr(1),Uc[a]=b);return b}),'"')};var Wc=function(){};Wc.prototype.td=null;var Xc=function(a){return a.td||(a.td=a.Uc())};var Yc,Zc=function(){};t(Zc,Wc);Zc.prototype.Xb=function(){var a=$c(this);return a?new ActiveXObject(a):new XMLHttpRequest};Zc.prototype.Uc=function(){var a={};$c(this)&&(a[0]=!0,a[1]=!0);return a};
var $c=function(a){if(!a.Kd&&"undefined"==typeof XMLHttpRequest&&"undefined"!=typeof ActiveXObject){for(var b=["MSXML2.XMLHTTP.6.0","MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"],c=0;c<b.length;c++){var d=b[c];try{return new ActiveXObject(d),a.Kd=d}catch(e){}}throw Error("Could not create ActiveXObject. ActiveX might be disabled, or MSXML might not be installed");}return a.Kd};Yc=new Zc;var ad=function(){};t(ad,Wc);ad.prototype.Xb=function(){var a=new XMLHttpRequest;if("withCredentials"in a)return a;if("undefined"!=typeof XDomainRequest)return new bd;throw Error("Unsupported browser");};ad.prototype.Uc=function(){return{}};
var bd=function(){this.qa=new XDomainRequest;this.readyState=0;this.onreadystatechange=null;this.responseText="";this.status=-1;this.statusText=this.responseXML=null;this.qa.onload=r(this.Ge,this);this.qa.onerror=r(this.Hd,this);this.qa.onprogress=r(this.He,this);this.qa.ontimeout=r(this.Ie,this)};h=bd.prototype;h.open=function(a,b,c){if(null!=c&&!c)throw Error("Only async requests are supported.");this.qa.open(a,b)};
h.send=function(a){if(a)if("string"==typeof a)this.qa.send(a);else throw Error("Only string data is supported");else this.qa.send()};h.abort=function(){this.qa.abort()};h.setRequestHeader=function(){};h.Ge=function(){this.status=200;this.responseText=this.qa.responseText;cd(this,4)};h.Hd=function(){this.status=500;this.responseText="";cd(this,4)};h.Ie=function(){this.Hd()};h.He=function(){this.status=200;cd(this,1)};var cd=function(a,b){a.readyState=b;if(a.onreadystatechange)a.onreadystatechange()};!eb&&!z||z&&9<=Number(mb)||eb&&B("1.9.1");z&&B("9");var ed=function(a,b){Na(b,function(b,d){"style"==d?a.style.cssText=b:"class"==d?a.className=b:"for"==d?a.htmlFor=b:dd.hasOwnProperty(d)?a.setAttribute(dd[d],b):0==d.lastIndexOf("aria-",0)||0==d.lastIndexOf("data-",0)?a.setAttribute(d,b):a[d]=b})},dd={cellpadding:"cellPadding",cellspacing:"cellSpacing",colspan:"colSpan",frameborder:"frameBorder",height:"height",maxlength:"maxLength",nonce:"nonce",role:"role",rowspan:"rowSpan",type:"type",usemap:"useMap",valign:"vAlign",width:"width"};var fd=function(a,b,c){this.Te=c;this.ue=a;this.jf=b;this.mc=0;this.ec=null};fd.prototype.get=function(){var a;0<this.mc?(this.mc--,a=this.ec,this.ec=a.next,a.next=null):a=this.ue();return a};fd.prototype.put=function(a){this.jf(a);this.mc<this.Te&&(this.mc++,a.next=this.ec,this.ec=a)};var gd=function(a){l.setTimeout(function(){throw a;},0)},hd,id=function(){var a=l.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&!y("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,
a=r(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&!y("Trident")&&!y("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(void 0!==c.next){c=c.next;var a=c.wd;c.wd=null;a()}};return function(a){d.next={wd:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("SCRIPT")?
function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){l.setTimeout(a,0)}};var jd=function(){this.Dc=this.Ra=null},ld=new fd(function(){return new kd},function(a){a.reset()},100);jd.prototype.add=function(a,b){var c=ld.get();c.set(a,b);this.Dc?this.Dc.next=c:(w(!this.Ra),this.Ra=c);this.Dc=c};jd.prototype.remove=function(){var a=null;this.Ra&&(a=this.Ra,this.Ra=this.Ra.next,this.Ra||(this.Dc=null),a.next=null);return a};var kd=function(){this.next=this.scope=this.Nc=null};kd.prototype.set=function(a,b){this.Nc=a;this.scope=b;this.next=null};
kd.prototype.reset=function(){this.next=this.scope=this.Nc=null};var qd=function(a,b){md||nd();od||(md(),od=!0);pd.add(a,b)},md,nd=function(){if(-1!=String(l.Promise).indexOf("[native code]")){var a=l.Promise.resolve(void 0);md=function(){a.then(rd)}}else md=function(){var a=rd;!q(l.setImmediate)||l.Window&&l.Window.prototype&&!y("Edge")&&l.Window.prototype.setImmediate==l.setImmediate?(hd||(hd=id()),hd(a)):l.setImmediate(a)}},od=!1,pd=new jd,rd=function(){for(var a;a=pd.remove();){try{a.Nc.call(a.scope)}catch(b){gd(b)}ld.put(a)}od=!1};var sd=function(a){a.prototype.then=a.prototype.then;a.prototype.$goog_Thenable=!0},td=function(a){if(!a)return!1;try{return!!a.$goog_Thenable}catch(b){return!1}};var D=function(a,b){this.M=0;this.na=void 0;this.Ua=this.ja=this.s=null;this.cc=this.Mc=!1;if(a!=ba)try{var c=this;a.call(b,function(a){ud(c,2,a)},function(a){if(!(a instanceof vd))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(e){}ud(c,3,a)})}catch(d){ud(this,3,d)}},wd=function(){this.next=this.context=this.bb=this.Ja=this.child=null;this.tb=!1};wd.prototype.reset=function(){this.context=this.bb=this.Ja=this.child=null;this.tb=!1};
var xd=new fd(function(){return new wd},function(a){a.reset()},100),yd=function(a,b,c){var d=xd.get();d.Ja=a;d.bb=b;d.context=c;return d},E=function(a){if(a instanceof D)return a;var b=new D(ba);ud(b,2,a);return b},F=function(a){return new D(function(b,c){c(a)})},Ad=function(a,b,c){zd(a,b,c,null)||qd(ja(b,a))},Bd=function(a){return new D(function(b){var c=a.length,d=[];if(c)for(var e=function(a,e,f){c--;d[a]=e?{Ce:!0,value:f}:{Ce:!1,reason:f};0==c&&b(d)},f=0,g;f<a.length;f++)g=a[f],Ad(g,ja(e,f,!0),
ja(e,f,!1));else b(d)})};D.prototype.then=function(a,b,c){null!=a&&Aa(a,"opt_onFulfilled should be a function.");null!=b&&Aa(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return Cd(this,q(a)?a:null,q(b)?b:null,c)};sd(D);var Ed=function(a,b){b=yd(b,b,void 0);b.tb=!0;Dd(a,b);return a};D.prototype.f=function(a,b){return Cd(this,null,a,b)};D.prototype.cancel=function(a){0==this.M&&qd(function(){var b=new vd(a);Fd(this,b)},this)};
var Fd=function(a,b){if(0==a.M)if(a.s){var c=a.s;if(c.ja){for(var d=0,e=null,f=null,g=c.ja;g&&(g.tb||(d++,g.child==a&&(e=g),!(e&&1<d)));g=g.next)e||(f=g);e&&(0==c.M&&1==d?Fd(c,b):(f?(d=f,w(c.ja),w(null!=d),d.next==c.Ua&&(c.Ua=d),d.next=d.next.next):Gd(c),Hd(c,e,3,b)))}a.s=null}else ud(a,3,b)},Dd=function(a,b){a.ja||2!=a.M&&3!=a.M||Id(a);w(null!=b.Ja);a.Ua?a.Ua.next=b:a.ja=b;a.Ua=b},Cd=function(a,b,c,d){var e=yd(null,null,null);e.child=new D(function(a,g){e.Ja=b?function(c){try{var e=b.call(d,c);a(e)}catch(A){g(A)}}:
a;e.bb=c?function(b){try{var e=c.call(d,b);void 0===e&&b instanceof vd?g(b):a(e)}catch(A){g(A)}}:g});e.child.s=a;Dd(a,e);return e.child};D.prototype.xf=function(a){w(1==this.M);this.M=0;ud(this,2,a)};D.prototype.yf=function(a){w(1==this.M);this.M=0;ud(this,3,a)};
var ud=function(a,b,c){0==a.M&&(a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself")),a.M=1,zd(c,a.xf,a.yf,a)||(a.na=c,a.M=b,a.s=null,Id(a),3!=b||c instanceof vd||Jd(a,c)))},zd=function(a,b,c,d){if(a instanceof D)return null!=b&&Aa(b,"opt_onFulfilled should be a function."),null!=c&&Aa(c,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),Dd(a,yd(b||ba,c||null,d)),!0;if(td(a))return a.then(b,c,d),!0;if(ga(a))try{var e=a.then;if(q(e))return Kd(a,
e,b,c,d),!0}catch(f){return c.call(d,f),!0}return!1},Kd=function(a,b,c,d,e){var f=!1,g=function(a){f||(f=!0,c.call(e,a))},k=function(a){f||(f=!0,d.call(e,a))};try{b.call(a,g,k)}catch(n){k(n)}},Id=function(a){a.Mc||(a.Mc=!0,qd(a.xe,a))},Gd=function(a){var b=null;a.ja&&(b=a.ja,a.ja=b.next,b.next=null);a.ja||(a.Ua=null);null!=b&&w(null!=b.Ja);return b};D.prototype.xe=function(){for(var a;a=Gd(this);)Hd(this,a,this.M,this.na);this.Mc=!1};
var Hd=function(a,b,c,d){if(3==c&&b.bb&&!b.tb)for(;a&&a.cc;a=a.s)a.cc=!1;if(b.child)b.child.s=null,Ld(b,c,d);else try{b.tb?b.Ja.call(b.context):Ld(b,c,d)}catch(e){Md.call(null,e)}xd.put(b)},Ld=function(a,b,c){2==b?a.Ja.call(a.context,c):a.bb&&a.bb.call(a.context,c)},Jd=function(a,b){a.cc=!0;qd(function(){a.cc&&Md.call(null,b)})},Md=gd,vd=function(a){u.call(this,a)};t(vd,u);vd.prototype.name="cancel";/*
 Portions of this code are from MochiKit, received by
 The Closure Authors under the MIT license. All other code is Copyright
 2005-2009 The Closure Authors. All Rights Reserved.
*/
var Nd=function(a,b){this.uc=[];this.Qd=a;this.zd=b||null;this.wb=this.Ya=!1;this.na=void 0;this.md=this.sd=this.Hc=!1;this.Bc=0;this.s=null;this.Ic=0};Nd.prototype.cancel=function(a){if(this.Ya)this.na instanceof Nd&&this.na.cancel();else{if(this.s){var b=this.s;delete this.s;a?b.cancel(a):(b.Ic--,0>=b.Ic&&b.cancel())}this.Qd?this.Qd.call(this.zd,this):this.md=!0;this.Ya||Od(this,new Pd)}};Nd.prototype.xd=function(a,b){this.Hc=!1;Qd(this,a,b)};
var Qd=function(a,b,c){a.Ya=!0;a.na=c;a.wb=!b;Rd(a)},Td=function(a){if(a.Ya){if(!a.md)throw new Sd;a.md=!1}};Nd.prototype.callback=function(a){Td(this);Ud(a);Qd(this,!0,a)};
var Od=function(a,b){Td(a);Ud(b);Qd(a,!1,b)},Ud=function(a){w(!(a instanceof Nd),"An execution sequence may not be initiated with a blocking Deferred.")},Yd=function(a){var b=Vd("https://apis.google.com/js/client.js?onload="+Wd);Xd(b,null,a,void 0)},Xd=function(a,b,c,d){w(!a.sd,"Blocking Deferreds can not be re-used");a.uc.push([b,c,d]);a.Ya&&Rd(a)};Nd.prototype.then=function(a,b,c){var d,e,f=new D(function(a,b){d=a;e=b});Xd(this,d,function(a){a instanceof Pd?f.cancel():e(a)});return f.then(a,b,c)};
sd(Nd);
var Zd=function(a){return Ea(a.uc,function(a){return q(a[1])})},Rd=function(a){if(a.Bc&&a.Ya&&Zd(a)){var b=a.Bc,c=$d[b];c&&(l.clearTimeout(c.xb),delete $d[b]);a.Bc=0}a.s&&(a.s.Ic--,delete a.s);for(var b=a.na,d=c=!1;a.uc.length&&!a.Hc;){var e=a.uc.shift(),f=e[0],g=e[1],e=e[2];if(f=a.wb?g:f)try{var k=f.call(e||a.zd,b);void 0!==k&&(a.wb=a.wb&&(k==b||k instanceof Error),a.na=b=k);if(td(b)||"function"===typeof l.Promise&&b instanceof l.Promise)d=!0,a.Hc=!0}catch(n){b=n,a.wb=!0,Zd(a)||(c=!0)}}a.na=b;d&&
(k=r(a.xd,a,!0),d=r(a.xd,a,!1),b instanceof Nd?(Xd(b,k,d),b.sd=!0):b.then(k,d));c&&(b=new ae(b),$d[b.xb]=b,a.Bc=b.xb)},Sd=function(){u.call(this)};t(Sd,u);Sd.prototype.message="Deferred has already fired";Sd.prototype.name="AlreadyCalledError";var Pd=function(){u.call(this)};t(Pd,u);Pd.prototype.message="Deferred was canceled";Pd.prototype.name="CanceledError";var ae=function(a){this.xb=l.setTimeout(r(this.wf,this),0);this.O=a};
ae.prototype.wf=function(){w($d[this.xb],"Cannot throw an error that is not scheduled.");delete $d[this.xb];throw this.O;};var $d={};var Vd=function(a){var b=new nc;b.qc=a;return be(b)},be=function(a){var b={},c=b.document||document,d;a instanceof nc&&a.constructor===nc&&a.ne===mc?d=a.qc:(xa("expected object of type TrustedResourceUrl, got '"+a+"' of type "+m(a)),d="type_error:TrustedResourceUrl");var e=document.createElement("SCRIPT");a={Xd:e,Qb:void 0};var f=new Nd(ce,a),g=null,k=null!=b.timeout?b.timeout:5E3;0<k&&(g=window.setTimeout(function(){de(e,!0);Od(f,new ee(1,"Timeout reached for loading script "+d))},k),a.Qb=g);e.onload=
e.onreadystatechange=function(){e.readyState&&"loaded"!=e.readyState&&"complete"!=e.readyState||(de(e,b.If||!1,g),f.callback(null))};e.onerror=function(){de(e,!0,g);Od(f,new ee(0,"Error while loading script "+d))};a=b.attributes||{};Ua(a,{type:"text/javascript",charset:"UTF-8",src:d});ed(e,a);fe(c).appendChild(e);return f},fe=function(a){var b;return(b=(a||document).getElementsByTagName("HEAD"))&&0!=b.length?b[0]:a.documentElement},ce=function(){if(this&&this.Xd){var a=this.Xd;a&&"SCRIPT"==a.tagName&&
de(a,!0,this.Qb)}},de=function(a,b,c){null!=c&&l.clearTimeout(c);a.onload=ba;a.onerror=ba;a.onreadystatechange=ba;b&&window.setTimeout(function(){a&&a.parentNode&&a.parentNode.removeChild(a)},0)},ee=function(a,b){var c="Jsloader error (code #"+a+")";b&&(c+=": "+b);u.call(this,c);this.code=a};t(ee,u);var ge=function(){Hb.call(this);this.aa=new Ob(this);this.pe=this;this.$c=null};t(ge,Hb);ge.prototype[Kb]=!0;h=ge.prototype;h.addEventListener=function(a,b,c,d){Ub(this,a,b,c,d)};h.removeEventListener=function(a,b,c,d){cc(this,a,b,c,d)};
h.dispatchEvent=function(a){he(this);var b,c=this.$c;if(c){b=[];for(var d=1;c;c=c.$c)b.push(c),w(1E3>++d,"infinite loop")}c=this.pe;d=a.type||a;if(p(a))a=new Ib(a,c);else if(a instanceof Ib)a.target=a.target||c;else{var e=a;a=new Ib(d,c);Ua(a,e)}var e=!0,f;if(b)for(var g=b.length-1;!a.gb&&0<=g;g--)f=a.currentTarget=b[g],e=ie(f,d,!0,a)&&e;a.gb||(f=a.currentTarget=c,e=ie(f,d,!0,a)&&e,a.gb||(e=ie(f,d,!1,a)&&e));if(b)for(g=0;!a.gb&&g<b.length;g++)f=a.currentTarget=b[g],e=ie(f,d,!1,a)&&e;return e};
h.Wa=function(){ge.pd.Wa.call(this);if(this.aa){var a=this.aa,b=0,c;for(c in a.D){for(var d=a.D[c],e=0;e<d.length;e++)++b,Nb(d[e]);delete a.D[c];a.Rb--}}this.$c=null};h.listen=function(a,b,c,d){he(this);return this.aa.add(String(a),b,!1,c,d)};
var bc=function(a,b,c,d,e){a.aa.add(String(b),c,!0,d,e)},ie=function(a,b,c,d){b=a.aa.D[String(b)];if(!b)return!0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.lb&&g.capture==c){var k=g.listener,n=g.dc||g.src;g.Vb&&Qb(a.aa,g);e=!1!==k.call(n,d)&&e}}return e&&0!=d.Wd};ge.prototype.Oc=function(a,b,c,d){return this.aa.Oc(String(a),b,c,d)};var he=function(a){w(a.aa,"Event target is not initialized. Did you call the superclass (goog.events.EventTarget) constructor?")};var je=function(a,b,c){if(q(a))c&&(a=r(a,c));else if(a&&"function"==typeof a.handleEvent)a=r(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:l.setTimeout(a,b||0)},ke=function(a){var b=null;return(new D(function(c,d){b=je(function(){c(void 0)},a);-1==b&&d(Error("Failed to schedule timer."))})).f(function(a){l.clearTimeout(b);throw a;})};var le=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#([\s\S]*))?$/,me=function(a,b){if(a){a=a.split("&");for(var c=0;c<a.length;c++){var d=a[c].indexOf("="),e,f=null;0<=d?(e=a[c].substring(0,d),f=a[c].substring(d+1)):e=a[c];b(e,f?decodeURIComponent(f.replace(/\+/g," ")):"")}}};var G=function(a){ge.call(this);this.headers=new zc;this.Fc=a||null;this.ra=!1;this.Ec=this.b=null;this.Ab=this.Od=this.kc="";this.Fa=this.Sc=this.ic=this.Lc=!1;this.ob=0;this.zc=null;this.Vd="";this.Cc=this.ef=this.je=!1};t(G,ge);var ne=G.prototype,oe=Pc("goog.net.XhrIo");ne.T=oe;var pe=/^https?$/i,qe=["POST","PUT"];
G.prototype.send=function(a,b,c,d){if(this.b)throw Error("[goog.net.XhrIo] Object is active with another request="+this.kc+"; newUri="+a);b=b?b.toUpperCase():"GET";this.kc=a;this.Ab="";this.Od=b;this.Lc=!1;this.ra=!0;this.b=this.Fc?this.Fc.Xb():Yc.Xb();this.Ec=this.Fc?Xc(this.Fc):Xc(Yc);this.b.onreadystatechange=r(this.Sd,this);this.ef&&"onprogress"in this.b&&(this.b.onprogress=r(function(a){this.Rd(a,!0)},this),this.b.upload&&(this.b.upload.onprogress=r(this.Rd,this)));try{C(this.T,re(this,"Opening Xhr")),
this.Sc=!0,this.b.open(b,String(a),!0),this.Sc=!1}catch(f){C(this.T,re(this,"Error opening Xhr: "+f.message));this.O(5,f);return}a=c||"";var e=this.headers.clone();d&&Ec(d,function(a,b){e.set(b,a)});d=Ga(e.ka());c=l.FormData&&a instanceof l.FormData;!Ha(qe,b)||d||c||e.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");e.forEach(function(a,b){this.b.setRequestHeader(b,a)},this);this.Vd&&(this.b.responseType=this.Vd);"withCredentials"in this.b&&this.b.withCredentials!==this.je&&(this.b.withCredentials=
this.je);try{se(this),0<this.ob&&(this.Cc=te(this.b),C(this.T,re(this,"Will abort after "+this.ob+"ms if incomplete, xhr2 "+this.Cc)),this.Cc?(this.b.timeout=this.ob,this.b.ontimeout=r(this.Qb,this)):this.zc=je(this.Qb,this.ob,this)),C(this.T,re(this,"Sending request")),this.ic=!0,this.b.send(a),this.ic=!1}catch(f){C(this.T,re(this,"Send error: "+f.message)),this.O(5,f)}};var te=function(a){return z&&B(9)&&fa(a.timeout)&&void 0!==a.ontimeout},Fa=function(a){return"content-type"==a.toLowerCase()};
G.prototype.Qb=function(){"undefined"!=typeof aa&&this.b&&(this.Ab="Timed out after "+this.ob+"ms, aborting",C(this.T,re(this,this.Ab)),this.dispatchEvent("timeout"),this.abort(8))};G.prototype.O=function(a,b){this.ra=!1;this.b&&(this.Fa=!0,this.b.abort(),this.Fa=!1);this.Ab=b;ue(this);ve(this)};var ue=function(a){a.Lc||(a.Lc=!0,a.dispatchEvent("complete"),a.dispatchEvent("error"))};
G.prototype.abort=function(){this.b&&this.ra&&(C(this.T,re(this,"Aborting")),this.ra=!1,this.Fa=!0,this.b.abort(),this.Fa=!1,this.dispatchEvent("complete"),this.dispatchEvent("abort"),ve(this))};G.prototype.Wa=function(){this.b&&(this.ra&&(this.ra=!1,this.Fa=!0,this.b.abort(),this.Fa=!1),ve(this,!0));G.pd.Wa.call(this)};G.prototype.Sd=function(){this.isDisposed()||(this.Sc||this.ic||this.Fa?we(this):this.af())};G.prototype.af=function(){we(this)};
var we=function(a){if(a.ra&&"undefined"!=typeof aa)if(a.Ec[1]&&4==xe(a)&&2==ye(a))C(a.T,re(a,"Local request error detected and ignored"));else if(a.ic&&4==xe(a))je(a.Sd,0,a);else if(a.dispatchEvent("readystatechange"),4==xe(a)){C(a.T,re(a,"Request complete"));a.ra=!1;try{var b=ye(a),c;a:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:c=!0;break a;default:c=!1}var d;if(!(d=c)){var e;if(e=0===b){var f=String(a.kc).match(le)[1]||null;if(!f&&l.self&&l.self.location)var g=l.self.location.protocol,
f=g.substr(0,g.length-1);e=!pe.test(f?f.toLowerCase():"")}d=e}if(d)a.dispatchEvent("complete"),a.dispatchEvent("success");else{var k;try{k=2<xe(a)?a.b.statusText:""}catch(n){C(a.T,"Can not get status: "+n.message),k=""}a.Ab=k+" ["+ye(a)+"]";ue(a)}}finally{ve(a)}}};G.prototype.Rd=function(a,b){w("progress"===a.type,"goog.net.EventType.PROGRESS is of the same type as raw XHR progress.");this.dispatchEvent(ze(a,"progress"));this.dispatchEvent(ze(a,b?"downloadprogress":"uploadprogress"))};
var ze=function(a,b){return{type:b,lengthComputable:a.lengthComputable,loaded:a.loaded,total:a.total}},ve=function(a,b){if(a.b){se(a);var c=a.b,d=a.Ec[0]?ba:null;a.b=null;a.Ec=null;b||a.dispatchEvent("ready");try{c.onreadystatechange=d}catch(e){(a=a.T)&&a.log(Jc,"Problem encountered resetting onreadystatechange: "+e.message,void 0)}}},se=function(a){a.b&&a.Cc&&(a.b.ontimeout=null);fa(a.zc)&&(l.clearTimeout(a.zc),a.zc=null)},xe=function(a){return a.b?a.b.readyState:0},ye=function(a){try{return 2<xe(a)?
a.b.status:-1}catch(b){return-1}},Ae=function(a){try{return a.b?a.b.responseText:""}catch(b){return C(a.T,"Can not get responseText: "+b.message),""}},re=function(a,b){return b+" ["+a.Od+" "+a.kc+" "+ye(a)+"]"};var Be=function(a,b){this.$=this.Pa=this.da="";this.eb=null;this.Ea=this.ta="";this.R=this.Se=!1;var c;a instanceof Be?(this.R=void 0!==b?b:a.R,Ce(this,a.da),c=a.Pa,H(this),this.Pa=c,De(this,a.$),Ee(this,a.eb),Fe(this,a.ta),Ge(this,a.V.clone()),a=a.Ea,H(this),this.Ea=a):a&&(c=String(a).match(le))?(this.R=!!b,Ce(this,c[1]||"",!0),a=c[2]||"",H(this),this.Pa=He(a),De(this,c[3]||"",!0),Ee(this,c[4]),Fe(this,c[5]||"",!0),Ge(this,c[6]||"",!0),a=c[7]||"",H(this),this.Ea=He(a)):(this.R=!!b,this.V=new I(null,
0,this.R))};Be.prototype.toString=function(){var a=[],b=this.da;b&&a.push(Ie(b,Je,!0),":");var c=this.$;if(c||"file"==b)a.push("//"),(b=this.Pa)&&a.push(Ie(b,Je,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.eb,null!=c&&a.push(":",String(c));if(c=this.ta)this.$&&"/"!=c.charAt(0)&&a.push("/"),a.push(Ie(c,"/"==c.charAt(0)?Ke:Le,!0));(c=this.V.toString())&&a.push("?",c);(c=this.Ea)&&a.push("#",Ie(c,Me));return a.join("")};
Be.prototype.resolve=function(a){var b=this.clone(),c=!!a.da;c?Ce(b,a.da):c=!!a.Pa;if(c){var d=a.Pa;H(b);b.Pa=d}else c=!!a.$;c?De(b,a.$):c=null!=a.eb;d=a.ta;if(c)Ee(b,a.eb);else if(c=!!a.ta){if("/"!=d.charAt(0))if(this.$&&!this.ta)d="/"+d;else{var e=b.ta.lastIndexOf("/");-1!=e&&(d=b.ta.substr(0,e+1)+d)}e=d;if(".."==e||"."==e)d="";else if(v(e,"./")||v(e,"/.")){for(var d=0==e.lastIndexOf("/",0),e=e.split("/"),f=[],g=0;g<e.length;){var k=e[g++];"."==k?d&&g==e.length&&f.push(""):".."==k?((1<f.length||
1==f.length&&""!=f[0])&&f.pop(),d&&g==e.length&&f.push("")):(f.push(k),d=!0)}d=f.join("/")}else d=e}c?Fe(b,d):c=""!==a.V.toString();c?Ge(b,a.V.clone()):c=!!a.Ea;c&&(a=a.Ea,H(b),b.Ea=a);return b};Be.prototype.clone=function(){return new Be(this)};
var Ce=function(a,b,c){H(a);a.da=c?He(b,!0):b;a.da&&(a.da=a.da.replace(/:$/,""))},De=function(a,b,c){H(a);a.$=c?He(b,!0):b},Ee=function(a,b){H(a);if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.eb=b}else a.eb=null},Fe=function(a,b,c){H(a);a.ta=c?He(b,!0):b},Ge=function(a,b,c){H(a);b instanceof I?(a.V=b,a.V.ld(a.R)):(c||(b=Ie(b,Ne)),a.V=new I(b,0,a.R))},J=function(a,b,c){H(a);a.V.set(b,c)},Oe=function(a,b){return a.V.get(b)},Pe=function(a,b){H(a);a.V.remove(b)},H=function(a){if(a.Se)throw Error("Tried to modify a read-only Uri");
};Be.prototype.ld=function(a){this.R=a;this.V&&this.V.ld(a);return this};
var Qe=function(a){return a instanceof Be?a.clone():new Be(a,void 0)},Re=function(a,b){var c=new Be(null,void 0);Ce(c,"https");a&&De(c,a);b&&Fe(c,b);return c},He=function(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""},Ie=function(a,b,c){return p(a)?(a=encodeURI(a).replace(b,Se),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null},Se=function(a){a=a.charCodeAt(0);return"%"+(a>>4&15).toString(16)+(a&15).toString(16)},Je=/[#\/\?@]/g,Le=/[\#\?:]/g,Ke=/[\#\?]/g,Ne=/[\#\?@]/g,
Me=/#/g,I=function(a,b,c){this.o=this.l=null;this.N=a||null;this.R=!!c},Te=function(a){a.l||(a.l=new zc,a.o=0,a.N&&me(a.N,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c)}))},Ve=function(a){var b=Dc(a);if("undefined"==typeof b)throw Error("Keys are undefined");var c=new I(null,0,void 0);a=Cc(a);for(var d=0;d<b.length;d++){var e=b[d],f=a[d];da(f)?Ue(c,e,f):c.add(e,f)}return c};h=I.prototype;
h.add=function(a,b){Te(this);this.N=null;a=this.P(a);var c=this.l.get(a);c||this.l.set(a,c=[]);c.push(b);this.o=ya(this.o)+1;return this};h.remove=function(a){Te(this);a=this.P(a);return this.l.ub(a)?(this.N=null,this.o=ya(this.o)-this.l.get(a).length,this.l.remove(a)):!1};h.ub=function(a){Te(this);a=this.P(a);return this.l.ub(a)};h.ka=function(){Te(this);for(var a=this.l.X(),b=this.l.ka(),c=[],d=0;d<b.length;d++)for(var e=a[d],f=0;f<e.length;f++)c.push(b[d]);return c};
h.X=function(a){Te(this);var b=[];if(p(a))this.ub(a)&&(b=La(b,this.l.get(this.P(a))));else{a=this.l.X();for(var c=0;c<a.length;c++)b=La(b,a[c])}return b};h.set=function(a,b){Te(this);this.N=null;a=this.P(a);this.ub(a)&&(this.o=ya(this.o)-this.l.get(a).length);this.l.set(a,[b]);this.o=ya(this.o)+1;return this};h.get=function(a,b){a=a?this.X(a):[];return 0<a.length?String(a[0]):b};var Ue=function(a,b,c){a.remove(b);0<c.length&&(a.N=null,a.l.set(a.P(b),Ma(c)),a.o=ya(a.o)+c.length)};
I.prototype.toString=function(){if(this.N)return this.N;if(!this.l)return"";for(var a=[],b=this.l.ka(),c=0;c<b.length;c++)for(var d=b[c],e=encodeURIComponent(String(d)),d=this.X(d),f=0;f<d.length;f++){var g=e;""!==d[f]&&(g+="="+encodeURIComponent(String(d[f])));a.push(g)}return this.N=a.join("&")};I.prototype.clone=function(){var a=new I;a.N=this.N;this.l&&(a.l=this.l.clone(),a.o=this.o);return a};I.prototype.P=function(a){a=String(a);this.R&&(a=a.toLowerCase());return a};
I.prototype.ld=function(a){a&&!this.R&&(Te(this),this.N=null,this.l.forEach(function(a,c){var b=c.toLowerCase();c!=b&&(this.remove(c),Ue(this,b,a))},this));this.R=a};var We=function(){var a=K();return z&&!!mb&&11==mb||/Edge\/\d+/.test(a)},Xe=function(){return l.window&&l.window.location.href||""},Ye=function(a,b){b=b||l.window;var c="about:blank";a&&(c=qc(tc(a)));b.location.href=c},Ze=function(a,b){var c=[],d;for(d in a)d in b?typeof a[d]!=typeof b[d]?c.push(d):da(a[d])?Ra(a[d],b[d])||c.push(d):"object"==typeof a[d]&&null!=a[d]&&null!=b[d]?0<Ze(a[d],b[d]).length&&c.push(d):a[d]!==b[d]&&c.push(d):c.push(d);for(d in b)d in a||c.push(d);return c},af=function(){var a;
a=K();a="Chrome"!=$e(a)?null:(a=a.match(/\sChrome\/(\d+)/i))&&2==a.length?parseInt(a[1],10):null;return a&&30>a?!1:!z||!mb||9<mb},bf=function(a){a=(a||K()).toLowerCase();return a.match(/android/)||a.match(/webos/)||a.match(/iphone|ipad|ipod/)||a.match(/blackberry/)||a.match(/windows phone/)||a.match(/iemobile/)?!0:!1},cf=function(a){a=a||l.window;try{a.close()}catch(b){}},df=function(a,b,c){var d=Math.floor(1E9*Math.random()).toString();b=b||500;c=c||600;var e=(window.screen.availHeight-c)/2,f=(window.screen.availWidth-
b)/2;b={width:b,height:c,top:0<e?e:0,left:0<f?f:0,location:!0,resizable:!0,statusbar:!0,toolbar:!1};c=K().toLowerCase();d&&(b.target=d,v(c,"crios/")&&(b.target="_blank"));"Firefox"==$e(K())&&(a=a||"http://localhost",b.scrollbars=!0);var g;c=a||"about:blank";(d=b)||(d={});a=window;b=c instanceof pc?c:tc("undefined"!=typeof c.href?c.href:String(c));c=d.target||c.target;e=[];for(g in d)switch(g){case "width":case "height":case "top":case "left":e.push(g+"="+d[g]);break;case "target":case "noreferrer":break;
default:e.push(g+"="+(d[g]?1:0))}g=e.join(",");(y("iPhone")&&!y("iPod")&&!y("iPad")||y("iPad")||y("iPod"))&&a.navigator&&a.navigator.standalone&&c&&"_self"!=c?(g=a.document.createElement("A"),"undefined"!=typeof HTMLAnchorElement&&"undefined"!=typeof Location&&"undefined"!=typeof Element&&(e=g&&(g instanceof HTMLAnchorElement||!(g instanceof Location||g instanceof Element)),f=ga(g)?g.constructor.displayName||g.constructor.name||Object.prototype.toString.call(g):void 0===g?"undefined":null===g?"null":
typeof g,w(e,"Argument is not a HTMLAnchorElement (or a non-Element mock); got: %s",f)),b=b instanceof pc?b:tc(b),g.href=qc(b),g.setAttribute("target",c),d.noreferrer&&g.setAttribute("rel","noreferrer"),d=document.createEvent("MouseEvent"),d.initMouseEvent("click",!0,!0,a,1),g.dispatchEvent(d),g={}):d.noreferrer?(g=a.open("",c,g),d=qc(b),g&&(db&&v(d,";")&&(d="'"+d.replace(/'/g,"%27")+"'"),g.opener=null,a=lc("b/12014412, meta tag with sanitized URL"),ta.test(d)&&(-1!=d.indexOf("&")&&(d=d.replace(na,
"&amp;")),-1!=d.indexOf("<")&&(d=d.replace(oa,"&lt;")),-1!=d.indexOf(">")&&(d=d.replace(pa,"&gt;")),-1!=d.indexOf('"')&&(d=d.replace(qa,"&quot;")),-1!=d.indexOf("'")&&(d=d.replace(ra,"&#39;")),-1!=d.indexOf("\x00")&&(d=d.replace(sa,"&#0;"))),d='<META HTTP-EQUIV="refresh" content="0; url='+d+'">',za(kc(a),"must provide justification"),w(!/^[\s\xa0]*$/.test(kc(a)),"must provide non-empty justification"),g.document.write(wc((new vc).Pe(d))),g.document.close())):g=a.open(qc(b),c,g);if(g)try{g.focus()}catch(k){}return g},
ef=function(a){return new D(function(b){var c=function(){ke(2E3).then(function(){if(!a||a.closed)b();else return c()})};return c()})},ff=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,gf=function(){var a=null;return(new D(function(b){"complete"==l.document.readyState?b():(a=function(){b()},ac(window,"load",a))})).f(function(b){cc(window,"load",a);throw b;})},jf=function(){return hf(void 0)?gf().then(function(){return new D(function(a,b){var c=l.document,d=setTimeout(function(){b(Error("Cordova framework is not ready."))},
1E3);c.addEventListener("deviceready",function(){clearTimeout(d);a()},!1)})}):F(Error("Cordova must run in an Android or iOS file scheme."))},hf=function(a){a=a||K();return!("file:"!==kf()||!a.toLowerCase().match(/iphone|ipad|ipod|android/))},lf=function(){var a=l.window;try{return!(!a||a==a.top)}catch(b){return!1}},L=function(){return firebase.INTERNAL.hasOwnProperty("reactNative")?"ReactNative":firebase.INTERNAL.hasOwnProperty("node")?"Node":"Browser"},mf=function(){var a=L();return"ReactNative"===
a||"Node"===a},$e=function(a){var b=a.toLowerCase();if(v(b,"opera/")||v(b,"opr/")||v(b,"opios/"))return"Opera";if(v(b,"iemobile"))return"IEMobile";if(v(b,"msie")||v(b,"trident/"))return"IE";if(v(b,"edge/"))return"Edge";if(v(b,"firefox/"))return"Firefox";if(v(b,"silk/"))return"Silk";if(v(b,"blackberry"))return"Blackberry";if(v(b,"webos"))return"Webos";if(!v(b,"safari/")||v(b,"chrome/")||v(b,"crios/")||v(b,"android"))if(!v(b,"chrome/")&&!v(b,"crios/")||v(b,"edge/")){if(v(b,"android"))return"Android";
if((a=a.match(/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/))&&2==a.length)return a[1]}else return"Chrome";else return"Safari";return"Other"},nf=function(a){var b=L();return("Browser"===b?$e(K()):b)+"/JsCore/"+a},K=function(){return l.navigator&&l.navigator.userAgent||""},M=function(a,b){a=a.split(".");b=b||l;for(var c=0;c<a.length&&"object"==typeof b&&null!=b;c++)b=b[a[c]];c!=a.length&&(b=void 0);return b},qf=function(){var a;if(a=(of()||"chrome-extension:"===kf()||hf()&&!1)&&!mf())a:{try{var b=l.localStorage,
c=pf();if(b){b.setItem(c,"1");b.removeItem(c);a=We()?!!l.indexedDB:!0;break a}}catch(d){}a=!1}return a},of=function(){return"http:"===kf()||"https:"===kf()},kf=function(){return l.location&&l.location.protocol||null},rf=function(a){a=a||K();return bf(a)||"Firefox"==$e(a)?!1:!0},sf=function(a){return"undefined"===typeof a?null:Sc(a)},tf=function(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&null!==a[c]&&void 0!==a[c]&&(b[c]=a[c]);return b},uf=function(a){if(null!==a)return JSON.parse(a)},pf=function(a){return a?
a:""+Math.floor(1E9*Math.random()).toString()},vf=function(a){a=a||K();return"Safari"==$e(a)||a.toLowerCase().match(/iphone|ipad|ipod/)?!1:!0},wf=function(){var a=l.___jsl;if(a&&a.H)for(var b in a.H)if(a.H[b].r=a.H[b].r||[],a.H[b].L=a.H[b].L||[],a.H[b].r=a.H[b].L.concat(),a.CP)for(var c=0;c<a.CP.length;c++)a.CP[c]=null},xf=function(){return l.navigator&&"boolean"===typeof l.navigator.onLine?l.navigator.onLine:!0},yf=function(a,b,c,d){if(a>b)throw Error("Short delay should be less than long delay!");
this.tf=a;this.Ve=b;a=c||K();d=d||L();this.Re=bf(a)||"ReactNative"===d};yf.prototype.get=function(){return this.Re?this.Ve:this.tf};
var zf=function(){var a=l.document;return a&&"undefined"!==typeof a.visibilityState?"visible"==a.visibilityState:!0},Af=function(){var a=l.document,b=null;return zf()||!a?E():(new D(function(c){b=function(){zf()&&(a.removeEventListener("visibilitychange",b,!1),c())};a.addEventListener("visibilitychange",b,!1)})).f(function(c){a.removeEventListener("visibilitychange",b,!1);throw c;})};var Bf;try{var Cf={};Object.defineProperty(Cf,"abcd",{configurable:!0,enumerable:!0,value:1});Object.defineProperty(Cf,"abcd",{configurable:!0,enumerable:!0,value:2});Bf=2==Cf.abcd}catch(a){Bf=!1}
var N=function(a,b,c){Bf?Object.defineProperty(a,b,{configurable:!0,enumerable:!0,value:c}):a[b]=c},Df=function(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&N(a,c,b[c])},Ef=function(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&(b[c]=a[c]);return b},Ff=function(a,b){if(!b||!b.length)return!0;if(!a)return!1;for(var c=0;c<b.length;c++){var d=a[b[c]];if(void 0===d||null===d||""===d)return!1}return!0},Gf=function(a){var b=a;if("object"==typeof a&&null!=a){var b="length"in a?[]:{},c;for(c in a)N(b,c,
Gf(a[c]))}return b};var Hf="oauth_consumer_key oauth_nonce oauth_signature oauth_signature_method oauth_timestamp oauth_token oauth_version".split(" "),If=["client_id","response_type","scope","redirect_uri","state"],Jf={Df:{Fb:500,Eb:600,providerId:"facebook.com",hd:If},Ef:{Fb:500,Eb:620,providerId:"github.com",hd:If},Ff:{Fb:515,Eb:680,providerId:"google.com",hd:If},Gf:{Fb:485,Eb:705,providerId:"twitter.com",hd:Hf}},Kf=function(a){for(var b in Jf)if(Jf[b].providerId==a)return Jf[b];return null};var O=function(a,b){this.code="auth/"+a;this.message=b||Lf[a]||""};t(O,Error);O.prototype.C=function(){return{code:this.code,message:this.message}};O.prototype.toJSON=function(){return this.C()};
var Mf=function(a){var b=a&&a.code;return b?new O(b.substring(5),a.message):null},Lf={"argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","cordova-not-ready":"Cordova framework is not ready.",
"cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-already-in-use":"The email address is already in use by another account.",
"expired-action-code":"The action code has expired. ","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal error has occurred.","invalid-user-token":"The user's credential is no longer valid. The user must sign in again.","invalid-auth-event":"An internal error has occurred.","invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.",
"invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-email":"The email address is badly formatted.","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-credential":"The supplied auth credential is malformed or has expired.","invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.",
"invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.","invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.",
"invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","missing-iframe-start":"An internal error has occurred.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.",
"app-deleted":"This instance of FirebaseApp has been deleted.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network error (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal error has occurred.","no-such-provider":"User was not linked to an account with the given provider.",
"operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.",
"popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.",
"too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","user-cancelled":"User did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.",
"web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled."};var P=function(a,b,c,d,e){this.ga=a;this.F=b||null;this.qb=c||null;this.kd=d||null;this.O=e||null;if(this.qb||this.O){if(this.qb&&this.O)throw new O("invalid-auth-event");if(this.qb&&!this.kd)throw new O("invalid-auth-event");}else throw new O("invalid-auth-event");};P.prototype.ac=function(){return this.kd};P.prototype.getError=function(){return this.O};P.prototype.C=function(){return{type:this.ga,eventId:this.F,urlResponse:this.qb,sessionId:this.kd,error:this.O&&this.O.C()}};
var Nf=function(a){a=a||{};return a.type?new P(a.type,a.eventId,a.urlResponse,a.sessionId,a.error&&Mf(a.error)):null};var Of=function(a){var b="unauthorized-domain",c=void 0,d=Qe(a);a=d.$;d=d.da;"chrome-extension"==d?c=la("This chrome extension ID (chrome-extension://%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):"http"==d||"https"==d?c=la("This domain (%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):b=
"operation-not-supported-in-this-environment";O.call(this,b,c)};t(Of,O);var Pf=function(a){this.Ue=a.sub;ka();this.Yb=a.email||null};var Qf=function(a,b){if(b.idToken||b.accessToken)b.idToken&&N(this,"idToken",b.idToken),b.accessToken&&N(this,"accessToken",b.accessToken);else if(b.oauthToken&&b.oauthTokenSecret)N(this,"accessToken",b.oauthToken),N(this,"secret",b.oauthTokenSecret);else throw new O("internal-error","failed to construct a credential");N(this,"provider",a)};Qf.prototype.$b=function(a){return Rf(a,Sf(this))};Qf.prototype.Pd=function(a,b){var c=Sf(this);c.idToken=b;return Tf(a,c)};
var Sf=function(a){var b={};a.idToken&&(b.id_token=a.idToken);a.accessToken&&(b.access_token=a.accessToken);a.secret&&(b.oauth_token_secret=a.secret);b.providerId=a.provider;return{postBody:Ve(b).toString(),requestUri:"http://localhost"}};Qf.prototype.C=function(){var a={provider:this.provider};this.idToken&&(a.oauthIdToken=this.idToken);this.accessToken&&(a.oauthAccessToken=this.accessToken);this.secret&&(a.oauthTokenSecret=this.secret);return a};
var Uf=function(a,b){this.hf=b||[];Df(this,{providerId:a,isOAuthProvider:!0});this.yd={}};Uf.prototype.setCustomParameters=function(a){this.yd=Sa(a);return this};var Q=function(a){Uf.call(this,a,If);this.jd=[]};t(Q,Uf);Q.prototype.addScope=function(a){Ha(this.jd,a)||this.jd.push(a);return this};Q.prototype.Gd=function(){return Ma(this.jd)};
Q.prototype.credential=function(a,b){if(!a&&!b)throw new O("argument-error","credential failed: must provide the ID token and/or the access token.");return new Qf(this.providerId,{idToken:a||null,accessToken:b||null})};var Vf=function(){Q.call(this,"facebook.com")};t(Vf,Q);N(Vf,"PROVIDER_ID","facebook.com");var Wf=function(a){if(!a)throw new O("argument-error","credential failed: expected 1 argument (the OAuth access token).");return(new Vf).credential(null,a)},Xf=function(){Q.call(this,"github.com")};
t(Xf,Q);N(Xf,"PROVIDER_ID","github.com");var Yf=function(a){if(!a)throw new O("argument-error","credential failed: expected 1 argument (the OAuth access token).");return(new Xf).credential(null,a)},Zf=function(){Q.call(this,"google.com");this.addScope("profile")};t(Zf,Q);N(Zf,"PROVIDER_ID","google.com");var $f=function(a,b){return(new Zf).credential(a,b)},ag=function(){Uf.call(this,"twitter.com",Hf)};t(ag,Uf);N(ag,"PROVIDER_ID","twitter.com");
var bg=function(a,b){if(!a||!b)throw new O("argument-error","credential failed: expected 2 arguments (the OAuth access token and secret).");return new Qf("twitter.com",{oauthToken:a,oauthTokenSecret:b})},cg=function(a,b){this.Yb=a;this.ad=b;N(this,"provider","password")};cg.prototype.$b=function(a){return R(a,dg,{email:this.Yb,password:this.ad})};cg.prototype.Pd=function(a,b){return R(a,eg,{idToken:b,email:this.Yb,password:this.ad})};cg.prototype.C=function(){return{email:this.Yb,password:this.ad}};
var fg=function(){Df(this,{providerId:"password",isOAuthProvider:!1})};Df(fg,{PROVIDER_ID:"password"});
var gg=function(a){var b=a&&a.providerId;if(!b||"password"===b)return null;var c=a&&a.oauthAccessToken,d=a&&a.oauthTokenSecret;a=a&&a.oauthIdToken;try{switch(b){case "google.com":return $f(a,c);case "facebook.com":return Wf(c);case "github.com":return Yf(c);case "twitter.com":return bg(c,d);default:return(new Q(b)).credential(a,c)}}catch(e){return null}},hg=function(a){if(!a.isOAuthProvider)throw new O("invalid-oauth-provider");};var ig=function(a,b,c,d){O.call(this,a,d);N(this,"email",b);N(this,"credential",c)};t(ig,O);ig.prototype.C=function(){var a={code:this.code,message:this.message,email:this.email},b=this.credential&&this.credential.C();b&&(Ua(a,b),a.providerId=b.provider,delete a.provider);return a};ig.prototype.toJSON=function(){return this.C()};var jg=function(a){if(a.code){var b=a.code||"";0==b.indexOf("auth/")&&(b=b.substring(5));return a.email?new ig(b,a.email,gg(a),a.message):new O(b,a.message||void 0)}return null};var kg=function(a){this.Cf=a};t(kg,Wc);kg.prototype.Xb=function(){return new this.Cf};kg.prototype.Uc=function(){return{}};
var S=function(a,b,c){var d;d="Node"==L();d=l.XMLHttpRequest||d&&firebase.INTERNAL.node&&firebase.INTERNAL.node.XMLHttpRequest;if(!d)throw new O("internal-error","The XMLHttpRequest compatibility library was not found.");this.j=a;a=b||{};this.pf=a.secureTokenEndpoint||"https://securetoken.googleapis.com/v1/token";this.qf=a.secureTokenTimeout||lg;this.Yd=Sa(a.secureTokenHeaders||mg);this.Ae=a.firebaseEndpoint||"https://www.googleapis.com/identitytoolkit/v3/relyingparty/";this.Be=a.firebaseTimeout||
ng;this.Ed=Sa(a.firebaseHeaders||og);c&&(this.Ed["X-Client-Version"]=c,this.Yd["X-Client-Version"]=c);this.te=new ad;this.Bf=new kg(d)},pg,lg=new yf(3E4,6E4),mg={"Content-Type":"application/x-www-form-urlencoded"},ng=new yf(3E4,6E4),og={"Content-Type":"application/json"},rg=function(a,b,c,d,e,f,g){xf()?(af()?a=r(a.sf,a):(pg||(pg=new D(function(a,b){qg(a,b)})),a=r(a.rf,a)),a(b,c,d,e,f,g)):c&&c(null)};
S.prototype.sf=function(a,b,c,d,e,f){var g="Node"==L(),k=mf()?g?new G(this.Bf):new G:new G(this.te),n;f&&(k.ob=Math.max(0,f),n=setTimeout(function(){k.dispatchEvent("timeout")},f));k.listen("complete",function(){n&&clearTimeout(n);var a=null;try{a=JSON.parse(Ae(this))||null}catch(Xa){a=null}b&&b(a)});bc(k,"ready",function(){n&&clearTimeout(n);this.Ba||(this.Ba=!0,this.Wa())});bc(k,"timeout",function(){n&&clearTimeout(n);this.Ba||(this.Ba=!0,this.Wa());b&&b(null)});k.send(a,c,d,e)};
var Wd="__fcb"+Math.floor(1E6*Math.random()).toString(),qg=function(a,b){((window.gapi||{}).client||{}).request?a():(l[Wd]=function(){((window.gapi||{}).client||{}).request?a():b(Error("CORS_UNSUPPORTED"))},Yd(function(){b(Error("CORS_UNSUPPORTED"))}))};
S.prototype.rf=function(a,b,c,d,e){var f=this;pg.then(function(){window.gapi.client.setApiKey(f.j);var g=window.gapi.auth.getToken();window.gapi.auth.setToken(null);window.gapi.client.request({path:a,method:c,body:d,headers:e,authType:"none",callback:function(a){window.gapi.auth.setToken(g);b&&b(a)}})}).f(function(a){b&&b({error:{message:a&&a.message||"CORS_UNSUPPORTED"}})})};
var tg=function(a,b){return new D(function(c,d){"refresh_token"==b.grant_type&&b.refresh_token||"authorization_code"==b.grant_type&&b.code?rg(a,a.pf+"?key="+encodeURIComponent(a.j),function(a){a?a.error?d(sg(a)):a.access_token&&a.refresh_token?c(a):d(new O("internal-error")):d(new O("network-request-failed"))},"POST",Ve(b).toString(),a.Yd,a.qf.get()):d(new O("internal-error"))})},ug=function(a,b,c,d,e){var f=Qe(a.Ae+b);J(f,"key",a.j);e&&J(f,"cb",ka().toString());var g="GET"==c;if(g)for(var k in d)d.hasOwnProperty(k)&&
J(f,k,d[k]);return new D(function(b,e){rg(a,f.toString(),function(a){a?a.error?e(sg(a)):b(a):e(new O("network-request-failed"))},c,g?void 0:Sc(tf(d)),a.Ed,a.Be.get())})},vg=function(a){if(!hc.test(a.email))throw new O("invalid-email");},wg=function(a){"email"in a&&vg(a)},yg=function(a,b){return R(a,xg,{identifier:b,continueUri:of()?Xe():"http://localhost"}).then(function(a){return a.allProviders||[]})},Ag=function(a){return R(a,zg,{}).then(function(a){return a.authorizedDomains||[]})},Bg=function(a){if(!a.idToken)throw new O("internal-error");
};S.prototype.signInAnonymously=function(){return R(this,Cg,{})};S.prototype.updateEmail=function(a,b){return R(this,Dg,{idToken:a,email:b})};S.prototype.updatePassword=function(a,b){return R(this,eg,{idToken:a,password:b})};var Eg={displayName:"DISPLAY_NAME",photoUrl:"PHOTO_URL"};S.prototype.updateProfile=function(a,b){var c={idToken:a},d=[];Na(Eg,function(a,f){var e=b[f];null===e?d.push(a):f in b&&(c[f]=e)});d.length&&(c.deleteAttribute=d);return R(this,Dg,c)};
S.prototype.sendPasswordResetEmail=function(a){return R(this,Fg,{requestType:"PASSWORD_RESET",email:a})};S.prototype.sendEmailVerification=function(a){return R(this,Gg,{requestType:"VERIFY_EMAIL",idToken:a})};
var Ig=function(a,b,c){return R(a,Hg,{idToken:b,deleteProvider:c})},Jg=function(a){if(!a.requestUri||!a.sessionId&&!a.postBody)throw new O("internal-error");},Kg=function(a){var b=null;a.needConfirmation?(a.code="account-exists-with-different-credential",b=jg(a)):"FEDERATED_USER_ID_ALREADY_LINKED"==a.errorMessage?(a.code="credential-already-in-use",b=jg(a)):"EMAIL_EXISTS"==a.errorMessage&&(a.code="email-already-in-use",b=jg(a));if(b)throw b;if(!a.idToken)throw new O("internal-error");},Rf=function(a,
b){b.returnIdpCredential=!0;return R(a,Lg,b)},Tf=function(a,b){b.returnIdpCredential=!0;return R(a,Mg,b)},Ng=function(a){if(!a.oobCode)throw new O("invalid-action-code");};S.prototype.confirmPasswordReset=function(a,b){return R(this,Og,{oobCode:a,newPassword:b})};S.prototype.checkActionCode=function(a){return R(this,Pg,{oobCode:a})};S.prototype.applyActionCode=function(a){return R(this,Qg,{oobCode:a})};
var Qg={endpoint:"setAccountInfo",K:Ng,nb:"email"},Pg={endpoint:"resetPassword",K:Ng,va:function(a){if(!a.email||!a.requestType)throw new O("internal-error");}},Rg={endpoint:"signupNewUser",K:function(a){vg(a);if(!a.password)throw new O("weak-password");},va:Bg,wa:!0},xg={endpoint:"createAuthUri"},Sg={endpoint:"deleteAccount",mb:["idToken"]},Hg={endpoint:"setAccountInfo",mb:["idToken","deleteProvider"],K:function(a){if(!da(a.deleteProvider))throw new O("internal-error");}},Tg={endpoint:"getAccountInfo"},
Gg={endpoint:"getOobConfirmationCode",mb:["idToken","requestType"],K:function(a){if("VERIFY_EMAIL"!=a.requestType)throw new O("internal-error");},nb:"email"},Fg={endpoint:"getOobConfirmationCode",mb:["requestType"],K:function(a){if("PASSWORD_RESET"!=a.requestType)throw new O("internal-error");vg(a)},nb:"email"},zg={se:!0,endpoint:"getProjectConfig",Le:"GET"},Og={endpoint:"resetPassword",K:Ng,nb:"email"},Dg={endpoint:"setAccountInfo",mb:["idToken"],K:wg,wa:!0},eg={endpoint:"setAccountInfo",mb:["idToken"],
K:function(a){wg(a);if(!a.password)throw new O("weak-password");},va:Bg,wa:!0},Cg={endpoint:"signupNewUser",va:Bg,wa:!0},Lg={endpoint:"verifyAssertion",K:Jg,va:Kg,wa:!0},Mg={endpoint:"verifyAssertion",K:function(a){Jg(a);if(!a.idToken)throw new O("internal-error");},va:Kg,wa:!0},Ug={endpoint:"verifyCustomToken",K:function(a){if(!a.token)throw new O("invalid-custom-token");},va:Bg,wa:!0},dg={endpoint:"verifyPassword",K:function(a){vg(a);if(!a.password)throw new O("wrong-password");},va:Bg,wa:!0},R=
function(a,b,c){if(!Ff(c,b.mb))return F(new O("internal-error"));var d=b.Le||"POST",e;return E(c).then(b.K).then(function(){b.wa&&(c.returnSecureToken=!0);return ug(a,b.endpoint,d,c,b.se||!1)}).then(function(a){return e=a}).then(b.va).then(function(){if(!b.nb)return e;if(!(b.nb in e))throw new O("internal-error");return e[b.nb]})},sg=function(a){var b,c;c=(a.error&&a.error.errors&&a.error.errors[0]||{}).reason||"";var d={keyInvalid:"invalid-api-key",ipRefererBlocked:"app-not-authorized"};if(c=d[c]?
new O(d[c]):null)return c;c=a.error&&a.error.message||"";d={INVALID_CUSTOM_TOKEN:"invalid-custom-token",CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_EMAIL:"invalid-email",INVALID_PASSWORD:"wrong-password",USER_DISABLED:"user-disabled",MISSING_PASSWORD:"internal-error",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",
FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",INVALID_MESSAGE_PAYLOAD:"invalid-message-payload",INVALID_RECIPIENT_EMAIL:"invalid-recipient-email",INVALID_SENDER:"invalid-sender",EMAIL_NOT_FOUND:"user-not-found",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",
CORS_UNSUPPORTED:"cors-unsupported",DYNAMIC_LINK_NOT_ACTIVATED:"dynamic-link-not-activated",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",WEAK_PASSWORD:"weak-password",OPERATION_NOT_ALLOWED:"operation-not-allowed",USER_CANCELLED:"user-cancelled"};b=(b=c.match(/^[^\s]+\s*:\s*(.*)$/))&&1<b.length?b[1]:void 0;for(var e in d)if(0===c.indexOf(e))return new O(d[e],b);!b&&a&&(b=sf(a));return new O("internal-error",b)};var Vg=function(a){this.U=a};Vg.prototype.value=function(){return this.U};Vg.prototype.ae=function(a){this.U.style=a;return this};var Wg=function(a){this.U=a||{}};Wg.prototype.value=function(){return this.U};Wg.prototype.ae=function(a){this.U.style=a;return this};var Yg=function(a){this.zf=a;this.gc=null;this.Zc=Xg(this)},Zg=function(a){var b=new Wg;b.U.where=document.body;b.U.url=a.zf;b.U.messageHandlersFilter=M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER");b.U.attributes=b.U.attributes||{};(new Vg(b.U.attributes)).ae({position:"absolute",top:"-100px",width:"1px",height:"1px"});b.U.dontclear=!0;return b},Xg=function(a){return $g().then(function(){return new D(function(b,c){M("gapi.iframes.getContext")().open(Zg(a).value(),function(d){a.gc=d;a.gc.restyle({setHideOnLeave:!1});
var e=setTimeout(function(){c(Error("Network Error"))},ah.get()),f=function(){clearTimeout(e);b()};d.ping(f).then(f,function(){c(Error("Network Error"))})})})})};Yg.prototype.sendMessage=function(a){var b=this;return this.Zc.then(function(){return new D(function(c){b.gc.send(a.type,a,c,M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"))})})};
var bh=function(a,b){a.Zc.then(function(){a.gc.register("authEvent",b,M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"))})},ch=new yf(3E4,6E4),ah=new yf(5E3,15E3),$g=function(){return new D(function(a,b){if(xf()){var c=function(){wf();M("gapi.load")("gapi.iframes",{callback:a,ontimeout:function(){wf();b(Error("Network Error"))},timeout:ch.get()})};if(M("gapi.iframes.Iframe"))a();else if(M("gapi.load"))c();else{var d="__iframefcb"+Math.floor(1E6*Math.random()).toString();l[d]=function(){M("gapi.load")?
c():b(Error("Network Error"))};E(Vd("https://apis.google.com/js/api.js?onload="+d)).f(function(){b(Error("Network Error"))})}}else b(Error("Network Error"))})};var dh=function(a,b,c){this.v=a;this.j=b;this.B=c;this.Qa=null;this.Sb=Re(this.v,"/__/auth/iframe");J(this.Sb,"apiKey",this.j);J(this.Sb,"appName",this.B)};dh.prototype.setVersion=function(a){this.Qa=a;return this};dh.prototype.toString=function(){this.Qa?J(this.Sb,"v",this.Qa):Pe(this.Sb,"v");return this.Sb.toString()};var eh=function(a,b,c,d,e){this.v=a;this.j=b;this.B=c;this.re=d;this.Qa=this.F=this.fd=null;this.Ib=e};eh.prototype.setVersion=function(a){this.Qa=a;return this};
eh.prototype.toString=function(){var a=Re(this.v,"/__/auth/handler");J(a,"apiKey",this.j);J(a,"appName",this.B);J(a,"authType",this.re);if(this.Ib.isOAuthProvider){J(a,"providerId",this.Ib.providerId);var b=this.Ib,c=tf(b.yd),d;for(d in c)c[d]=c[d].toString();b=b.hf;c=Sa(c);for(d=0;d<b.length;d++){var e=b[d];e in c&&delete c[e]}Qa(c)||J(a,"customParameters",sf(c))}"function"===typeof this.Ib.Gd&&(b=this.Ib.Gd(),b.length&&J(a,"scopes",b.join(",")));this.fd?J(a,"redirectUrl",this.fd):Pe(a,"redirectUrl");
this.F?J(a,"eventId",this.F):Pe(a,"eventId");this.Qa?J(a,"v",this.Qa):Pe(a,"v");if(this.Tb)for(var f in this.Tb)this.Tb.hasOwnProperty(f)&&!Oe(a,f)&&J(a,f,this.Tb[f]);return a.toString()};
var fh=function(a,b,c,d){this.v=a;this.j=b;this.B=c;this.De=(this.Aa=d||null)?nf(this.Aa):null;d=this.Aa;this.Me=(new dh(a,b,c)).setVersion(d).toString();this.ia=[];this.g=new S(b,null,this.De);this.jc=this.sa=null},hh=function(a){var b=Xe();return Ag(a).then(function(a){a:{for(var c=Qe(b),e=c.da,c=c.$,f=0;f<a.length;f++){var g;var k=a[f];g=c;var n=e;0==k.indexOf("chrome-extension://")?g=Qe(k).$==g&&"chrome-extension"==n:"http"!=n&&"https"!=n?g=!1:ff.test(k)?g=g==k:(k=k.split(".").join("\\."),g=(new RegExp("^(.+\\."+
k+"|"+k+")$","i")).test(g));if(g){a=!0;break a}}a=!1}if(!a)throw new Of(Xe());})};h=fh.prototype;h.zb=function(){if(this.jc)return this.jc;var a=this;return this.jc=gf().then(function(){a.fc=new Yg(a.Me);ih(a)})};h.Nb=function(a,b,c){var d=new O("popup-closed-by-user"),e=new O("web-storage-unsupported"),f=this,g=!1;return this.Ga().then(function(){jh(f).then(function(c){c||(a&&cf(a),b(e),g=!0)})}).f(function(){}).then(function(){if(!g)return ef(a)}).then(function(){if(!g)return ke(c).then(function(){b(d)})})};
h.be=function(){var a=K();return!rf(a)&&!vf(a)};h.Jd=function(){return!1};h.Gb=function(a,b,c,d,e,f,g){if(!a)return F(new O("popup-blocked"));if(g&&!rf())return this.Ga().f(function(b){cf(a);e(b)}),d(),E();this.sa||(this.sa=hh(this.g));var k=this;return this.sa.then(function(){var b=k.Ga().f(function(b){cf(a);e(b);throw b;});d();return b}).then(function(){hg(c);if(!g){var d=kh(k.v,k.j,k.B,b,c,null,f,k.Aa);Ye(d,a)}}).f(function(a){"auth/network-request-failed"==a.code&&(k.sa=null);throw a;})};
h.Hb=function(a,b,c){this.sa||(this.sa=hh(this.g));var d=this;return this.sa.then(function(){hg(b);var e=kh(d.v,d.j,d.B,a,b,Xe(),c,d.Aa);Ye(e)})};h.Ga=function(){var a=this;return this.zb().then(function(){return a.fc.Zc}).f(function(){a.sa=null;throw new O("network-request-failed");})};h.ee=function(){return!0};
var kh=function(a,b,c,d,e,f,g,k,n){a=new eh(a,b,c,d,e);a.fd=f;a.F=g;f=a.setVersion(k);f.Tb=Sa(n||null);return f.toString()},ih=function(a){if(!a.fc)throw Error("IfcHandler must be initialized!");bh(a.fc,function(b){var c={};if(b&&b.authEvent){var d=!1;b=Nf(b.authEvent);for(c=0;c<a.ia.length;c++)d=a.ia[c](b)||d;c={};c.status=d?"ACK":"ERROR";return E(c)}c.status="ERROR";return E(c)})},jh=function(a){var b={type:"webStorageSupport"};return a.zb().then(function(){return a.fc.sendMessage(b)}).then(function(a){if(a&&
a.length&&"undefined"!==typeof a[0].webStorageSupport)return a[0].webStorageSupport;throw Error();})};fh.prototype.Sa=function(a){this.ia.push(a)};fh.prototype.Lb=function(a){Ka(this.ia,function(b){return b==a})};var lh=function(a){this.A=a||firebase.INTERNAL.reactNative&&firebase.INTERNAL.reactNative.AsyncStorage;if(!this.A)throw new O("internal-error","The React Native compatibility library was not found.");};h=lh.prototype;h.get=function(a){return E(this.A.getItem(a)).then(function(a){return a&&uf(a)})};h.set=function(a,b){return E(this.A.setItem(a,sf(b)))};h.remove=function(a){return E(this.A.removeItem(a))};h.Ta=function(){};h.Na=function(){};var mh=function(){this.A={}};h=mh.prototype;h.get=function(a){return E(this.A[a])};h.set=function(a,b){this.A[a]=b;return E()};h.remove=function(a){delete this.A[a];return E()};h.Ta=function(){};h.Na=function(){};var oh=function(){if(!nh()){if("Node"==L())throw new O("internal-error","The LocalStorage compatibility library was not found.");throw new O("web-storage-unsupported");}this.A=l.localStorage||firebase.INTERNAL.node.localStorage},nh=function(){var a="Node"==L(),a=l.localStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.localStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=oh.prototype;
h.get=function(a){var b=this;return E().then(function(){var c=b.A.getItem(a);return uf(c)})};h.set=function(a,b){var c=this;return E().then(function(){var d=sf(b);null===d?c.remove(a):c.A.setItem(a,d)})};h.remove=function(a){var b=this;return E().then(function(){b.A.removeItem(a)})};h.Ta=function(a){l.window&&Ub(l.window,"storage",a)};h.Na=function(a){l.window&&cc(l.window,"storage",a)};var ph=function(){this.A={}};h=ph.prototype;h.get=function(){return E(null)};h.set=function(){return E()};h.remove=function(){return E()};h.Ta=function(){};h.Na=function(){};var rh=function(){if(!qh()){if("Node"==L())throw new O("internal-error","The SessionStorage compatibility library was not found.");throw new O("web-storage-unsupported");}this.A=l.sessionStorage||firebase.INTERNAL.node.sessionStorage},qh=function(){var a="Node"==L(),a=l.sessionStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.sessionStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=rh.prototype;
h.get=function(a){var b=this;return E().then(function(){var c=b.A.getItem(a);return uf(c)})};h.set=function(a,b){var c=this;return E().then(function(){var d=sf(b);null===d?c.remove(a):c.A.setItem(a,d)})};h.remove=function(a){var b=this;return E().then(function(){b.A.removeItem(a)})};h.Ta=function(){};h.Na=function(){};var sh=function(a,b,c,d,e,f){if(!window.indexedDB)throw new O("web-storage-unsupported");this.ve=a;this.Yc=b;this.Kc=c;this.ie=d;this.sb=e;this.Y={};this.Ob=[];this.Cb=0;this.Ne=f||l.indexedDB},th,uh=function(a){return new D(function(b,c){var d=a.Ne.open(a.ve,a.sb);d.onerror=function(a){c(Error(a.target.errorCode))};d.onupgradeneeded=function(b){b=b.target.result;try{b.createObjectStore(a.Yc,{keyPath:a.Kc})}catch(f){c(f)}};d.onsuccess=function(a){b(a.target.result)}})},vh=function(a){a.Md||(a.Md=
uh(a));return a.Md},wh=function(a,b){return b.objectStore(a.Yc)},xh=function(a,b,c){return b.transaction([a.Yc],c?"readwrite":"readonly")},yh=function(a){return new D(function(b,c){a.onsuccess=function(a){a&&a.target?b(a.target.result):b()};a.onerror=function(a){c(Error(a.target.errorCode))}})};h=sh.prototype;
h.set=function(a,b){var c=!1,d,e=this;return Ed(vh(this).then(function(b){d=b;b=wh(e,xh(e,d,!0));return yh(b.get(a))}).then(function(f){var g=wh(e,xh(e,d,!0));if(f)return f.value=b,yh(g.put(f));e.Cb++;c=!0;f={};f[e.Kc]=a;f[e.ie]=b;return yh(g.add(f))}).then(function(){e.Y[a]=b}),function(){c&&e.Cb--})};h.get=function(a){var b=this;return vh(this).then(function(c){return yh(wh(b,xh(b,c,!1)).get(a))}).then(function(a){return a&&a.value})};
h.remove=function(a){var b=!1,c=this;return Ed(vh(this).then(function(d){b=!0;c.Cb++;return yh(wh(c,xh(c,d,!0))["delete"](a))}).then(function(){delete c.Y[a]}),function(){b&&c.Cb--})};
h.vf=function(){var a=this;return vh(this).then(function(b){var c=wh(a,xh(a,b,!1));return c.getAll?yh(c.getAll()):new D(function(a,b){var d=[],e=c.openCursor();e.onsuccess=function(b){(b=b.target.result)?(d.push(b.value),b["continue"]()):a(d)};e.onerror=function(a){b(Error(a.target.errorCode))}})}).then(function(b){var c={},d=[];if(0==a.Cb){for(d=0;d<b.length;d++)c[b[d][a.Kc]]=b[d][a.ie];d=Ze(a.Y,c);a.Y=c}return d})};h.Ta=function(a){0==this.Ob.length&&this.nd();this.Ob.push(a)};
h.Na=function(a){Ka(this.Ob,function(b){return b==a});0==this.Ob.length&&this.wc()};h.nd=function(){var a=this;this.wc();var b=function(){a.bd=ke(800).then(r(a.vf,a)).then(function(b){0<b.length&&x(a.Ob,function(a){a(b)})}).then(b).f(function(a){"STOP_EVENT"!=a.message&&b()});return a.bd};b()};h.wc=function(){this.bd&&this.bd.cancel("STOP_EVENT")};var Ch=function(){this.Bd={Browser:zh,Node:Ah,ReactNative:Bh}[L()]},Dh,zh={I:oh,qd:rh},Ah={I:oh,qd:rh},Bh={I:lh,qd:ph};var Eh=function(a){var b={},c=a.email,d=a.newEmail;a=a.requestType;if(!c||!a)throw Error("Invalid provider user info!");b.fromEmail=d||null;b.email=c;N(this,"operation",a);N(this,"data",Gf(b))};var Fh="First Second Third Fourth Fifth Sixth Seventh Eighth Ninth".split(" "),T=function(a,b){return{name:a||"",fa:"a valid string",optional:!!b,ha:p}},Gh=function(a){return{name:a||"",fa:"a valid object",optional:!1,ha:ga}},Hh=function(a,b){return{name:a||"",fa:"a function",optional:!!b,ha:q}},Ih=function(){return{name:"",fa:"null",optional:!1,ha:ca}},Jh=function(){return{name:"credential",fa:"a valid credential",optional:!1,ha:function(a){return!(!a||!a.$b)}}},Kh=function(){return{name:"authProvider",
fa:"a valid Auth provider",optional:!1,ha:function(a){return!!(a&&a.providerId&&a.hasOwnProperty&&a.hasOwnProperty("isOAuthProvider"))}}},Lh=function(a,b,c,d){return{name:c||"",fa:a.fa+" or "+b.fa,optional:!!d,ha:function(c){return a.ha(c)||b.ha(c)}}};var Mh=function(a,b,c,d,e,f){this.bf=a;this.kf=b;this.Fe=c;this.lc=d;this.rd=e;this.lf=!!f;this.cb=null;this.Ha=this.lc;if(this.rd<this.lc)throw Error("Proactive refresh lower bound greater than upper bound!");};Mh.prototype.start=function(){this.Ha=this.lc;Nh(this,!0)};
var Oh=function(a,b){if(b)return a.Ha=a.lc,a.Fe();b=a.Ha;a.Ha*=2;a.Ha>a.rd&&(a.Ha=a.rd);return b},Nh=function(a,b){a.stop();a.cb=ke(Oh(a,b)).then(function(){return a.lf?E():Af()}).then(function(){return a.bf()}).then(function(){Nh(a,!0)}).f(function(b){a.kf(b)&&Nh(a,!1)})};Mh.prototype.stop=function(){this.cb&&(this.cb.cancel(),this.cb=null)};var U=function(a,b){for(var c in b){var d=b[c].name;a[d]=Ph(d,a[c],b[c].a)}},V=function(a,b,c,d){a[b]=Ph(b,c,d)},Ph=function(a,b,c){if(!c)return b;var d=Qh(a);a=function(){var a=Array.prototype.slice.call(arguments),e;a:{e=Array.prototype.slice.call(a);var k;k=0;for(var n=!1,A=0;A<c.length;A++)if(c[A].optional)n=!0;else{if(n)throw new O("internal-error","Argument validator encountered a required argument after an optional argument.");k++}n=c.length;if(e.length<k||n<e.length)e="Expected "+(k==n?1==
k?"1 argument":k+" arguments":k+"-"+n+" arguments")+" but got "+e.length+".";else{for(k=0;k<e.length;k++)if(n=c[k].optional&&void 0===e[k],!c[k].ha(e[k])&&!n){e=c[k];if(0>k||k>=Fh.length)throw new O("internal-error","Argument validator received an unsupported number of arguments.");e=Fh[k]+" argument "+(e.name?'"'+e.name+'" ':"")+"must be "+e.fa+".";break a}e=null}}if(e)throw new O("argument-error",d+" failed: "+e);return b.apply(this,a)};for(var e in b)a[e]=b[e];for(e in b.prototype)a.prototype[e]=
b.prototype[e];return a},Qh=function(a){a=a.split(".");return a[a.length-1]};var Rh=function(a,b,c,d){this.Ye=a;this.Zd=b;this.mf=c;this.Mb=d;this.S={};Dh||(Dh=new Ch);a=Dh;try{var e;We()?(th||(th=new sh("firebaseLocalStorageDb","firebaseLocalStorage","fbase_key","value",1)),e=th):e=new a.Bd.I;this.La=e}catch(f){this.La=new mh,this.Mb=!0}try{this.yc=new a.Bd.qd}catch(f){this.yc=new mh}this.od=r(this.ce,this);this.Y={}},Sh,Th=function(){Sh||(Sh=new Rh("firebase",":",!vf(K())&&lf()?!0:!1,rf()));return Sh};h=Rh.prototype;
h.P=function(a,b){return this.Ye+this.Zd+a.name+(b?this.Zd+b:"")};h.get=function(a,b){return(a.I?this.La:this.yc).get(this.P(a,b))};h.remove=function(a,b){b=this.P(a,b);a.I&&!this.Mb&&(this.Y[b]=null);return(a.I?this.La:this.yc).remove(b)};h.set=function(a,b,c){var d=this.P(a,c),e=this,f=a.I?this.La:this.yc;return f.set(d,b).then(function(){return f.get(d)}).then(function(b){a.I&&!this.Mb&&(e.Y[d]=b)})};
h.addListener=function(a,b,c){a=this.P(a,b);this.Mb||(this.Y[a]=l.localStorage.getItem(a));Qa(this.S)&&this.nd();this.S[a]||(this.S[a]=[]);this.S[a].push(c)};h.removeListener=function(a,b,c){a=this.P(a,b);this.S[a]&&(Ka(this.S[a],function(a){return a==c}),0==this.S[a].length&&delete this.S[a]);Qa(this.S)&&this.wc()};h.nd=function(){this.La.Ta(this.od);this.Mb||We()||Uh(this)};
var Uh=function(a){Vh(a);a.Xc=setInterval(function(){for(var b in a.S){var c=l.localStorage.getItem(b),d=a.Y[b];c!=d&&(a.Y[b]=c,c=new Jb({type:"storage",key:b,target:window,oldValue:d,newValue:c,df:!0}),a.ce(c))}},1E3)},Vh=function(a){a.Xc&&(clearInterval(a.Xc),a.Xc=null)};Rh.prototype.wc=function(){this.La.Na(this.od);Vh(this)};
Rh.prototype.ce=function(a){if(a&&a.Ee){var b=a.Xa.key;"undefined"!==typeof a.Xa.df?this.La.Na(this.od):Vh(this);if(this.mf){var c=l.localStorage.getItem(b);a=a.Xa.newValue;a!=c&&(a?l.localStorage.setItem(b,a):a||l.localStorage.removeItem(b))}this.Y[b]=l.localStorage.getItem(b);this.ud(b)}else x(a,r(this.ud,this))};Rh.prototype.ud=function(a){this.S[a]&&x(this.S[a],function(a){a()})};var Wh=function(a,b){this.u=a;this.i=b||Th()},Xh={name:"authEvent",I:!0},Yh=function(a){return a.i.get(Xh,a.u).then(function(a){return Nf(a)})};Wh.prototype.Sa=function(a){this.i.addListener(Xh,this.u,a)};Wh.prototype.Lb=function(a){this.i.removeListener(Xh,this.u,a)};var Zh=function(a){this.i=a||Th()},$h={name:"sessionId",I:!1};Zh.prototype.ac=function(a){return this.i.get($h,a)};var ai=function(a,b,c,d,e,f){this.v=a;this.j=b;this.B=c;this.Aa=d||null;this.de=b+":"+c;this.nf=new Zh;this.Fd=new Wh(this.de);this.Tc=null;this.ia=[];this.Qe=e||500;this.ff=f||2E3;this.yb=this.oc=null},bi=function(a){return new O("invalid-cordova-configuration",a)};
ai.prototype.Ga=function(){return this.Vc?this.Vc:this.Vc=jf().then(function(){if("function"!==typeof M("universalLinks.subscribe",l))throw bi("cordova-universal-links-plugin is not installed");if("undefined"===typeof M("BuildInfo.packageName",l))throw bi("cordova-plugin-buildinfo is not installed");if("function"!==typeof M("cordova.plugins.browsertab.openUrl",l))throw bi("cordova-plugin-browsertab is not installed");if("function"!==typeof M("cordova.InAppBrowser.open",l))throw bi("cordova-plugin-inappbrowser is not installed");
},function(){throw new O("cordova-not-ready");})};var ci=function(){for(var a=20,b=[];0<a;)b.push("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(62*Math.random()))),a--;return b.join("")},di=function(a){var b=new Db;b.update(a);return ob(b.digest())};h=ai.prototype;h.Nb=function(a,b){b(new O("operation-not-supported-in-this-environment"));return E()};h.Gb=function(){return F(new O("operation-not-supported-in-this-environment"))};h.ee=function(){return!1};h.be=function(){return!0};
h.Jd=function(){return!0};
h.Hb=function(a,b,c){if(this.oc)return F(new O("redirect-operation-pending"));var d=this,e=l.document,f=null,g=null,k=null,n=null;return this.oc=Ed(E().then(function(){hg(b);return ei(d)}).then(function(){return fi(d,a,b,c)}).then(function(){return(new D(function(a,b){g=function(){var b=M("cordova.plugins.browsertab.close",l);a();"function"===typeof b&&b();d.yb&&"function"===typeof d.yb.close&&(d.yb.close(),d.yb=null);return!1};d.Sa(g);k=function(){f||(f=ke(d.ff).then(function(){b(new O("redirect-cancelled-by-user"))}))};n=
function(){zf()&&k()};e.addEventListener("resume",k,!1);K().toLowerCase().match(/android/)||e.addEventListener("visibilitychange",n,!1)})).f(function(a){return gi(d).then(function(){throw a;})})}),function(){k&&e.removeEventListener("resume",k,!1);n&&e.removeEventListener("visibilitychange",n,!1);f&&f.cancel();g&&d.Lb(g);d.oc=null})};
var fi=function(a,b,c,d){var e=ci(),f=new P(b,d,null,e,new O("no-auth-event")),g=M("BuildInfo.packageName",l);if("string"!==typeof g)throw new O("invalid-cordova-configuration");var k=M("BuildInfo.displayName",l),n={};if(K().toLowerCase().match(/iphone|ipad|ipod/))n.ibi=g;else if(K().toLowerCase().match(/android/))n.apn=g;else return F(new O("operation-not-supported-in-this-environment"));k&&(n.appDisplayName=k);e=di(e);n.sessionId=e;var A=kh(a.v,a.j,a.B,b,c,null,d,a.Aa,n);return a.Ga().then(function(){var b=
a.de;return a.nf.i.set(Xh,f.C(),b)}).then(function(){var b=M("cordova.plugins.browsertab.isAvailable",l);if("function"!==typeof b)throw new O("invalid-cordova-configuration");var c=null;b(function(b){if(b){c=M("cordova.plugins.browsertab.openUrl",l);if("function"!==typeof c)throw new O("invalid-cordova-configuration");c(A)}else{c=M("cordova.InAppBrowser.open",l);if("function"!==typeof c)throw new O("invalid-cordova-configuration");b=c;var d;d=K();d=!(!d.match(/(iPad|iPhone|iPod).*OS 7_\d/i)&&!d.match(/(iPad|iPhone|iPod).*OS 8_\d/i));
a.yb=b(A,d?"_blank":"_system","location=yes")}})})},hi=function(a,b){for(var c=0;c<a.ia.length;c++)try{a.ia[c](b)}catch(d){}},ei=function(a){a.Tc||(a.Tc=a.Ga().then(function(){return new D(function(b){var c=function(d){b(d);a.Lb(c);return!1};a.Sa(c);ii(a)})}));return a.Tc},gi=function(a){var b=null;return Yh(a.Fd).then(function(c){b=c;c=a.Fd;return c.i.remove(Xh,c.u)}).then(function(){return b})},ii=function(a){var b=M("universalLinks.subscribe",l);if("function"!==typeof b)throw new O("invalid-cordova-configuration");
var c=new P("unknown",null,null,null,new O("no-auth-event")),d=!1,e=ke(a.Qe).then(function(){return gi(a).then(function(){d||hi(a,c)})}),f=function(b){d=!0;e&&e.cancel();gi(a).then(function(d){var e=c;if(d&&b&&b.url){var e=null,f;f=b.url;var g=Qe(f),k=Oe(g,"link"),n=Oe(Qe(k),"link"),g=Oe(g,"deep_link_id");f=Oe(Qe(g),"link")||g||n||k||f;-1!=f.indexOf("/__/auth/callback")&&(e=Qe(f),e=uf(Oe(e,"firebaseError")||null),e=(e="object"===typeof e?Mf(e):null)?new P(d.ga,d.F,null,null,e):new P(d.ga,d.F,f,d.ac()));
e=e||c}hi(a,e)})},g=l.handleOpenURL;l.handleOpenURL=function(a){0==a.indexOf(M("BuildInfo.packageName",l)+"://")&&f({url:a});if("function"===typeof g)try{g(a)}catch(n){console.error(n)}};b(null,f)};ai.prototype.Sa=function(a){this.ia.push(a);ei(this).f(function(){})};ai.prototype.Lb=function(a){Ka(this.ia,function(b){return b==a})};var ji=function(a){this.u=a;this.i=Th()},ki={name:"pendingRedirect",I:!1},li=function(a){return a.i.set(ki,"pending",a.u)},mi=function(a){return a.i.remove(ki,a.u)},ni=function(a){return a.i.get(ki,a.u).then(function(a){return"pending"==a})};var W=function(a,b,c){this.v=a;this.j=b;this.B=c;this.Pb=[];this.ab=!1;this.Gc=r(this.Qc,this);this.hb=new oi(this);this.Td=new pi(this);this.Db=new ji(this.j+":"+this.B);this.pb={};this.pb.unknown=this.hb;this.pb.signInViaRedirect=this.hb;this.pb.linkViaRedirect=this.hb;this.pb.signInViaPopup=this.Td;this.pb.linkViaPopup=this.Td;this.G=qi(this.v,this.j,this.B)},qi=function(a,b,c){var d=firebase.SDK_VERSION||null;return hf()?new ai(a,b,c,d):new fh(a,b,c,d)};
W.prototype.reset=function(){this.ab=!1;this.G.Lb(this.Gc);this.G=qi(this.v,this.j,this.B)};W.prototype.zb=function(){var a=this;this.ab||(this.ab=!0,this.G.Sa(this.Gc));var b=this.G;return this.G.Ga().f(function(c){a.G==b&&a.reset();throw c;})};var ti=function(a){a.G.be()&&a.zb().f(function(b){var c=new P("unknown",null,null,null,new O("operation-not-supported-in-this-environment"));ri(b)&&a.Qc(c)});a.G.Jd()||si(a.hb)};
W.prototype.subscribe=function(a){Ha(this.Pb,a)||this.Pb.push(a);if(!this.ab){var b=this;ni(this.Db).then(function(a){a?mi(b.Db).then(function(){b.zb().f(function(a){var c=new P("unknown",null,null,null,new O("operation-not-supported-in-this-environment"));ri(a)&&b.Qc(c)})}):ti(b)}).f(function(){ti(b)})}};W.prototype.unsubscribe=function(a){Ka(this.Pb,function(b){return b==a})};
W.prototype.Qc=function(a){if(!a)throw new O("invalid-auth-event");for(var b=!1,c=0;c<this.Pb.length;c++){var d=this.Pb[c];if(d.vd(a.ga,a.F)){(b=this.pb[a.ga])&&b.Ud(a,d);b=!0;break}}si(this.hb);return b};var ui=new yf(2E3,1E4),vi=new yf(3E4,6E4);W.prototype.getRedirectResult=function(){return this.hb.getRedirectResult()};W.prototype.Gb=function(a,b,c,d,e){var f=this;return this.G.Gb(a,b,c,function(){f.ab||(f.ab=!0,f.G.Sa(f.Gc))},function(){f.reset()},d,e)};
var ri=function(a){return a&&"auth/cordova-not-ready"==a.code?!0:!1};W.prototype.Hb=function(a,b,c){var d=this,e;return li(this.Db).then(function(){return d.G.Hb(a,b,c).f(function(a){if(ri(a))throw new O("operation-not-supported-in-this-environment");e=a;return mi(d.Db).then(function(){throw e;})}).then(function(){return d.G.ee()?new D(function(){}):mi(d.Db).then(function(){return d.getRedirectResult()}).then(function(){}).f(function(){})})})};
W.prototype.Nb=function(a,b,c,d){return this.G.Nb(c,function(c){a.Oa(b,null,c,d)},ui.get())};var wi={},xi=function(a,b,c){var d=b+":"+c;wi[d]||(wi[d]=new W(a,b,c));return wi[d]},oi=function(a){this.i=a;this.kb=null;this.Kb=[];this.Jb=[];this.ib=null;this.ed=!1};oi.prototype.reset=function(){this.kb=null;this.ib&&(this.ib.cancel(),this.ib=null)};
oi.prototype.Ud=function(a,b){if(!a)return F(new O("invalid-auth-event"));this.reset();this.ed=!0;var c=a.ga,d=a.F,e=a.getError()&&"auth/web-storage-unsupported"==a.getError().code,f=a.getError()&&"auth/operation-not-supported-in-this-environment"==a.getError().code;"unknown"!=c||e||f?a=a.O?this.cd(a,b):b.vb(c,d)?this.dd(a,b):F(new O("invalid-auth-event")):(yi(this,!1,null,null),a=E());return a};var si=function(a){a.ed||(a.ed=!0,yi(a,!1,null,null))};
oi.prototype.cd=function(a){yi(this,!0,null,a.getError());return E()};oi.prototype.dd=function(a,b){var c=this,d=a.ga;b=b.vb(d,a.F);var e=a.qb;a=a.ac();var f="signInViaRedirect"==d||"linkViaRedirect"==d;return b(e,a).then(function(a){yi(c,f,a,null)}).f(function(a){yi(c,f,null,a)})};
var zi=function(a,b){a.kb=function(){return F(b)};if(a.Jb.length)for(var c=0;c<a.Jb.length;c++)a.Jb[c](b)},Ai=function(a,b){a.kb=function(){return E(b)};if(a.Kb.length)for(var c=0;c<a.Kb.length;c++)a.Kb[c](b)},yi=function(a,b,c,d){b?d?zi(a,d):Ai(a,c):Ai(a,{user:null});a.Kb=[];a.Jb=[]};oi.prototype.getRedirectResult=function(){var a=this;return new D(function(b,c){a.kb?a.kb().then(b,c):(a.Kb.push(b),a.Jb.push(c),Bi(a))})};
var Bi=function(a){var b=new O("timeout");a.ib&&a.ib.cancel();a.ib=ke(vi.get()).then(function(){a.kb||yi(a,!0,null,b)})},pi=function(a){this.i=a};pi.prototype.Ud=function(a,b){if(!a)return F(new O("invalid-auth-event"));var c=a.ga,d=a.F;return a.O?this.cd(a,b):b.vb(c,d)?this.dd(a,b):F(new O("invalid-auth-event"))};pi.prototype.cd=function(a,b){b.Oa(a.ga,null,a.getError(),a.F);return E()};
pi.prototype.dd=function(a,b){var c=a.F,d=a.ga,e=b.vb(d,c),f=a.qb;a=a.ac();return e(f,a).then(function(a){b.Oa(d,a,null,c)}).f(function(a){b.Oa(d,null,a,c)})};var Ci=function(a){this.g=a;this.xa=this.W=null;this.Ca=0};Ci.prototype.C=function(){return{apiKey:this.g.j,refreshToken:this.W,accessToken:this.xa,expirationTime:this.Ca}};
var Ei=function(a,b){var c=b.idToken,d=b.refreshToken;b=Di(b.expiresIn);a.xa=c;a.Ca=b;a.W=d},Di=function(a){return ka()+1E3*parseInt(a,10)},Fi=function(a,b){return tg(a.g,b).then(function(b){a.xa=b.access_token;a.Ca=Di(b.expires_in);a.W=b.refresh_token;return{accessToken:a.xa,expirationTime:a.Ca,refreshToken:a.W}}).f(function(b){"auth/user-token-expired"==b.code&&(a.W=null);throw b;})};
Ci.prototype.getToken=function(a){a=!!a;return this.xa&&!this.W?F(new O("user-token-expired")):a||!this.xa||ka()>this.Ca-3E4?this.W?Fi(this,{grant_type:"refresh_token",refresh_token:this.W}):E(null):E({accessToken:this.xa,expirationTime:this.Ca,refreshToken:this.W})};var Gi=function(a,b,c,d,e){Df(this,{uid:a,displayName:d||null,photoURL:e||null,email:c||null,providerId:b})},Hi=function(a,b){Ib.call(this,a);for(var c in b)this[c]=b[c]};t(Hi,Ib);
var X=function(a,b,c){this.Z=[];this.j=a.apiKey;this.B=a.appName;this.v=a.authDomain||null;a=firebase.SDK_VERSION?nf(firebase.SDK_VERSION):null;this.g=new S(this.j,null,a);this.ea=new Ci(this.g);Ii(this,b.idToken);Ei(this.ea,b);N(this,"refreshToken",this.ea.W);Ji(this,c||{});ge.call(this);this.pc=!1;this.v&&qf()&&(this.m=xi(this.v,this.j,this.B));this.vc=[];this.oa=null;this.fb=Ki(this);this.rb=r(this.Rc,this)};t(X,ge);X.prototype.Rc=function(){this.fb.cb&&(this.fb.stop(),this.fb.start())};
var Ki=function(a){return new Mh(function(){return a.getToken(!0)},function(a){return a&&"auth/network-request-failed"==a.code?!0:!1},function(){var b=a.ea.Ca-ka()-3E5;return 0<b?b:0},3E4,96E4,!1)},Li=function(a){a.Ad||a.fb.cb||(a.fb.start(),cc(a,"tokenChanged",a.rb),Ub(a,"tokenChanged",a.rb))},Mi=function(a){cc(a,"tokenChanged",a.rb);a.fb.stop()},Ii=function(a,b){a.Nd=b;N(a,"_lat",b)},Ni=function(a,b){Ka(a.vc,function(a){return a==b})},Oi=function(a){for(var b=[],c=0;c<a.vc.length;c++)b.push(a.vc[c](a));
return Bd(b).then(function(){return a})},Pi=function(a){a.m&&!a.pc&&(a.pc=!0,a.m.subscribe(a))},Ji=function(a,b){Df(a,{uid:b.uid,displayName:b.displayName||null,photoURL:b.photoURL||null,email:b.email||null,emailVerified:b.emailVerified||!1,isAnonymous:b.isAnonymous||!1,providerData:[]})};N(X.prototype,"providerId","firebase");
var Qi=function(){},Ri=function(a){return E().then(function(){if(a.Ad)throw new O("app-deleted");})},Si=function(a){return Da(a.providerData,function(a){return a.providerId})},Ui=function(a,b){b&&(Ti(a,b.providerId),a.providerData.push(b))},Ti=function(a,b){Ka(a.providerData,function(a){return a.providerId==b})},Vi=function(a,b,c){("uid"!=b||c)&&a.hasOwnProperty(b)&&N(a,b,c)};
X.prototype.copy=function(a){var b=this;b!=a&&(Df(this,{uid:a.uid,displayName:a.displayName,photoURL:a.photoURL,email:a.email,emailVerified:a.emailVerified,isAnonymous:a.isAnonymous,providerData:[]}),x(a.providerData,function(a){Ui(b,a)}),this.ea=a.ea,N(this,"refreshToken",this.ea.W))};X.prototype.reload=function(){var a=this;return this.c(Ri(this).then(function(){return Wi(a).then(function(){return Oi(a)}).then(Qi)}))};
var Wi=function(a){return a.getToken().then(function(b){var c=a.isAnonymous;return Xi(a,b).then(function(){c||Vi(a,"isAnonymous",!1);return b})})};X.prototype.getToken=function(a){var b=this;return this.c(Ri(this).then(function(){return b.ea.getToken(a)}).then(function(a){if(!a)throw new O("internal-error");a.accessToken!=b.Nd&&(Ii(b,a.accessToken),b.Ia());Vi(b,"refreshToken",a.refreshToken);return a.accessToken}))};
var Yi=function(a,b){b.idToken&&a.Nd!=b.idToken&&(Ei(a.ea,b),a.Ia(),Ii(a,b.idToken),Vi(a,"refreshToken",a.ea.W))};X.prototype.Ia=function(){this.dispatchEvent(new Hi("tokenChanged"))};var Xi=function(a,b){return R(a.g,Tg,{idToken:b}).then(r(a.cf,a))};
X.prototype.cf=function(a){a=a.users;if(!a||!a.length)throw new O("internal-error");a=a[0];Ji(this,{uid:a.localId,displayName:a.displayName,photoURL:a.photoUrl,email:a.email,emailVerified:!!a.emailVerified});for(var b=Zi(a),c=0;c<b.length;c++)Ui(this,b[c]);Vi(this,"isAnonymous",!(this.email&&a.passwordHash)&&!(this.providerData&&this.providerData.length))};
var Zi=function(a){return(a=a.providerUserInfo)&&a.length?Da(a,function(a){return new Gi(a.rawId,a.providerId,a.email,a.displayName,a.photoUrl)}):[]};
X.prototype.reauthenticate=function(a){var b=this;return this.c(a.$b(this.g).then(function(a){var c;a:{var e=a.idToken.split(".");if(3==e.length){for(var e=e[1],f=(4-e.length%4)%4,g=0;g<f;g++)e+=".";try{var k=JSON.parse(sb(e));if(k.sub&&k.iss&&k.aud&&k.exp){c=new Pf(k);break a}}catch(n){}}c=null}if(!c||b.uid!=c.Ue)throw new O("user-mismatch");Yi(b,a);b.oa=null;return b.reload()}),!0)};
var $i=function(a,b){return Wi(a).then(function(){if(Ha(Si(a),b))return Oi(a).then(function(){throw new O("provider-already-linked");})})};h=X.prototype;h.link=function(a){var b=this;return this.c($i(this,a.provider).then(function(){return b.getToken()}).then(function(c){return a.Pd(b.g,c)}).then(r(this.Dd,this)))};h.Dd=function(a){Yi(this,a);var b=this;return this.reload().then(function(){return b})};
h.updateEmail=function(a){var b=this;return this.c(this.getToken().then(function(c){return b.g.updateEmail(c,a)}).then(function(a){Yi(b,a);return b.reload()}))};h.updatePassword=function(a){var b=this;return this.c(this.getToken().then(function(c){return b.g.updatePassword(c,a)}).then(function(a){Yi(b,a);return b.reload()}))};
h.updateProfile=function(a){if(void 0===a.displayName&&void 0===a.photoURL)return Ri(this);var b=this;return this.c(this.getToken().then(function(c){return b.g.updateProfile(c,{displayName:a.displayName,photoUrl:a.photoURL})}).then(function(a){Yi(b,a);Vi(b,"displayName",a.displayName||null);Vi(b,"photoURL",a.photoUrl||null);return Oi(b)}).then(Qi))};
h.unlink=function(a){var b=this;return this.c(Wi(this).then(function(c){return Ha(Si(b),a)?Ig(b.g,c,[a]).then(function(a){var c={};x(a.providerUserInfo||[],function(a){c[a.providerId]=!0});x(Si(b),function(a){c[a]||Ti(b,a)});return Oi(b)}):Oi(b).then(function(){throw new O("no-such-provider");})}))};
h["delete"]=function(){var a=this;return this.c(this.getToken().then(function(b){return R(a.g,Sg,{idToken:b})}).then(function(){a.dispatchEvent(new Hi("userDeleted"))})).then(function(){for(var b=0;b<a.Z.length;b++)a.Z[b].cancel("app-deleted");a.Z=[];a.Ad=!0;Mi(a);N(a,"refreshToken",null);a.m&&a.m.unsubscribe(a)})};h.vd=function(a,b){return"linkViaPopup"==a&&(this.la||null)==b&&this.ca||"linkViaRedirect"==a&&(this.sc||null)==b?!0:!1};
h.Oa=function(a,b,c,d){"linkViaPopup"==a&&d==(this.la||null)&&(c&&this.Ka?this.Ka(c):b&&!c&&this.ca&&this.ca(b),this.J&&(this.J.cancel(),this.J=null),delete this.ca,delete this.Ka)};h.vb=function(a,b){return"linkViaPopup"==a&&b==(this.la||null)||"linkViaRedirect"==a&&(this.sc||null)==b?r(this.ye,this):null};h.Zb=function(){return pf(this.uid+":::")};
h.linkWithPopup=function(a){if(!qf())return F(new O("operation-not-supported-in-this-environment"));if(this.oa)return F(this.oa);var b=this,c=Kf(a.providerId),d=this.Zb(),e=null;(!rf()||lf())&&this.v&&a.isOAuthProvider&&(e=kh(this.v,this.j,this.B,"linkViaPopup",a,null,d,firebase.SDK_VERSION||null));var f=df(e,c&&c.Fb,c&&c.Eb),c=$i(this,a.providerId).then(function(){return Oi(b)}).then(function(){aj(b);return b.getToken()}).then(function(){return b.m.Gb(f,"linkViaPopup",a,d,!!e)}).then(function(){return new D(function(a,
c){b.Oa("linkViaPopup",null,new O("cancelled-popup-request"),b.la||null);b.ca=a;b.Ka=c;b.la=d;b.J=b.m.Nb(b,"linkViaPopup",f,d)})}).then(function(a){f&&cf(f);return a}).f(function(a){f&&cf(f);throw a;});return this.c(c)};
h.linkWithRedirect=function(a){if(!qf())return F(new O("operation-not-supported-in-this-environment"));if(this.oa)return F(this.oa);var b=this,c=null,d=this.Zb(),e=$i(this,a.providerId).then(function(){aj(b);return b.getToken()}).then(function(){b.sc=d;return Oi(b)}).then(function(a){b.Ma&&(a=b.Ma,a=a.i.set(bj,b.C(),a.u));return a}).then(function(){return b.m.Hb("linkViaRedirect",a,d)}).f(function(a){c=a;if(b.Ma)return cj(b.Ma);throw c;}).then(function(){if(c)throw c;});return this.c(e)};
var aj=function(a){if(!a.m||!a.pc){if(a.m&&!a.pc)throw new O("internal-error");throw new O("auth-domain-config-required");}};X.prototype.ye=function(a,b){var c=this;this.J&&(this.J.cancel(),this.J=null);var d=null,e=this.getToken().then(function(d){return Tf(c.g,{requestUri:a,sessionId:b,idToken:d})}).then(function(a){d=gg(a);return c.Dd(a)}).then(function(a){return{user:a,credential:d}});return this.c(e)};
X.prototype.sendEmailVerification=function(){var a=this;return this.c(this.getToken().then(function(b){return a.g.sendEmailVerification(b)}).then(function(b){if(a.email!=b)return a.reload()}).then(function(){}))};X.prototype.c=function(a,b){var c=this,d=dj(this,a,b);this.Z.push(d);Ed(d,function(){Ja(c.Z,d)});return d};
var dj=function(a,b,c){return a.oa&&!c?(b.cancel(),F(a.oa)):b.f(function(b){!b||"auth/user-disabled"!=b.code&&"auth/user-token-expired"!=b.code||(a.oa||a.dispatchEvent(new Hi("userInvalidated")),a.oa=b);throw b;})};X.prototype.toJSON=function(){return this.C()};
X.prototype.C=function(){var a={uid:this.uid,displayName:this.displayName,photoURL:this.photoURL,email:this.email,emailVerified:this.emailVerified,isAnonymous:this.isAnonymous,providerData:[],apiKey:this.j,appName:this.B,authDomain:this.v,stsTokenManager:this.ea.C(),redirectEventId:this.sc||null};x(this.providerData,function(b){a.providerData.push(Ef(b))});return a};
var ej=function(a){if(!a.apiKey)return null;var b={apiKey:a.apiKey,authDomain:a.authDomain,appName:a.appName},c={};if(a.stsTokenManager&&a.stsTokenManager.accessToken&&a.stsTokenManager.expirationTime)c.idToken=a.stsTokenManager.accessToken,c.refreshToken=a.stsTokenManager.refreshToken||null,c.expiresIn=(a.stsTokenManager.expirationTime-ka())/1E3;else return null;var d=new X(b,c,a);a.providerData&&x(a.providerData,function(a){if(a){var b={};Df(b,a);Ui(d,b)}});a.redirectEventId&&(d.sc=a.redirectEventId);
return d},fj=function(a,b,c){var d=new X(a,b);c&&(d.Ma=c);return d.reload().then(function(){return d})};var gj=function(a){this.u=a;this.i=Th()},bj={name:"redirectUser",I:!1},cj=function(a){return a.i.remove(bj,a.u)},hj=function(a,b){return a.i.get(bj,a.u).then(function(a){a&&b&&(a.authDomain=b);return ej(a||{})})};var ij=function(a){this.u=a;this.i=Th()},jj={name:"authUser",I:!0},kj=function(a,b){return a.i.set(jj,b.C(),a.u)},lj=function(a){return a.i.remove(jj,a.u)},mj=function(a,b){return a.i.get(jj,a.u).then(function(a){a&&b&&(a.authDomain=b);return ej(a||{})})};var rj=function(a){this.Va=!1;N(this,"app",a);if(Y(this).options&&Y(this).options.apiKey)a=firebase.SDK_VERSION?nf(firebase.SDK_VERSION):null,this.g=new S(Y(this).options&&Y(this).options.apiKey,null,a);else throw new O("invalid-api-key");this.Z=[];this.ya=[];this.$e=firebase.INTERNAL.createSubscribe(r(this.Oe,this));nj(this,null);this.pa=new ij(Y(this).options.apiKey+":"+Y(this).name);this.jb=new gj(Y(this).options.apiKey+":"+Y(this).name);this.Ub=this.c(oj(this));this.ua=this.c(pj(this));this.Wc=
!1;this.Pc=r(this.uf,this);this.he=r(this.Za,this);this.rb=r(this.Rc,this);this.fe=r(this.Je,this);this.ge=r(this.Ke,this);qj(this);this.INTERNAL={};this.INTERNAL["delete"]=r(this["delete"],this);this.Da=0};rj.prototype.toJSON=function(){return{apiKey:Y(this).options.apiKey,authDomain:Y(this).options.authDomain,appName:Y(this).name,currentUser:Z(this)&&Z(this).C()}};
var sj=function(a){return a.we||F(new O("auth-domain-config-required"))},qj=function(a){var b=Y(a).options.authDomain,c=Y(a).options.apiKey;b&&qf()&&(a.we=a.Ub.then(function(){if(!a.Va)return a.m=xi(b,c,Y(a).name),a.m.subscribe(a),Z(a)&&Pi(Z(a)),a.gd&&(Pi(a.gd),a.gd=null),a.m}))};h=rj.prototype;h.vd=function(a,b){switch(a){case "unknown":case "signInViaRedirect":return!0;case "signInViaPopup":return this.la==b&&!!this.ca;default:return!1}};
h.Oa=function(a,b,c,d){"signInViaPopup"==a&&this.la==d&&(c&&this.Ka?this.Ka(c):b&&!c&&this.ca&&this.ca(b),this.J&&(this.J.cancel(),this.J=null),delete this.ca,delete this.Ka)};h.vb=function(a,b){return"signInViaRedirect"==a||"signInViaPopup"==a&&this.la==b&&this.ca?r(this.ze,this):null};
h.ze=function(a,b){var c=this;a={requestUri:a,sessionId:b};this.J&&(this.J.cancel(),this.J=null);var d=null,e=Rf(c.g,a).then(function(a){d=gg(a);return a});a=c.Ub.then(function(){return e}).then(function(a){return tj(c,a)}).then(function(){return{user:Z(c),credential:d}});return this.c(a)};h.Zb=function(){return pf()};
h.signInWithPopup=function(a){if(!qf())return F(new O("operation-not-supported-in-this-environment"));var b=this,c=Kf(a.providerId),d=this.Zb(),e=null;(!rf()||lf())&&Y(this).options.authDomain&&a.isOAuthProvider&&(e=kh(Y(this).options.authDomain,Y(this).options.apiKey,Y(this).name,"signInViaPopup",a,null,d,firebase.SDK_VERSION||null));var f=df(e,c&&c.Fb,c&&c.Eb),c=sj(this).then(function(b){return b.Gb(f,"signInViaPopup",a,d,!!e)}).then(function(){return new D(function(a,c){b.Oa("signInViaPopup",null,
new O("cancelled-popup-request"),b.la);b.ca=a;b.Ka=c;b.la=d;b.J=b.m.Nb(b,"signInViaPopup",f,d)})}).then(function(a){f&&cf(f);return a}).f(function(a){f&&cf(f);throw a;});return this.c(c)};h.signInWithRedirect=function(a){if(!qf())return F(new O("operation-not-supported-in-this-environment"));var b=this,c=sj(this).then(function(){return b.m.Hb("signInViaRedirect",a)});return this.c(c)};
h.getRedirectResult=function(){if(!qf())return F(new O("operation-not-supported-in-this-environment"));var a=this,b=sj(this).then(function(){return a.m.getRedirectResult()});return this.c(b)};
var tj=function(a,b){var c={};c.apiKey=Y(a).options.apiKey;c.authDomain=Y(a).options.authDomain;c.appName=Y(a).name;return a.Ub.then(function(){return fj(c,b,a.jb)}).then(function(b){if(Z(a)&&b.uid==Z(a).uid)return Z(a).copy(b),a.Za(b);nj(a,b);Pi(b);return a.Za(b)}).then(function(){a.Ia()})},nj=function(a,b){Z(a)&&(Ni(Z(a),a.he),cc(Z(a),"tokenChanged",a.rb),cc(Z(a),"userDeleted",a.fe),cc(Z(a),"userInvalidated",a.ge),Mi(Z(a)));b&&(b.vc.push(a.he),Ub(b,"tokenChanged",a.rb),Ub(b,"userDeleted",a.fe),
Ub(b,"userInvalidated",a.ge),0<a.Da&&Li(b));N(a,"currentUser",b)};rj.prototype.signOut=function(){var a=this,b=this.ua.then(function(){if(!Z(a))return E();nj(a,null);return lj(a.pa).then(function(){a.Ia()})});return this.c(b)};
var uj=function(a){var b=hj(a.jb,Y(a).options.authDomain).then(function(b){if(a.gd=b)b.Ma=a.jb;return cj(a.jb)});return a.c(b)},oj=function(a){var b=Y(a).options.authDomain,c=uj(a).then(function(){return mj(a.pa,b)}).then(function(b){return b?(b.Ma=a.jb,b.reload().then(function(){return kj(a.pa,b).then(function(){return b})}).f(function(c){return"auth/network-request-failed"==c.code?b:lj(a.pa)})):null}).then(function(b){nj(a,b||null)});return a.c(c)},pj=function(a){return a.Ub.then(function(){return a.getRedirectResult()}).f(function(){}).then(function(){if(!a.Va)return a.Pc()}).f(function(){}).then(function(){if(!a.Va){a.Wc=
!0;var b=a.pa;b.i.addListener(jj,b.u,a.Pc)}})};h=rj.prototype;h.uf=function(){var a=this;return mj(this.pa,Y(this).options.authDomain).then(function(b){if(!a.Va){var c;if(c=Z(a)&&b){c=Z(a).uid;var d=b.uid;c=void 0===c||null===c||""===c||void 0===d||null===d||""===d?!1:c==d}if(c)return Z(a).copy(b),Z(a).getToken();if(Z(a)||b)nj(a,b),b&&(Pi(b),b.Ma=a.jb),a.m&&a.m.subscribe(a),a.Ia()}})};h.Za=function(a){return kj(this.pa,a)};h.Rc=function(){this.Ia();this.Za(Z(this))};h.Je=function(){this.signOut()};
h.Ke=function(){this.signOut()};var vj=function(a,b){return a.c(b.then(function(b){return tj(a,b)}).then(function(){return Z(a)}))};h=rj.prototype;h.Oe=function(a){var b=this;this.addAuthTokenListener(function(){a.next(Z(b))})};h.onAuthStateChanged=function(a,b,c){var d=this;this.Wc&&firebase.Promise.resolve().then(function(){q(a)?a(Z(d)):q(a.next)&&a.next(Z(d))});return this.$e(a,b,c)};
h.getToken=function(a){var b=this,c=this.ua.then(function(){return Z(b)?Z(b).getToken(a).then(function(a){return{accessToken:a}}):null});return this.c(c)};h.signInWithCustomToken=function(a){var b=this;return this.ua.then(function(){return vj(b,R(b.g,Ug,{token:a}))}).then(function(a){Vi(a,"isAnonymous",!1);return b.Za(a)}).then(function(){return Z(b)})};h.signInWithEmailAndPassword=function(a,b){var c=this;return this.ua.then(function(){return vj(c,R(c.g,dg,{email:a,password:b}))})};
h.createUserWithEmailAndPassword=function(a,b){var c=this;return this.ua.then(function(){return vj(c,R(c.g,Rg,{email:a,password:b}))})};h.signInWithCredential=function(a){var b=this;return this.ua.then(function(){return vj(b,a.$b(b.g))})};h.signInAnonymously=function(){var a=Z(this),b=this;return a&&a.isAnonymous?E(a):this.ua.then(function(){return vj(b,b.g.signInAnonymously())}).then(function(a){Vi(a,"isAnonymous",!0);return b.Za(a)}).then(function(){return Z(b)})};
var Y=function(a){return a.app},Z=function(a){return a.currentUser};h=rj.prototype;h.getUid=function(){return Z(this)&&Z(this).uid||null};h.Ia=function(){if(this.Wc)for(var a=0;a<this.ya.length;a++)if(this.ya[a])this.ya[a](Z(this)&&Z(this)._lat||null)};h.qe=function(a){this.addAuthTokenListener(a);this.Da++;0<this.Da&&Z(this)&&Li(Z(this))};h.gf=function(a){var b=this;x(this.ya,function(c){c==a&&b.Da--});0>this.Da&&(this.Da=0);0==this.Da&&Z(this)&&Mi(Z(this));this.removeAuthTokenListener(a)};
h.addAuthTokenListener=function(a){var b=this;this.ya.push(a);this.c(this.ua.then(function(){b.Va||Ha(b.ya,a)&&a(Z(b)&&Z(b)._lat||null)}))};h.removeAuthTokenListener=function(a){Ka(this.ya,function(b){return b==a})};h["delete"]=function(){this.Va=!0;for(var a=0;a<this.Z.length;a++)this.Z[a].cancel("app-deleted");this.Z=[];this.pa&&(a=this.pa,a.i.removeListener(jj,a.u,this.Pc));this.m&&this.m.unsubscribe(this);return firebase.Promise.resolve()};
h.c=function(a){var b=this;this.Z.push(a);Ed(a,function(){Ja(b.Z,a)});return a};h.fetchProvidersForEmail=function(a){return this.c(yg(this.g,a))};h.verifyPasswordResetCode=function(a){return this.checkActionCode(a).then(function(a){return a.data.email})};h.confirmPasswordReset=function(a,b){return this.c(this.g.confirmPasswordReset(a,b).then(function(){}))};h.checkActionCode=function(a){return this.c(this.g.checkActionCode(a).then(function(a){return new Eh(a)}))};h.applyActionCode=function(a){return this.c(this.g.applyActionCode(a).then(function(){}))};
h.sendPasswordResetEmail=function(a){return this.c(this.g.sendPasswordResetEmail(a).then(function(){}))};U(rj.prototype,{applyActionCode:{name:"applyActionCode",a:[T("code")]},checkActionCode:{name:"checkActionCode",a:[T("code")]},confirmPasswordReset:{name:"confirmPasswordReset",a:[T("code"),T("newPassword")]},createUserWithEmailAndPassword:{name:"createUserWithEmailAndPassword",a:[T("email"),T("password")]},fetchProvidersForEmail:{name:"fetchProvidersForEmail",a:[T("email")]},getRedirectResult:{name:"getRedirectResult",a:[]},onAuthStateChanged:{name:"onAuthStateChanged",a:[Lh(Gh(),Hh(),"nextOrObserver"),
Hh("opt_error",!0),Hh("opt_completed",!0)]},sendPasswordResetEmail:{name:"sendPasswordResetEmail",a:[T("email")]},signInAnonymously:{name:"signInAnonymously",a:[]},signInWithCredential:{name:"signInWithCredential",a:[Jh()]},signInWithCustomToken:{name:"signInWithCustomToken",a:[T("token")]},signInWithEmailAndPassword:{name:"signInWithEmailAndPassword",a:[T("email"),T("password")]},signInWithPopup:{name:"signInWithPopup",a:[Kh()]},signInWithRedirect:{name:"signInWithRedirect",a:[Kh()]},signOut:{name:"signOut",
a:[]},toJSON:{name:"toJSON",a:[T(null,!0)]},verifyPasswordResetCode:{name:"verifyPasswordResetCode",a:[T("code")]}});
U(X.prototype,{"delete":{name:"delete",a:[]},getToken:{name:"getToken",a:[{name:"opt_forceRefresh",fa:"a boolean",optional:!0,ha:function(a){return"boolean"==typeof a}}]},link:{name:"link",a:[Jh()]},linkWithPopup:{name:"linkWithPopup",a:[Kh()]},linkWithRedirect:{name:"linkWithRedirect",a:[Kh()]},reauthenticate:{name:"reauthenticate",a:[Jh()]},reload:{name:"reload",a:[]},sendEmailVerification:{name:"sendEmailVerification",a:[]},toJSON:{name:"toJSON",a:[T(null,!0)]},unlink:{name:"unlink",a:[T("provider")]},
updateEmail:{name:"updateEmail",a:[T("email")]},updatePassword:{name:"updatePassword",a:[T("password")]},updateProfile:{name:"updateProfile",a:[Gh("profile")]}});U(D.prototype,{f:{name:"catch"},then:{name:"then"}});V(fg,"credential",function(a,b){return new cg(a,b)},[T("email"),T("password")]);U(Vf.prototype,{addScope:{name:"addScope",a:[T("scope")]},setCustomParameters:{name:"setCustomParameters",a:[Gh("customOAuthParameters")]}});V(Vf,"credential",Wf,[Lh(T(),Gh(),"token")]);
U(Xf.prototype,{addScope:{name:"addScope",a:[T("scope")]},setCustomParameters:{name:"setCustomParameters",a:[Gh("customOAuthParameters")]}});V(Xf,"credential",Yf,[Lh(T(),Gh(),"token")]);U(Zf.prototype,{addScope:{name:"addScope",a:[T("scope")]},setCustomParameters:{name:"setCustomParameters",a:[Gh("customOAuthParameters")]}});V(Zf,"credential",$f,[Lh(T(),Ih(),"idToken",!0),Lh(T(),Ih(),"accessToken",!0)]);U(ag.prototype,{setCustomParameters:{name:"setCustomParameters",a:[Gh("customOAuthParameters")]}});
V(ag,"credential",bg,[Lh(T(),Gh(),"token"),T("secret",!0)]);U(O.prototype,{toJSON:{name:"toJSON",a:[T(null,!0)]}});U(ig.prototype,{toJSON:{name:"toJSON",a:[T(null,!0)]}});U(Of.prototype,{toJSON:{name:"toJSON",a:[T(null,!0)]}});
(function(){if("undefined"!==typeof firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerService){var a={Auth:rj,Error:O};V(a,"EmailAuthProvider",fg,[]);V(a,"FacebookAuthProvider",Vf,[]);V(a,"GithubAuthProvider",Xf,[]);V(a,"GoogleAuthProvider",Zf,[]);V(a,"TwitterAuthProvider",ag,[]);firebase.INTERNAL.registerService("auth",function(a,c){a=new rj(a);c({INTERNAL:{getUid:r(a.getUid,a),getToken:r(a.getToken,a),addAuthTokenListener:r(a.qe,a),removeAuthTokenListener:r(a.gf,a)}});return a},a,function(a,
c){if("create"===a)try{c.auth()}catch(d){}});firebase.INTERNAL.extendNamespace({User:X})}else throw Error("Cannot find the firebase namespace; be sure to include firebase-app.js before this library.");})();}).call(this);
(function() {var g,aa=this;function n(a){return void 0!==a}function ba(){}function ca(a){a.Vb=function(){return a.Ye?a.Ye:a.Ye=new a}}
function da(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}function ea(a){return"array"==da(a)}function fa(a){var b=da(a);return"array"==b||"object"==b&&"number"==typeof a.length}function p(a){return"string"==typeof a}function ga(a){return"number"==typeof a}function ha(a){return"function"==da(a)}function ia(a){var b=typeof a;return"object"==b&&null!=a||"function"==b}function ja(a,b,c){return a.call.apply(a.bind,arguments)}
function ka(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function q(a,b,c){q=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ja:ka;return q.apply(null,arguments)}
function la(a,b){function c(){}c.prototype=b.prototype;a.wg=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.sg=function(a,c,f){for(var h=Array(arguments.length-2),k=2;k<arguments.length;k++)h[k-2]=arguments[k];return b.prototype[c].apply(a,h)}};function r(a,b){for(var c in a)b.call(void 0,a[c],c,a)}function ma(a,b){var c={},d;for(d in a)c[d]=b.call(void 0,a[d],d,a);return c}function na(a,b){for(var c in a)if(!b.call(void 0,a[c],c,a))return!1;return!0}function oa(a){var b=0,c;for(c in a)b++;return b}function pa(a){for(var b in a)return b}function qa(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b}function ra(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b}function sa(a,b){for(var c in a)if(a[c]==b)return!0;return!1}
function ta(a,b,c){for(var d in a)if(b.call(c,a[d],d,a))return d}function ua(a,b){var c=ta(a,b,void 0);return c&&a[c]}function va(a){for(var b in a)return!1;return!0}function wa(a){var b={},c;for(c in a)b[c]=a[c];return b};var t=Array.prototype,xa=t.indexOf?function(a,b,c){return t.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(p(a))return p(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},ya=t.forEach?function(a,b,c){t.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=p(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},za=t.filter?function(a,b,c){return t.filter.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=[],f=0,h=p(a)?
a.split(""):a,k=0;k<d;k++)if(k in h){var l=h[k];b.call(c,l,k,a)&&(e[f++]=l)}return e},Aa=t.map?function(a,b,c){return t.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=p(a)?a.split(""):a,h=0;h<d;h++)h in f&&(e[h]=b.call(c,f[h],h,a));return e},Ba=t.reduce?function(a,b,c,d){for(var e=[],f=1,h=arguments.length;f<h;f++)e.push(arguments[f]);d&&(e[0]=q(b,d));return t.reduce.apply(a,e)}:function(a,b,c,d){var e=c;ya(a,function(c,h){e=b.call(d,e,c,h,a)});return e},Ca=t.every?function(a,b,
c){return t.every.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=p(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&!b.call(c,e[f],f,a))return!1;return!0};function Da(a,b){var c=Ea(a,b,void 0);return 0>c?null:p(a)?a.charAt(c):a[c]}function Ea(a,b,c){for(var d=a.length,e=p(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return f;return-1}function Fa(a,b){var c=xa(a,b);0<=c&&t.splice.call(a,c,1)}function Ga(a,b,c){return 2>=arguments.length?t.slice.call(a,b):t.slice.call(a,b,c)}
function Ha(a,b){a.sort(b||Ia)}function Ia(a,b){return a>b?1:a<b?-1:0};function Ja(){this.Wa=-1};function Ka(){this.Wa=-1;this.Wa=64;this.M=[];this.Wd=[];this.Af=[];this.zd=[];this.zd[0]=128;for(var a=1;a<this.Wa;++a)this.zd[a]=0;this.Pd=this.$b=0;this.reset()}la(Ka,Ja);Ka.prototype.reset=function(){this.M[0]=1732584193;this.M[1]=4023233417;this.M[2]=2562383102;this.M[3]=271733878;this.M[4]=3285377520;this.Pd=this.$b=0};
function La(a,b,c){c||(c=0);var d=a.Af;if(p(b))for(var e=0;16>e;e++)d[e]=b.charCodeAt(c)<<24|b.charCodeAt(c+1)<<16|b.charCodeAt(c+2)<<8|b.charCodeAt(c+3),c+=4;else for(e=0;16>e;e++)d[e]=b[c]<<24|b[c+1]<<16|b[c+2]<<8|b[c+3],c+=4;for(e=16;80>e;e++){var f=d[e-3]^d[e-8]^d[e-14]^d[e-16];d[e]=(f<<1|f>>>31)&4294967295}b=a.M[0];c=a.M[1];for(var h=a.M[2],k=a.M[3],l=a.M[4],m,e=0;80>e;e++)40>e?20>e?(f=k^c&(h^k),m=1518500249):(f=c^h^k,m=1859775393):60>e?(f=c&h|k&(c|h),m=2400959708):(f=c^h^k,m=3395469782),f=(b<<
5|b>>>27)+f+l+m+d[e]&4294967295,l=k,k=h,h=(c<<30|c>>>2)&4294967295,c=b,b=f;a.M[0]=a.M[0]+b&4294967295;a.M[1]=a.M[1]+c&4294967295;a.M[2]=a.M[2]+h&4294967295;a.M[3]=a.M[3]+k&4294967295;a.M[4]=a.M[4]+l&4294967295}
Ka.prototype.update=function(a,b){if(null!=a){n(b)||(b=a.length);for(var c=b-this.Wa,d=0,e=this.Wd,f=this.$b;d<b;){if(0==f)for(;d<=c;)La(this,a,d),d+=this.Wa;if(p(a))for(;d<b;){if(e[f]=a.charCodeAt(d),++f,++d,f==this.Wa){La(this,e);f=0;break}}else for(;d<b;)if(e[f]=a[d],++f,++d,f==this.Wa){La(this,e);f=0;break}}this.$b=f;this.Pd+=b}};var v;a:{var Ma=aa.navigator;if(Ma){var Na=Ma.userAgent;if(Na){v=Na;break a}}v=""};var Oa=-1!=v.indexOf("Opera")||-1!=v.indexOf("OPR"),Pa=-1!=v.indexOf("Trident")||-1!=v.indexOf("MSIE"),Qa=-1!=v.indexOf("Gecko")&&-1==v.toLowerCase().indexOf("webkit")&&!(-1!=v.indexOf("Trident")||-1!=v.indexOf("MSIE")),Ra=-1!=v.toLowerCase().indexOf("webkit");
(function(){var a="",b;if(Oa&&aa.opera)return a=aa.opera.version,ha(a)?a():a;Qa?b=/rv\:([^\);]+)(\)|;)/:Pa?b=/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/:Ra&&(b=/WebKit\/(\S+)/);b&&(a=(a=b.exec(v))?a[1]:"");return Pa&&(b=(b=aa.document)?b.documentMode:void 0,b>parseFloat(a))?String(b):a})();var Sa=null,Ta=null,Ua=null;function Va(a,b){if(!fa(a))throw Error("encodeByteArray takes an array as a parameter");Wa();for(var c=b?Ta:Sa,d=[],e=0;e<a.length;e+=3){var f=a[e],h=e+1<a.length,k=h?a[e+1]:0,l=e+2<a.length,m=l?a[e+2]:0,u=f>>2,f=(f&3)<<4|k>>4,k=(k&15)<<2|m>>6,m=m&63;l||(m=64,h||(k=64));d.push(c[u],c[f],c[k],c[m])}return d.join("")}
function Wa(){if(!Sa){Sa={};Ta={};Ua={};for(var a=0;65>a;a++)Sa[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),Ta[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a),Ua[Ta[a]]=a,62<=a&&(Ua["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a)]=a)}};function Xa(a){a=String(a);if(/^\s*$/.test(a)?0:/^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g,"@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g,"")))try{return eval("("+a+")")}catch(b){}throw Error("Invalid JSON string: "+a);}function Ya(){this.Fd=void 0}
function Za(a,b,c){switch(typeof b){case "string":$a(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?b:"null");break;case "boolean":c.push(b);break;case "undefined":c.push("null");break;case "object":if(null==b){c.push("null");break}if(ea(b)){var d=b.length;c.push("[");for(var e="",f=0;f<d;f++)c.push(e),e=b[f],Za(a,a.Fd?a.Fd.call(b,String(f),e):e,c),e=",";c.push("]");break}c.push("{");d="";for(f in b)Object.prototype.hasOwnProperty.call(b,f)&&(e=b[f],"function"!=typeof e&&(c.push(d),$a(f,c),
c.push(":"),Za(a,a.Fd?a.Fd.call(b,f,e):e,c),d=","));c.push("}");break;case "function":break;default:throw Error("Unknown type: "+typeof b);}}var ab={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},bb=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g;
function $a(a,b){b.push('"',a.replace(bb,function(a){if(a in ab)return ab[a];var b=a.charCodeAt(0),e="\\u";16>b?e+="000":256>b?e+="00":4096>b&&(e+="0");return ab[a]=e+b.toString(16)}),'"')};var cb=firebase.Promise;function db(){var a=this;this.reject=this.resolve=null;this.ra=new cb(function(b,c){a.resolve=b;a.reject=c})}function eb(a,b){return function(c,d){c?a.reject(c):a.resolve(d);ha(b)&&(fb(a.ra),1===b.length?b(c):b(c,d))}}function fb(a){a.then(void 0,ba)};function gb(a){return"undefined"!==typeof JSON&&n(JSON.parse)?JSON.parse(a):Xa(a)}function w(a){if("undefined"!==typeof JSON&&n(JSON.stringify))a=JSON.stringify(a);else{var b=[];Za(new Ya,a,b);a=b.join("")}return a};function x(a,b,c,d){var e;d<b?e="at least "+b:d>c&&(e=0===c?"none":"no more than "+c);if(e)throw Error(a+" failed: Was called with "+d+(1===d?" argument.":" arguments.")+" Expects "+e+".");}function y(a,b,c){var d="";switch(b){case 1:d=c?"first":"First";break;case 2:d=c?"second":"Second";break;case 3:d=c?"third":"Third";break;case 4:d=c?"fourth":"Fourth";break;default:throw Error("errorPrefix called with argumentNumber > 4.  Need to update it?");}return a=a+" failed: "+(d+" argument ")}
function A(a,b,c,d){if((!d||n(c))&&!ha(c))throw Error(y(a,b,d)+"must be a valid function.");}function hb(a,b,c){if(n(c)&&(!ia(c)||null===c))throw Error(y(a,b,!0)+"must be a valid context object.");};function ib(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function B(a,b){if(Object.prototype.hasOwnProperty.call(a,b))return a[b]}function jb(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b(c,a[c])};function kb(a){var b=[];jb(a,function(a,d){ea(d)?ya(d,function(d){b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))}):b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))});return b.length?"&"+b.join("&"):""};function lb(a,b){if(!a)throw mb(b);}function mb(a){return Error("Firebase Database ("+firebase.SDK_VERSION+") INTERNAL ASSERT FAILED: "+a)};function nb(a){for(var b=[],c=0,d=0;d<a.length;d++){var e=a.charCodeAt(d);55296<=e&&56319>=e&&(e-=55296,d++,lb(d<a.length,"Surrogate pair missing trail surrogate."),e=65536+(e<<10)+(a.charCodeAt(d)-56320));128>e?b[c++]=e:(2048>e?b[c++]=e>>6|192:(65536>e?b[c++]=e>>12|224:(b[c++]=e>>18|240,b[c++]=e>>12&63|128),b[c++]=e>>6&63|128),b[c++]=e&63|128)}return b}function ob(a){for(var b=0,c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b++:2048>d?b+=2:55296<=d&&56319>=d?(b+=4,c++):b+=3}return b};function pb(a){this.te=a;this.Bd=[];this.Qb=0;this.Yd=-1;this.Fb=null}function qb(a,b,c){a.Yd=b;a.Fb=c;a.Yd<a.Qb&&(a.Fb(),a.Fb=null)}function rb(a,b,c){for(a.Bd[b]=c;a.Bd[a.Qb];){var d=a.Bd[a.Qb];delete a.Bd[a.Qb];for(var e=0;e<d.length;++e)if(d[e]){var f=a;sb(function(){f.te(d[e])})}if(a.Qb===a.Yd){a.Fb&&(clearTimeout(a.Fb),a.Fb(),a.Fb=null);break}a.Qb++}};function tb(){return"undefined"!==typeof window&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test("undefined"!==typeof navigator&&"string"===typeof navigator.userAgent?navigator.userAgent:"")};function ub(a,b){this.committed=a;this.snapshot=b};function vb(a,b,c){this.type=wb;this.source=a;this.path=b;this.Ga=c}vb.prototype.Mc=function(a){return this.path.e()?new vb(this.source,C,this.Ga.Q(a)):new vb(this.source,D(this.path),this.Ga)};vb.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" overwrite: "+this.Ga.toString()+")"};function xb(a,b){this.type=yb;this.source=a;this.path=b}xb.prototype.Mc=function(){return this.path.e()?new xb(this.source,C):new xb(this.source,D(this.path))};xb.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" listen_complete)"};function zb(){this.tc={}}function Ab(a,b,c){n(c)||(c=1);ib(a.tc,b)||(a.tc[b]=0);a.tc[b]+=c}zb.prototype.get=function(){return wa(this.tc)};function Bb(a){this.Ef=a;this.rd=null}Bb.prototype.get=function(){var a=this.Ef.get(),b=wa(a);if(this.rd)for(var c in this.rd)b[c]-=this.rd[c];this.rd=a;return b};function Cb(a){this.uc=a;this.Cd="firebase:"}g=Cb.prototype;g.set=function(a,b){null==b?this.uc.removeItem(this.Cd+a):this.uc.setItem(this.Cd+a,w(b))};g.get=function(a){a=this.uc.getItem(this.Cd+a);return null==a?null:gb(a)};g.remove=function(a){this.uc.removeItem(this.Cd+a)};g.Ze=!1;g.toString=function(){return this.uc.toString()};function Db(){this.pc={}}Db.prototype.set=function(a,b){null==b?delete this.pc[a]:this.pc[a]=b};Db.prototype.get=function(a){return ib(this.pc,a)?this.pc[a]:null};Db.prototype.remove=function(a){delete this.pc[a]};Db.prototype.Ze=!0;function Eb(a){try{if("undefined"!==typeof window&&"undefined"!==typeof window[a]){var b=window[a];b.setItem("firebase:sentinel","cache");b.removeItem("firebase:sentinel");return new Cb(b)}}catch(c){}return new Db}var Fb=Eb("localStorage"),Gb=Eb("sessionStorage");function Hb(a,b,c,d,e){this.host=a.toLowerCase();this.domain=this.host.substr(this.host.indexOf(".")+1);this.Sc=b;this.pe=c;this.qg=d;this.gf=e||"";this.$a=Fb.get("host:"+a)||this.host}function Ib(a,b){b!==a.$a&&(a.$a=b,"s-"===a.$a.substr(0,2)&&Fb.set("host:"+a.host,a.$a))}
function Jb(a,b,c){E("string"===typeof b,"typeof type must == string");E("object"===typeof c,"typeof params must == object");if("websocket"===b)b=(a.Sc?"wss://":"ws://")+a.$a+"/.ws?";else if("long_polling"===b)b=(a.Sc?"https://":"http://")+a.$a+"/.lp?";else throw Error("Unknown connection type: "+b);a.host!==a.$a&&(c.ns=a.pe);var d=[];r(c,function(a,b){d.push(b+"="+a)});return b+d.join("&")}
Hb.prototype.toString=function(){var a=(this.Sc?"https://":"http://")+this.host;this.gf&&(a+="<"+this.gf+">");return a};function Kb(a){this.oc=a}Kb.prototype.getToken=function(a){return this.oc.INTERNAL.getToken(a).then(null,function(a){return a&&"auth/token-not-initialized"===a.code?(G("Got auth/token-not-initialized error.  Treating as null token."),null):Promise.reject(a)})};function Lb(a,b){a.oc.INTERNAL.addAuthTokenListener(b)};function Mb(a,b,c){this.A=a;this.da=b;this.Sb=c}function Nb(a){return a.da}function Ob(a){return a.Sb}function Pb(a,b){return b.e()?a.da&&!a.Sb:Qb(a,H(b))}function Qb(a,b){return a.da&&!a.Sb||a.A.Da(b)}Mb.prototype.j=function(){return this.A};function Rb(a,b,c,d){this.ae=b;this.Md=c;this.Dd=d;this.hd=a}Rb.prototype.Yb=function(){var a=this.Md.wb();return"value"===this.hd?a.path:a.getParent().path};Rb.prototype.ge=function(){return this.hd};Rb.prototype.Tb=function(){return this.ae.Tb(this)};Rb.prototype.toString=function(){return this.Yb().toString()+":"+this.hd+":"+w(this.Md.be())};function Sb(a,b,c){this.ae=a;this.error=b;this.path=c}Sb.prototype.Yb=function(){return this.path};Sb.prototype.ge=function(){return"cancel"};
Sb.prototype.Tb=function(){return this.ae.Tb(this)};Sb.prototype.toString=function(){return this.path.toString()+":cancel"};function Tb(){this.vb=[]}function Ub(a,b){for(var c=null,d=0;d<b.length;d++){var e=b[d],f=e.Yb();null===c||f.Z(c.Yb())||(a.vb.push(c),c=null);null===c&&(c=new Vb(f));c.add(e)}c&&a.vb.push(c)}function Wb(a,b,c){Ub(a,c);Xb(a,function(a){return a.Z(b)})}function Yb(a,b,c){Ub(a,c);Xb(a,function(a){return a.contains(b)||b.contains(a)})}
function Xb(a,b){for(var c=!0,d=0;d<a.vb.length;d++){var e=a.vb[d];if(e)if(e=e.Yb(),b(e)){for(var e=a.vb[d],f=0;f<e.jd.length;f++){var h=e.jd[f];if(null!==h){e.jd[f]=null;var k=h.Tb();Zb&&G("event: "+h.toString());sb(k)}}a.vb[d]=null}else c=!1}c&&(a.vb=[])}function Vb(a){this.qa=a;this.jd=[]}Vb.prototype.add=function(a){this.jd.push(a)};Vb.prototype.Yb=function(){return this.qa};function I(a,b,c,d){this.type=a;this.Ja=b;this.Xa=c;this.qe=d;this.Dd=void 0}function $b(a){return new I(ac,a)}var ac="value";function bc(){}bc.prototype.Te=function(){return null};bc.prototype.fe=function(){return null};var cc=new bc;function dc(a,b,c){this.xf=a;this.Ka=b;this.yd=c}dc.prototype.Te=function(a){var b=this.Ka.N;if(Qb(b,a))return b.j().Q(a);b=null!=this.yd?new Mb(this.yd,!0,!1):this.Ka.w();return this.xf.qc(a,b)};dc.prototype.fe=function(a,b,c){var d=null!=this.yd?this.yd:ec(this.Ka);a=this.xf.Xd(d,b,1,c,a);return 0===a.length?null:a[0]};function fc(){this.Jd=J}fc.prototype.j=function(a){return this.Jd.P(a)};fc.prototype.toString=function(){return this.Jd.toString()};function gc(a,b){this.La=a;this.ba=b?b:hc}g=gc.prototype;g.Oa=function(a,b){return new gc(this.La,this.ba.Oa(a,b,this.La).X(null,null,!1,null,null))};g.remove=function(a){return new gc(this.La,this.ba.remove(a,this.La).X(null,null,!1,null,null))};g.get=function(a){for(var b,c=this.ba;!c.e();){b=this.La(a,c.key);if(0===b)return c.value;0>b?c=c.left:0<b&&(c=c.right)}return null};
function ic(a,b){for(var c,d=a.ba,e=null;!d.e();){c=a.La(b,d.key);if(0===c){if(d.left.e())return e?e.key:null;for(d=d.left;!d.right.e();)d=d.right;return d.key}0>c?d=d.left:0<c&&(e=d,d=d.right)}throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?");}g.e=function(){return this.ba.e()};g.count=function(){return this.ba.count()};g.Gc=function(){return this.ba.Gc()};g.ec=function(){return this.ba.ec()};g.ha=function(a){return this.ba.ha(a)};
g.Wb=function(a){return new jc(this.ba,null,this.La,!1,a)};g.Xb=function(a,b){return new jc(this.ba,a,this.La,!1,b)};g.Zb=function(a,b){return new jc(this.ba,a,this.La,!0,b)};g.We=function(a){return new jc(this.ba,null,this.La,!0,a)};function jc(a,b,c,d,e){this.Hd=e||null;this.le=d;this.Pa=[];for(e=1;!a.e();)if(e=b?c(a.key,b):1,d&&(e*=-1),0>e)a=this.le?a.left:a.right;else if(0===e){this.Pa.push(a);break}else this.Pa.push(a),a=this.le?a.right:a.left}
function K(a){if(0===a.Pa.length)return null;var b=a.Pa.pop(),c;c=a.Hd?a.Hd(b.key,b.value):{key:b.key,value:b.value};if(a.le)for(b=b.left;!b.e();)a.Pa.push(b),b=b.right;else for(b=b.right;!b.e();)a.Pa.push(b),b=b.left;return c}function kc(a){if(0===a.Pa.length)return null;var b;b=a.Pa;b=b[b.length-1];return a.Hd?a.Hd(b.key,b.value):{key:b.key,value:b.value}}function lc(a,b,c,d,e){this.key=a;this.value=b;this.color=null!=c?c:!0;this.left=null!=d?d:hc;this.right=null!=e?e:hc}g=lc.prototype;
g.X=function(a,b,c,d,e){return new lc(null!=a?a:this.key,null!=b?b:this.value,null!=c?c:this.color,null!=d?d:this.left,null!=e?e:this.right)};g.count=function(){return this.left.count()+1+this.right.count()};g.e=function(){return!1};g.ha=function(a){return this.left.ha(a)||a(this.key,this.value)||this.right.ha(a)};function mc(a){return a.left.e()?a:mc(a.left)}g.Gc=function(){return mc(this).key};g.ec=function(){return this.right.e()?this.key:this.right.ec()};
g.Oa=function(a,b,c){var d,e;e=this;d=c(a,e.key);e=0>d?e.X(null,null,null,e.left.Oa(a,b,c),null):0===d?e.X(null,b,null,null,null):e.X(null,null,null,null,e.right.Oa(a,b,c));return nc(e)};function oc(a){if(a.left.e())return hc;a.left.ea()||a.left.left.ea()||(a=pc(a));a=a.X(null,null,null,oc(a.left),null);return nc(a)}
g.remove=function(a,b){var c,d;c=this;if(0>b(a,c.key))c.left.e()||c.left.ea()||c.left.left.ea()||(c=pc(c)),c=c.X(null,null,null,c.left.remove(a,b),null);else{c.left.ea()&&(c=qc(c));c.right.e()||c.right.ea()||c.right.left.ea()||(c=rc(c),c.left.left.ea()&&(c=qc(c),c=rc(c)));if(0===b(a,c.key)){if(c.right.e())return hc;d=mc(c.right);c=c.X(d.key,d.value,null,null,oc(c.right))}c=c.X(null,null,null,null,c.right.remove(a,b))}return nc(c)};g.ea=function(){return this.color};
function nc(a){a.right.ea()&&!a.left.ea()&&(a=sc(a));a.left.ea()&&a.left.left.ea()&&(a=qc(a));a.left.ea()&&a.right.ea()&&(a=rc(a));return a}function pc(a){a=rc(a);a.right.left.ea()&&(a=a.X(null,null,null,null,qc(a.right)),a=sc(a),a=rc(a));return a}function sc(a){return a.right.X(null,null,a.color,a.X(null,null,!0,null,a.right.left),null)}function qc(a){return a.left.X(null,null,a.color,null,a.X(null,null,!0,a.left.right,null))}
function rc(a){return a.X(null,null,!a.color,a.left.X(null,null,!a.left.color,null,null),a.right.X(null,null,!a.right.color,null,null))}function tc(){}g=tc.prototype;g.X=function(){return this};g.Oa=function(a,b){return new lc(a,b,null)};g.remove=function(){return this};g.count=function(){return 0};g.e=function(){return!0};g.ha=function(){return!1};g.Gc=function(){return null};g.ec=function(){return null};g.ea=function(){return!1};var hc=new tc;function uc(a,b){return a&&"object"===typeof a?(E(".sv"in a,"Unexpected leaf node or priority contents"),b[a[".sv"]]):a}function vc(a,b){var c=new wc;xc(a,new L(""),function(a,e){yc(c,a,zc(e,b))});return c}function zc(a,b){var c=a.C().H(),c=uc(c,b),d;if(a.J()){var e=uc(a.Ca(),b);return e!==a.Ca()||c!==a.C().H()?new Ac(e,M(c)):a}d=a;c!==a.C().H()&&(d=d.fa(new Ac(c)));a.O(N,function(a,c){var e=zc(c,b);e!==c&&(d=d.T(a,e))});return d};var Bc=function(){var a=1;return function(){return a++}}(),E=lb,Cc=mb;
function Dc(a){try{var b;Wa();for(var c=Ua,d=[],e=0;e<a.length;){var f=c[a.charAt(e++)],h=e<a.length?c[a.charAt(e)]:0;++e;var k=e<a.length?c[a.charAt(e)]:64;++e;var l=e<a.length?c[a.charAt(e)]:64;++e;if(null==f||null==h||null==k||null==l)throw Error();d.push(f<<2|h>>4);64!=k&&(d.push(h<<4&240|k>>2),64!=l&&d.push(k<<6&192|l))}if(8192>d.length)b=String.fromCharCode.apply(null,d);else{a="";for(c=0;c<d.length;c+=8192)a+=String.fromCharCode.apply(null,Ga(d,c,c+8192));b=a}return b}catch(m){G("base64Decode failed: ",
m)}return null}function Ec(a){var b=nb(a);a=new Ka;a.update(b);var b=[],c=8*a.Pd;56>a.$b?a.update(a.zd,56-a.$b):a.update(a.zd,a.Wa-(a.$b-56));for(var d=a.Wa-1;56<=d;d--)a.Wd[d]=c&255,c/=256;La(a,a.Wd);for(d=c=0;5>d;d++)for(var e=24;0<=e;e-=8)b[c]=a.M[d]>>e&255,++c;return Va(b)}function Fc(a){for(var b="",c=0;c<arguments.length;c++)b=fa(arguments[c])?b+Fc.apply(null,arguments[c]):"object"===typeof arguments[c]?b+w(arguments[c]):b+arguments[c],b+=" ";return b}var Zb=null,Gc=!0;
function Hc(a,b){lb(!b||!0===a||!1===a,"Can't turn on custom loggers persistently.");!0===a?("undefined"!==typeof console&&("function"===typeof console.log?Zb=q(console.log,console):"object"===typeof console.log&&(Zb=function(a){console.log(a)})),b&&Gb.set("logging_enabled",!0)):ha(a)?Zb=a:(Zb=null,Gb.remove("logging_enabled"))}function G(a){!0===Gc&&(Gc=!1,null===Zb&&!0===Gb.get("logging_enabled")&&Hc(!0));if(Zb){var b=Fc.apply(null,arguments);Zb(b)}}
function Ic(a){return function(){G(a,arguments)}}function Jc(a){if("undefined"!==typeof console){var b="FIREBASE INTERNAL ERROR: "+Fc.apply(null,arguments);"undefined"!==typeof console.error?console.error(b):console.log(b)}}function Kc(a){var b=Fc.apply(null,arguments);throw Error("FIREBASE FATAL ERROR: "+b);}function O(a){if("undefined"!==typeof console){var b="FIREBASE WARNING: "+Fc.apply(null,arguments);"undefined"!==typeof console.warn?console.warn(b):console.log(b)}}
function Lc(a){var b,c,d,e,f,h=a;f=c=a=b="";d=!0;e="https";if(p(h)){var k=h.indexOf("//");0<=k&&(e=h.substring(0,k-1),h=h.substring(k+2));k=h.indexOf("/");-1===k&&(k=h.length);b=h.substring(0,k);f="";h=h.substring(k).split("/");for(k=0;k<h.length;k++)if(0<h[k].length){var l=h[k];try{l=decodeURIComponent(l.replace(/\+/g," "))}catch(m){}f+="/"+l}h=b.split(".");3===h.length?(a=h[1],c=h[0].toLowerCase()):2===h.length&&(a=h[0]);k=b.indexOf(":");0<=k&&(d="https"===e||"wss"===e)}"firebase"===a&&Kc(b+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead");
c&&"undefined"!=c||Kc("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com");d||"undefined"!==typeof window&&window.location&&window.location.protocol&&-1!==window.location.protocol.indexOf("https:")&&O("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().");return{jc:new Hb(b,d,c,"ws"===e||"wss"===e),path:new L(f)}}function Mc(a){return ga(a)&&(a!=a||a==Number.POSITIVE_INFINITY||a==Number.NEGATIVE_INFINITY)}
function Nc(a){if("complete"===document.readyState)a();else{var b=!1,c=function(){document.body?b||(b=!0,a()):setTimeout(c,Math.floor(10))};document.addEventListener?(document.addEventListener("DOMContentLoaded",c,!1),window.addEventListener("load",c,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",function(){"complete"===document.readyState&&c()}),window.attachEvent("onload",c))}}
function Oc(a,b){if(a===b)return 0;if("[MIN_NAME]"===a||"[MAX_NAME]"===b)return-1;if("[MIN_NAME]"===b||"[MAX_NAME]"===a)return 1;var c=Pc(a),d=Pc(b);return null!==c?null!==d?0==c-d?a.length-b.length:c-d:-1:null!==d?1:a<b?-1:1}function Qc(a,b){if(b&&a in b)return b[a];throw Error("Missing required key ("+a+") in object: "+w(b));}
function Rc(a){if("object"!==typeof a||null===a)return w(a);var b=[],c;for(c in a)b.push(c);b.sort();c="{";for(var d=0;d<b.length;d++)0!==d&&(c+=","),c+=w(b[d]),c+=":",c+=Rc(a[b[d]]);return c+"}"}function Sc(a,b){if(a.length<=b)return[a];for(var c=[],d=0;d<a.length;d+=b)d+b>a?c.push(a.substring(d,a.length)):c.push(a.substring(d,d+b));return c}function Tc(a,b){if(ea(a))for(var c=0;c<a.length;++c)b(c,a[c]);else r(a,b)}
function Uc(a){E(!Mc(a),"Invalid JSON number");var b,c,d,e;0===a?(d=c=0,b=-Infinity===1/a?1:0):(b=0>a,a=Math.abs(a),a>=Math.pow(2,-1022)?(d=Math.min(Math.floor(Math.log(a)/Math.LN2),1023),c=d+1023,d=Math.round(a*Math.pow(2,52-d)-Math.pow(2,52))):(c=0,d=Math.round(a/Math.pow(2,-1074))));e=[];for(a=52;a;--a)e.push(d%2?1:0),d=Math.floor(d/2);for(a=11;a;--a)e.push(c%2?1:0),c=Math.floor(c/2);e.push(b?1:0);e.reverse();b=e.join("");c="";for(a=0;64>a;a+=8)d=parseInt(b.substr(a,8),2).toString(16),1===d.length&&
(d="0"+d),c+=d;return c.toLowerCase()}var Vc=/^-?\d{1,10}$/;function Pc(a){return Vc.test(a)&&(a=Number(a),-2147483648<=a&&2147483647>=a)?a:null}function sb(a){try{a()}catch(b){setTimeout(function(){O("Exception was thrown by user callback.",b.stack||"");throw b;},Math.floor(0))}}function Wc(a,b,c){Object.defineProperty(a,b,{get:c})}function Xc(a,b){var c=setTimeout(a,b);"object"===typeof c&&c.unref&&c.unref();return c};function Yc(a){var b={},c={},d={},e="";try{var f=a.split("."),b=gb(Dc(f[0])||""),c=gb(Dc(f[1])||""),e=f[2],d=c.d||{};delete c.d}catch(h){}return{tg:b,Je:c,data:d,mg:e}}function Zc(a){a=Yc(a);var b=a.Je;return!!a.mg&&!!b&&"object"===typeof b&&b.hasOwnProperty("iat")}function $c(a){a=Yc(a).Je;return"object"===typeof a&&!0===B(a,"admin")};function ad(a,b,c){this.type=bd;this.source=a;this.path=b;this.children=c}ad.prototype.Mc=function(a){if(this.path.e())return a=this.children.subtree(new L(a)),a.e()?null:a.value?new vb(this.source,C,a.value):new ad(this.source,C,a);E(H(this.path)===a,"Can't get a merge for a child not on the path of the operation");return new ad(this.source,D(this.path),this.children)};ad.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" merge: "+this.children.toString()+")"};function cd(a,b,c){this.f=Ic("p:rest:");this.L=a;this.Gb=b;this.$c=c;this.$={}}function dd(a,b){if(n(b))return"tag$"+b;E(ed(a.m),"should have a tag if it's not a default query.");return a.path.toString()}g=cd.prototype;
g.$e=function(a,b,c,d){var e=a.path.toString();this.f("Listen called for "+e+" "+a.ja());var f=dd(a,c),h={};this.$[f]=h;a=fd(a.m);var k=this;gd(this,e+".json",a,function(a,b){var u=b;404===a&&(a=u=null);null===a&&k.Gb(e,u,!1,c);B(k.$,f)===h&&d(a?401==a?"permission_denied":"rest_error:"+a:"ok",null)})};g.uf=function(a,b){var c=dd(a,b);delete this.$[c]};g.kf=function(){};g.re=function(){};g.cf=function(){};g.xd=function(){};g.put=function(){};g.af=function(){};g.ye=function(){};
function gd(a,b,c,d){c=c||{};c.format="export";a.$c.getToken(!1).then(function(e){(e=e&&e.accessToken)&&(c.auth=e);var f=(a.L.Sc?"https://":"http://")+a.L.host+b+"?"+kb(c);a.f("Sending REST request for "+f);var h=new XMLHttpRequest;h.onreadystatechange=function(){if(d&&4===h.readyState){a.f("REST Response for "+f+" received. status:",h.status,"response:",h.responseText);var b=null;if(200<=h.status&&300>h.status){try{b=gb(h.responseText)}catch(c){O("Failed to parse JSON response for "+f+": "+h.responseText)}d(null,
b)}else 401!==h.status&&404!==h.status&&O("Got unsuccessful REST response for "+f+" Status: "+h.status),d(h.status);d=null}};h.open("GET",f,!0);h.send()})};function hd(a,b){this.rf={};this.Vc=new Bb(a);this.va=b;var c=1E4+2E4*Math.random();Xc(q(this.lf,this),Math.floor(c))}hd.prototype.lf=function(){var a=this.Vc.get(),b={},c=!1,d;for(d in a)0<a[d]&&ib(this.rf,d)&&(b[d]=a[d],c=!0);c&&this.va.ye(b);Xc(q(this.lf,this),Math.floor(6E5*Math.random()))};var id={},jd={};function kd(a){a=a.toString();id[a]||(id[a]=new zb);return id[a]}function ld(a,b){var c=a.toString();jd[c]||(jd[c]=b());return jd[c]};function md(a,b){this.Sd=a;this.Df=b}function nd(a){this.U=a}
nd.prototype.eb=function(a,b,c,d){var e=new od,f;if(b.type===wb)b.source.ee?c=pd(this,a,b.path,b.Ga,c,d,e):(E(b.source.Se,"Unknown source."),f=b.source.Ee||Ob(a.w())&&!b.path.e(),c=qd(this,a,b.path,b.Ga,c,d,f,e));else if(b.type===bd)b.source.ee?c=rd(this,a,b.path,b.children,c,d,e):(E(b.source.Se,"Unknown source."),f=b.source.Ee||Ob(a.w()),c=sd(this,a,b.path,b.children,c,d,f,e));else if(b.type===ud)if(b.Id)if(b=b.path,null!=c.lc(b))c=a;else{f=new dc(c,a,d);d=a.N.j();if(b.e()||".priority"===H(b))Nb(a.w())?
b=c.Aa(ec(a)):(b=a.w().j(),E(b instanceof P,"serverChildren would be complete if leaf node"),b=c.rc(b)),b=this.U.ya(d,b,e);else{var h=H(b),k=c.qc(h,a.w());null==k&&Qb(a.w(),h)&&(k=d.Q(h));b=null!=k?this.U.F(d,h,k,D(b),f,e):a.N.j().Da(h)?this.U.F(d,h,J,D(b),f,e):d;b.e()&&Nb(a.w())&&(d=c.Aa(ec(a)),d.J()&&(b=this.U.ya(b,d,e)))}d=Nb(a.w())||null!=c.lc(C);c=vd(a,b,d,this.U.Na())}else c=wd(this,a,b.path,b.Ob,c,d,e);else if(b.type===yb)d=b.path,b=a.w(),f=b.j(),h=b.da||d.e(),c=xd(this,new yd(a.N,new Mb(f,
h,b.Sb)),d,c,cc,e);else throw Cc("Unknown operation type: "+b.type);e=qa(e.fb);d=c;b=d.N;b.da&&(f=b.j().J()||b.j().e(),h=zd(a),(0<e.length||!a.N.da||f&&!b.j().Z(h)||!b.j().C().Z(h.C()))&&e.push($b(zd(d))));return new md(c,e)};
function xd(a,b,c,d,e,f){var h=b.N;if(null!=d.lc(c))return b;var k;if(c.e())E(Nb(b.w()),"If change path is empty, we must have complete server data"),Ob(b.w())?(e=ec(b),d=d.rc(e instanceof P?e:J)):d=d.Aa(ec(b)),f=a.U.ya(b.N.j(),d,f);else{var l=H(c);if(".priority"==l)E(1==Ad(c),"Can't have a priority with additional path components"),f=h.j(),k=b.w().j(),d=d.ad(c,f,k),f=null!=d?a.U.fa(f,d):h.j();else{var m=D(c);Qb(h,l)?(k=b.w().j(),d=d.ad(c,h.j(),k),d=null!=d?h.j().Q(l).F(m,d):h.j().Q(l)):d=d.qc(l,
b.w());f=null!=d?a.U.F(h.j(),l,d,m,e,f):h.j()}}return vd(b,f,h.da||c.e(),a.U.Na())}function qd(a,b,c,d,e,f,h,k){var l=b.w();h=h?a.U:a.U.Ub();if(c.e())d=h.ya(l.j(),d,null);else if(h.Na()&&!l.Sb)d=l.j().F(c,d),d=h.ya(l.j(),d,null);else{var m=H(c);if(!Pb(l,c)&&1<Ad(c))return b;var u=D(c);d=l.j().Q(m).F(u,d);d=".priority"==m?h.fa(l.j(),d):h.F(l.j(),m,d,u,cc,null)}l=l.da||c.e();b=new yd(b.N,new Mb(d,l,h.Na()));return xd(a,b,c,e,new dc(e,b,f),k)}
function pd(a,b,c,d,e,f,h){var k=b.N;e=new dc(e,b,f);if(c.e())h=a.U.ya(b.N.j(),d,h),a=vd(b,h,!0,a.U.Na());else if(f=H(c),".priority"===f)h=a.U.fa(b.N.j(),d),a=vd(b,h,k.da,k.Sb);else{c=D(c);var l=k.j().Q(f);if(!c.e()){var m=e.Te(f);d=null!=m?".priority"===Bd(c)&&m.P(c.parent()).e()?m:m.F(c,d):J}l.Z(d)?a=b:(h=a.U.F(k.j(),f,d,c,e,h),a=vd(b,h,k.da,a.U.Na()))}return a}
function rd(a,b,c,d,e,f,h){var k=b;Cd(d,function(d,m){var u=c.n(d);Qb(b.N,H(u))&&(k=pd(a,k,u,m,e,f,h))});Cd(d,function(d,m){var u=c.n(d);Qb(b.N,H(u))||(k=pd(a,k,u,m,e,f,h))});return k}function Dd(a,b){Cd(b,function(b,d){a=a.F(b,d)});return a}
function sd(a,b,c,d,e,f,h,k){if(b.w().j().e()&&!Nb(b.w()))return b;var l=b;c=c.e()?d:Ed(Q,c,d);var m=b.w().j();c.children.ha(function(c,d){if(m.Da(c)){var F=b.w().j().Q(c),F=Dd(F,d);l=qd(a,l,new L(c),F,e,f,h,k)}});c.children.ha(function(c,d){var F=!Qb(b.w(),c)&&null==d.value;m.Da(c)||F||(F=b.w().j().Q(c),F=Dd(F,d),l=qd(a,l,new L(c),F,e,f,h,k))});return l}
function wd(a,b,c,d,e,f,h){if(null!=e.lc(c))return b;var k=Ob(b.w()),l=b.w();if(null!=d.value){if(c.e()&&l.da||Pb(l,c))return qd(a,b,c,l.j().P(c),e,f,k,h);if(c.e()){var m=Q;l.j().O(Fd,function(a,b){m=m.set(new L(a),b)});return sd(a,b,c,m,e,f,k,h)}return b}m=Q;Cd(d,function(a){var b=c.n(a);Pb(l,b)&&(m=m.set(a,l.j().P(b)))});return sd(a,b,c,m,e,f,k,h)};function od(){this.fb={}}
function Gd(a,b){var c=b.type,d=b.Xa;E("child_added"==c||"child_changed"==c||"child_removed"==c,"Only child changes supported for tracking");E(".priority"!==d,"Only non-priority child changes can be tracked.");var e=B(a.fb,d);if(e){var f=e.type;if("child_added"==c&&"child_removed"==f)a.fb[d]=new I("child_changed",b.Ja,d,e.Ja);else if("child_removed"==c&&"child_added"==f)delete a.fb[d];else if("child_removed"==c&&"child_changed"==f)a.fb[d]=new I("child_removed",e.qe,d);else if("child_changed"==c&&
"child_added"==f)a.fb[d]=new I("child_added",b.Ja,d);else if("child_changed"==c&&"child_changed"==f)a.fb[d]=new I("child_changed",b.Ja,d,e.qe);else throw Cc("Illegal combination of changes: "+b+" occurred after "+e);}else a.fb[d]=b};function Hd(a){this.g=a}g=Hd.prototype;g.F=function(a,b,c,d,e,f){E(a.yc(this.g),"A node must be indexed if only a child is updated");e=a.Q(b);if(e.P(d).Z(c.P(d))&&e.e()==c.e())return a;null!=f&&(c.e()?a.Da(b)?Gd(f,new I("child_removed",e,b)):E(a.J(),"A child remove without an old child only makes sense on a leaf node"):e.e()?Gd(f,new I("child_added",c,b)):Gd(f,new I("child_changed",c,b,e)));return a.J()&&c.e()?a:a.T(b,c).nb(this.g)};
g.ya=function(a,b,c){null!=c&&(a.J()||a.O(N,function(a,e){b.Da(a)||Gd(c,new I("child_removed",e,a))}),b.J()||b.O(N,function(b,e){if(a.Da(b)){var f=a.Q(b);f.Z(e)||Gd(c,new I("child_changed",e,b,f))}else Gd(c,new I("child_added",e,b))}));return b.nb(this.g)};g.fa=function(a,b){return a.e()?J:a.fa(b)};g.Na=function(){return!1};g.Ub=function(){return this};function Id(a){this.he=new Hd(a.g);this.g=a.g;var b;a.ka?(b=Jd(a),b=a.g.Ec(Kd(a),b)):b=a.g.Hc();this.Uc=b;a.na?(b=Ld(a),a=a.g.Ec(Md(a),b)):a=a.g.Fc();this.vc=a}g=Id.prototype;g.matches=function(a){return 0>=this.g.compare(this.Uc,a)&&0>=this.g.compare(a,this.vc)};g.F=function(a,b,c,d,e,f){this.matches(new R(b,c))||(c=J);return this.he.F(a,b,c,d,e,f)};
g.ya=function(a,b,c){b.J()&&(b=J);var d=b.nb(this.g),d=d.fa(J),e=this;b.O(N,function(a,b){e.matches(new R(a,b))||(d=d.T(a,J))});return this.he.ya(a,d,c)};g.fa=function(a){return a};g.Na=function(){return!0};g.Ub=function(){return this.he};function L(a,b){if(1==arguments.length){this.o=a.split("/");for(var c=0,d=0;d<this.o.length;d++)0<this.o[d].length&&(this.o[c]=this.o[d],c++);this.o.length=c;this.Y=0}else this.o=a,this.Y=b}function S(a,b){var c=H(a);if(null===c)return b;if(c===H(b))return S(D(a),D(b));throw Error("INTERNAL ERROR: innerPath ("+b+") is not within outerPath ("+a+")");}
function Nd(a,b){for(var c=a.slice(),d=b.slice(),e=0;e<c.length&&e<d.length;e++){var f=Oc(c[e],d[e]);if(0!==f)return f}return c.length===d.length?0:c.length<d.length?-1:1}function H(a){return a.Y>=a.o.length?null:a.o[a.Y]}function Ad(a){return a.o.length-a.Y}function D(a){var b=a.Y;b<a.o.length&&b++;return new L(a.o,b)}function Bd(a){return a.Y<a.o.length?a.o[a.o.length-1]:null}g=L.prototype;
g.toString=function(){for(var a="",b=this.Y;b<this.o.length;b++)""!==this.o[b]&&(a+="/"+this.o[b]);return a||"/"};g.slice=function(a){return this.o.slice(this.Y+(a||0))};g.parent=function(){if(this.Y>=this.o.length)return null;for(var a=[],b=this.Y;b<this.o.length-1;b++)a.push(this.o[b]);return new L(a,0)};
g.n=function(a){for(var b=[],c=this.Y;c<this.o.length;c++)b.push(this.o[c]);if(a instanceof L)for(c=a.Y;c<a.o.length;c++)b.push(a.o[c]);else for(a=a.split("/"),c=0;c<a.length;c++)0<a[c].length&&b.push(a[c]);return new L(b,0)};g.e=function(){return this.Y>=this.o.length};g.Z=function(a){if(Ad(this)!==Ad(a))return!1;for(var b=this.Y,c=a.Y;b<=this.o.length;b++,c++)if(this.o[b]!==a.o[c])return!1;return!0};
g.contains=function(a){var b=this.Y,c=a.Y;if(Ad(this)>Ad(a))return!1;for(;b<this.o.length;){if(this.o[b]!==a.o[c])return!1;++b;++c}return!0};var C=new L("");function Od(a,b){this.Qa=a.slice();this.Ha=Math.max(1,this.Qa.length);this.Qe=b;for(var c=0;c<this.Qa.length;c++)this.Ha+=ob(this.Qa[c]);Pd(this)}Od.prototype.push=function(a){0<this.Qa.length&&(this.Ha+=1);this.Qa.push(a);this.Ha+=ob(a);Pd(this)};Od.prototype.pop=function(){var a=this.Qa.pop();this.Ha-=ob(a);0<this.Qa.length&&--this.Ha};
function Pd(a){if(768<a.Ha)throw Error(a.Qe+"has a key path longer than 768 bytes ("+a.Ha+").");if(32<a.Qa.length)throw Error(a.Qe+"path specified exceeds the maximum depth that can be written (32) or object contains a cycle "+Qd(a));}function Qd(a){return 0==a.Qa.length?"":"in property '"+a.Qa.join(".")+"'"};function Rd(a){a instanceof Sd||Kc("Don't call new Database() directly - please use firebase.database().");this.ta=a;this.ba=new T(a,C);this.INTERNAL=new Td(this)}var Ud={TIMESTAMP:{".sv":"timestamp"}};g=Rd.prototype;g.app=null;g.jf=function(a){Vd(this,"ref");x("database.ref",0,1,arguments.length);return n(a)?this.ba.n(a):this.ba};
g.gg=function(a){Vd(this,"database.refFromURL");x("database.refFromURL",1,1,arguments.length);var b=Lc(a);Wd("database.refFromURL",b);var c=b.jc;c.host!==this.ta.L.host&&Kc("database.refFromURL: Host name does not match the current database: (found "+c.host+" but expected "+this.ta.L.host+")");return this.jf(b.path.toString())};function Vd(a,b){null===a.ta&&Kc("Cannot call "+b+" on a deleted database.")}g.Pf=function(){x("database.goOffline",0,0,arguments.length);Vd(this,"goOffline");this.ta.ab()};
g.Qf=function(){x("database.goOnline",0,0,arguments.length);Vd(this,"goOnline");this.ta.kc()};Object.defineProperty(Rd.prototype,"app",{get:function(){return this.ta.app}});function Td(a){this.Ya=a}Td.prototype.delete=function(){Vd(this.Ya,"delete");var a=Xd.Vb(),b=this.Ya.ta;B(a.lb,b.app.name)!==b&&Kc("Database "+b.app.name+" has already been deleted.");b.ab();delete a.lb[b.app.name];this.Ya.ta=null;this.Ya.ba=null;this.Ya=this.Ya.INTERNAL=null;return firebase.Promise.resolve()};
Rd.prototype.ref=Rd.prototype.jf;Rd.prototype.refFromURL=Rd.prototype.gg;Rd.prototype.goOnline=Rd.prototype.Qf;Rd.prototype.goOffline=Rd.prototype.Pf;Td.prototype["delete"]=Td.prototype.delete;function Yd(){this.children={};this.bd=0;this.value=null}function Zd(a,b,c){this.ud=a?a:"";this.Pc=b?b:null;this.A=c?c:new Yd}function $d(a,b){for(var c=b instanceof L?b:new L(b),d=a,e;null!==(e=H(c));)d=new Zd(e,d,B(d.A.children,e)||new Yd),c=D(c);return d}g=Zd.prototype;g.Ca=function(){return this.A.value};function ae(a,b){E("undefined"!==typeof b,"Cannot set value to undefined");a.A.value=b;be(a)}g.clear=function(){this.A.value=null;this.A.children={};this.A.bd=0;be(this)};
g.kd=function(){return 0<this.A.bd};g.e=function(){return null===this.Ca()&&!this.kd()};g.O=function(a){var b=this;r(this.A.children,function(c,d){a(new Zd(d,b,c))})};function ce(a,b,c,d){c&&!d&&b(a);a.O(function(a){ce(a,b,!0,d)});c&&d&&b(a)}function de(a,b){for(var c=a.parent();null!==c&&!b(c);)c=c.parent()}g.path=function(){return new L(null===this.Pc?this.ud:this.Pc.path()+"/"+this.ud)};g.name=function(){return this.ud};g.parent=function(){return this.Pc};
function be(a){if(null!==a.Pc){var b=a.Pc,c=a.ud,d=a.e(),e=ib(b.A.children,c);d&&e?(delete b.A.children[c],b.A.bd--,be(b)):d||e||(b.A.children[c]=a.A,b.A.bd++,be(b))}};function ee(){this.set={}}g=ee.prototype;g.add=function(a,b){this.set[a]=null!==b?b:!0};g.contains=function(a){return ib(this.set,a)};g.get=function(a){return this.contains(a)?this.set[a]:void 0};g.remove=function(a){delete this.set[a]};g.clear=function(){this.set={}};g.e=function(){return va(this.set)};g.count=function(){return oa(this.set)};function fe(a,b){r(a.set,function(a,d){b(d,a)})}g.keys=function(){var a=[];r(this.set,function(b,c){a.push(c)});return a};function ge(a,b,c,d){this.Zd=a;this.f=Ic(a);this.jc=b;this.pb=this.qb=0;this.Va=kd(b);this.tf=c;this.wc=!1;this.Cb=d;this.Yc=function(a){return Jb(b,"long_polling",a)}}var he,ie;
ge.prototype.open=function(a,b){this.Ne=0;this.ia=b;this.bf=new pb(a);this.Ab=!1;var c=this;this.sb=setTimeout(function(){c.f("Timed out trying to connect.");c.bb();c.sb=null},Math.floor(3E4));Nc(function(){if(!c.Ab){c.Ta=new je(function(a,b,d,k,l){ke(c,arguments);if(c.Ta)if(c.sb&&(clearTimeout(c.sb),c.sb=null),c.wc=!0,"start"==a)c.id=b,c.ff=d;else if("close"===a)b?(c.Ta.Kd=!1,qb(c.bf,b,function(){c.bb()})):c.bb();else throw Error("Unrecognized command received: "+a);},function(a,b){ke(c,arguments);
rb(c.bf,a,b)},function(){c.bb()},c.Yc);var a={start:"t"};a.ser=Math.floor(1E8*Math.random());c.Ta.Qd&&(a.cb=c.Ta.Qd);a.v="5";c.tf&&(a.s=c.tf);c.Cb&&(a.ls=c.Cb);"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");a=c.Yc(a);c.f("Connecting via long-poll to "+a);le(c.Ta,a,function(){})}})};
ge.prototype.start=function(){var a=this.Ta,b=this.ff;a.Vf=this.id;a.Wf=b;for(a.Ud=!0;me(a););a=this.id;b=this.ff;this.fc=document.createElement("iframe");var c={dframe:"t"};c.id=a;c.pw=b;this.fc.src=this.Yc(c);this.fc.style.display="none";document.body.appendChild(this.fc)};
ge.isAvailable=function(){return he||!ie&&"undefined"!==typeof document&&null!=document.createElement&&!("object"===typeof window&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))&&!("object"===typeof Windows&&"object"===typeof Windows.rg)&&!0};g=ge.prototype;g.sd=function(){};g.Tc=function(){this.Ab=!0;this.Ta&&(this.Ta.close(),this.Ta=null);this.fc&&(document.body.removeChild(this.fc),this.fc=null);this.sb&&(clearTimeout(this.sb),this.sb=null)};
g.bb=function(){this.Ab||(this.f("Longpoll is closing itself"),this.Tc(),this.ia&&(this.ia(this.wc),this.ia=null))};g.close=function(){this.Ab||(this.f("Longpoll is being closed."),this.Tc())};g.send=function(a){a=w(a);this.qb+=a.length;Ab(this.Va,"bytes_sent",a.length);a=nb(a);a=Va(a,!0);a=Sc(a,1840);for(var b=0;b<a.length;b++){var c=this.Ta;c.Qc.push({jg:this.Ne,pg:a.length,Pe:a[b]});c.Ud&&me(c);this.Ne++}};function ke(a,b){var c=w(b).length;a.pb+=c;Ab(a.Va,"bytes_received",c)}
function je(a,b,c,d){this.Yc=d;this.ib=c;this.ve=new ee;this.Qc=[];this.$d=Math.floor(1E8*Math.random());this.Kd=!0;this.Qd=Bc();window["pLPCommand"+this.Qd]=a;window["pRTLPCB"+this.Qd]=b;a=document.createElement("iframe");a.style.display="none";if(document.body){document.body.appendChild(a);try{a.contentWindow.document||G("No IE domain setting required")}catch(e){a.src="javascript:void((function(){document.open();document.domain='"+document.domain+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";
a.contentDocument?a.gb=a.contentDocument:a.contentWindow?a.gb=a.contentWindow.document:a.document&&(a.gb=a.document);this.Ea=a;a="";this.Ea.src&&"javascript:"===this.Ea.src.substr(0,11)&&(a='<script>document.domain="'+document.domain+'";\x3c/script>');a="<html><body>"+a+"</body></html>";try{this.Ea.gb.open(),this.Ea.gb.write(a),this.Ea.gb.close()}catch(f){G("frame writing exception"),f.stack&&G(f.stack),G(f)}}
je.prototype.close=function(){this.Ud=!1;if(this.Ea){this.Ea.gb.body.innerHTML="";var a=this;setTimeout(function(){null!==a.Ea&&(document.body.removeChild(a.Ea),a.Ea=null)},Math.floor(0))}var b=this.ib;b&&(this.ib=null,b())};
function me(a){if(a.Ud&&a.Kd&&a.ve.count()<(0<a.Qc.length?2:1)){a.$d++;var b={};b.id=a.Vf;b.pw=a.Wf;b.ser=a.$d;for(var b=a.Yc(b),c="",d=0;0<a.Qc.length;)if(1870>=a.Qc[0].Pe.length+30+c.length){var e=a.Qc.shift(),c=c+"&seg"+d+"="+e.jg+"&ts"+d+"="+e.pg+"&d"+d+"="+e.Pe;d++}else break;ne(a,b+c,a.$d);return!0}return!1}function ne(a,b,c){function d(){a.ve.remove(c);me(a)}a.ve.add(c,1);var e=setTimeout(d,Math.floor(25E3));le(a,b,function(){clearTimeout(e);d()})}
function le(a,b,c){setTimeout(function(){try{if(a.Kd){var d=a.Ea.gb.createElement("script");d.type="text/javascript";d.async=!0;d.src=b;d.onload=d.onreadystatechange=function(){var a=d.readyState;a&&"loaded"!==a&&"complete"!==a||(d.onload=d.onreadystatechange=null,d.parentNode&&d.parentNode.removeChild(d),c())};d.onerror=function(){G("Long-poll script failed to load: "+b);a.Kd=!1;a.close()};a.Ea.gb.body.appendChild(d)}}catch(e){}},Math.floor(1))};var oe=/[\[\].#$\/\u0000-\u001F\u007F]/,pe=/[\[\].#$\u0000-\u001F\u007F]/;function qe(a){return p(a)&&0!==a.length&&!oe.test(a)}function re(a){return null===a||p(a)||ga(a)&&!Mc(a)||ia(a)&&ib(a,".sv")}function se(a,b,c,d){d&&!n(b)||te(y(a,1,d),b,c)}
function te(a,b,c){c instanceof L&&(c=new Od(c,a));if(!n(b))throw Error(a+"contains undefined "+Qd(c));if(ha(b))throw Error(a+"contains a function "+Qd(c)+" with contents: "+b.toString());if(Mc(b))throw Error(a+"contains "+b.toString()+" "+Qd(c));if(p(b)&&b.length>10485760/3&&10485760<ob(b))throw Error(a+"contains a string greater than 10485760 utf8 bytes "+Qd(c)+" ('"+b.substring(0,50)+"...')");if(ia(b)){var d=!1,e=!1;jb(b,function(b,h){if(".value"===b)d=!0;else if(".priority"!==b&&".sv"!==b&&(e=
!0,!qe(b)))throw Error(a+" contains an invalid key ("+b+") "+Qd(c)+'.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');c.push(b);te(a,h,c);c.pop()});if(d&&e)throw Error(a+' contains ".value" child '+Qd(c)+" in addition to actual children.");}}
function ue(a,b){var c,d;for(c=0;c<b.length;c++){d=b[c];for(var e=d.slice(),f=0;f<e.length;f++)if((".priority"!==e[f]||f!==e.length-1)&&!qe(e[f]))throw Error(a+"contains an invalid key ("+e[f]+") in path "+d.toString()+'. Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');}b.sort(Nd);e=null;for(c=0;c<b.length;c++){d=b[c];if(null!==e&&e.contains(d))throw Error(a+"contains a path "+e.toString()+" that is ancestor of another path "+d.toString());e=d}}
function ve(a,b,c){var d=y(a,1,!1);if(!ia(b)||ea(b))throw Error(d+" must be an object containing the children to replace.");var e=[];jb(b,function(a,b){var k=new L(a);te(d,b,c.n(k));if(".priority"===Bd(k)&&!re(b))throw Error(d+"contains an invalid value for '"+k.toString()+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");e.push(k)});ue(d,e)}
function we(a,b,c){if(Mc(c))throw Error(y(a,b,!1)+"is "+c.toString()+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!re(c))throw Error(y(a,b,!1)+"must be a valid Firebase priority (a string, finite number, server value, or null).");}
function xe(a,b,c){if(!c||n(b))switch(b){case "value":case "child_added":case "child_removed":case "child_changed":case "child_moved":break;default:throw Error(y(a,1,c)+'must be a valid event type: "value", "child_added", "child_removed", "child_changed", or "child_moved".');}}function ye(a,b){if(n(b)&&!qe(b))throw Error(y(a,2,!0)+'was an invalid key: "'+b+'".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").');}
function ze(a,b){if(!p(b)||0===b.length||pe.test(b))throw Error(y(a,1,!1)+'was an invalid path: "'+b+'". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"');}function Ae(a,b){if(".info"===H(b))throw Error(a+" failed: Can't modify data under /.info/");}
function Wd(a,b){var c=b.path.toString(),d;!(d=!p(b.jc.host)||0===b.jc.host.length||!qe(b.jc.pe))&&(d=0!==c.length)&&(c&&(c=c.replace(/^\/*\.info(\/|$)/,"/")),d=!(p(c)&&0!==c.length&&!pe.test(c)));if(d)throw Error(y(a,1,!1)+'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".');};function U(a,b){this.ta=a;this.qa=b}U.prototype.cancel=function(a){x("Firebase.onDisconnect().cancel",0,1,arguments.length);A("Firebase.onDisconnect().cancel",1,a,!0);var b=new db;this.ta.xd(this.qa,eb(b,a));return b.ra};U.prototype.cancel=U.prototype.cancel;U.prototype.remove=function(a){x("Firebase.onDisconnect().remove",0,1,arguments.length);Ae("Firebase.onDisconnect().remove",this.qa);A("Firebase.onDisconnect().remove",1,a,!0);var b=new db;Be(this.ta,this.qa,null,eb(b,a));return b.ra};
U.prototype.remove=U.prototype.remove;U.prototype.set=function(a,b){x("Firebase.onDisconnect().set",1,2,arguments.length);Ae("Firebase.onDisconnect().set",this.qa);se("Firebase.onDisconnect().set",a,this.qa,!1);A("Firebase.onDisconnect().set",2,b,!0);var c=new db;Be(this.ta,this.qa,a,eb(c,b));return c.ra};U.prototype.set=U.prototype.set;
U.prototype.Jb=function(a,b,c){x("Firebase.onDisconnect().setWithPriority",2,3,arguments.length);Ae("Firebase.onDisconnect().setWithPriority",this.qa);se("Firebase.onDisconnect().setWithPriority",a,this.qa,!1);we("Firebase.onDisconnect().setWithPriority",2,b);A("Firebase.onDisconnect().setWithPriority",3,c,!0);var d=new db;Ce(this.ta,this.qa,a,b,eb(d,c));return d.ra};U.prototype.setWithPriority=U.prototype.Jb;
U.prototype.update=function(a,b){x("Firebase.onDisconnect().update",1,2,arguments.length);Ae("Firebase.onDisconnect().update",this.qa);if(ea(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;O("Passing an Array to Firebase.onDisconnect().update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}ve("Firebase.onDisconnect().update",a,this.qa);A("Firebase.onDisconnect().update",2,b,!0);
c=new db;De(this.ta,this.qa,a,eb(c,b));return c.ra};U.prototype.update=U.prototype.update;function Ee(a){E(ea(a)&&0<a.length,"Requires a non-empty array");this.Bf=a;this.Dc={}}Ee.prototype.Ge=function(a,b){var c;c=this.Dc[a]||[];var d=c.length;if(0<d){for(var e=Array(d),f=0;f<d;f++)e[f]=c[f];c=e}else c=[];for(d=0;d<c.length;d++)c[d].Ie.apply(c[d].Ma,Array.prototype.slice.call(arguments,1))};Ee.prototype.gc=function(a,b,c){Fe(this,a);this.Dc[a]=this.Dc[a]||[];this.Dc[a].push({Ie:b,Ma:c});(a=this.Ue(a))&&b.apply(c,a)};
Ee.prototype.Ic=function(a,b,c){Fe(this,a);a=this.Dc[a]||[];for(var d=0;d<a.length;d++)if(a[d].Ie===b&&(!c||c===a[d].Ma)){a.splice(d,1);break}};function Fe(a,b){E(Da(a.Bf,function(a){return a===b}),"Unknown event: "+b)};function Ge(){Ee.call(this,["visible"]);var a,b;"undefined"!==typeof document&&"undefined"!==typeof document.addEventListener&&("undefined"!==typeof document.hidden?(b="visibilitychange",a="hidden"):"undefined"!==typeof document.mozHidden?(b="mozvisibilitychange",a="mozHidden"):"undefined"!==typeof document.msHidden?(b="msvisibilitychange",a="msHidden"):"undefined"!==typeof document.webkitHidden&&(b="webkitvisibilitychange",a="webkitHidden"));this.Mb=!0;if(b){var c=this;document.addEventListener(b,
function(){var b=!document[a];b!==c.Mb&&(c.Mb=b,c.Ge("visible",b))},!1)}}la(Ge,Ee);Ge.prototype.Ue=function(a){E("visible"===a,"Unknown event type: "+a);return[this.Mb]};ca(Ge);function He(){Ee.call(this,["online"]);this.hc=!0;if("undefined"!==typeof window&&"undefined"!==typeof window.addEventListener&&!tb()){var a=this;window.addEventListener("online",function(){a.hc||(a.hc=!0,a.Ge("online",!0))},!1);window.addEventListener("offline",function(){a.hc&&(a.hc=!1,a.Ge("online",!1))},!1)}}la(He,Ee);He.prototype.Ue=function(a){E("online"===a,"Unknown event type: "+a);return[this.hc]};ca(He);var Ie=function(){var a=0,b=[];return function(c){var d=c===a;a=c;for(var e=Array(8),f=7;0<=f;f--)e[f]="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c%64),c=Math.floor(c/64);E(0===c,"Cannot push at time == 0");c=e.join("");if(d){for(f=11;0<=f&&63===b[f];f--)b[f]=0;b[f]++}else for(f=0;12>f;f++)b[f]=Math.floor(64*Math.random());for(f=0;12>f;f++)c+="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);E(20===c.length,"nextPushId: Length should be 20.");
return c}}();function Je(a,b){this.value=a;this.children=b||Ke}var Ke=new gc(function(a,b){return a===b?0:a<b?-1:1});function Le(a){var b=Q;r(a,function(a,d){b=b.set(new L(d),a)});return b}g=Je.prototype;g.e=function(){return null===this.value&&this.children.e()};function Me(a,b,c){if(null!=a.value&&c(a.value))return{path:C,value:a.value};if(b.e())return null;var d=H(b);a=a.children.get(d);return null!==a?(b=Me(a,D(b),c),null!=b?{path:(new L(d)).n(b.path),value:b.value}:null):null}
function Ne(a,b){return Me(a,b,function(){return!0})}g.subtree=function(a){if(a.e())return this;var b=this.children.get(H(a));return null!==b?b.subtree(D(a)):Q};g.set=function(a,b){if(a.e())return new Je(b,this.children);var c=H(a),d=(this.children.get(c)||Q).set(D(a),b),c=this.children.Oa(c,d);return new Je(this.value,c)};
g.remove=function(a){if(a.e())return this.children.e()?Q:new Je(null,this.children);var b=H(a),c=this.children.get(b);return c?(a=c.remove(D(a)),b=a.e()?this.children.remove(b):this.children.Oa(b,a),null===this.value&&b.e()?Q:new Je(this.value,b)):this};g.get=function(a){if(a.e())return this.value;var b=this.children.get(H(a));return b?b.get(D(a)):null};
function Ed(a,b,c){if(b.e())return c;var d=H(b);b=Ed(a.children.get(d)||Q,D(b),c);d=b.e()?a.children.remove(d):a.children.Oa(d,b);return new Je(a.value,d)}function Oe(a,b){return Pe(a,C,b)}function Pe(a,b,c){var d={};a.children.ha(function(a,f){d[a]=Pe(f,b.n(a),c)});return c(b,a.value,d)}function Qe(a,b,c){return Re(a,b,C,c)}function Re(a,b,c,d){var e=a.value?d(c,a.value):!1;if(e)return e;if(b.e())return null;e=H(b);return(a=a.children.get(e))?Re(a,D(b),c.n(e),d):null}
function Se(a,b,c){Te(a,b,C,c)}function Te(a,b,c,d){if(b.e())return a;a.value&&d(c,a.value);var e=H(b);return(a=a.children.get(e))?Te(a,D(b),c.n(e),d):Q}function Cd(a,b){Ue(a,C,b)}function Ue(a,b,c){a.children.ha(function(a,e){Ue(e,b.n(a),c)});a.value&&c(b,a.value)}function Ve(a,b){a.children.ha(function(a,d){d.value&&b(a,d.value)})}var Q=new Je(null);Je.prototype.toString=function(){var a={};Cd(this,function(b,c){a[b.toString()]=c.toString()});return w(a)};function We(a,b,c){this.type=ud;this.source=Xe;this.path=a;this.Ob=b;this.Id=c}We.prototype.Mc=function(a){if(this.path.e()){if(null!=this.Ob.value)return E(this.Ob.children.e(),"affectedTree should not have overlapping affected paths."),this;a=this.Ob.subtree(new L(a));return new We(C,a,this.Id)}E(H(this.path)===a,"operationForChild called for unrelated child.");return new We(D(this.path),this.Ob,this.Id)};
We.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" ack write revert="+this.Id+" affectedTree="+this.Ob+")"};var wb=0,bd=1,ud=2,yb=3;function Ye(a,b,c,d){this.ee=a;this.Se=b;this.Hb=c;this.Ee=d;E(!d||b,"Tagged queries must be from server.")}var Xe=new Ye(!0,!1,null,!1),Ze=new Ye(!1,!0,null,!1);Ye.prototype.toString=function(){return this.ee?"user":this.Ee?"server(queryID="+this.Hb+")":"server"};var $e=null;"undefined"!==typeof MozWebSocket?$e=MozWebSocket:"undefined"!==typeof WebSocket&&($e=WebSocket);function af(a,b,c,d){this.Zd=a;this.f=Ic(this.Zd);this.frames=this.zc=null;this.pb=this.qb=this.Fe=0;this.Va=kd(b);a={v:"5"};"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");c&&(a.s=c);d&&(a.ls=d);this.Ke=Jb(b,"websocket",a)}var bf;
af.prototype.open=function(a,b){this.ib=b;this.Xf=a;this.f("Websocket connecting to "+this.Ke);this.wc=!1;Fb.set("previous_websocket_failure",!0);try{this.Ia=new $e(this.Ke)}catch(c){this.f("Error instantiating WebSocket.");var d=c.message||c.data;d&&this.f(d);this.bb();return}var e=this;this.Ia.onopen=function(){e.f("Websocket connected.");e.wc=!0};this.Ia.onclose=function(){e.f("Websocket connection was disconnected.");e.Ia=null;e.bb()};this.Ia.onmessage=function(a){if(null!==e.Ia)if(a=a.data,e.pb+=
a.length,Ab(e.Va,"bytes_received",a.length),cf(e),null!==e.frames)df(e,a);else{a:{E(null===e.frames,"We already have a frame buffer");if(6>=a.length){var b=Number(a);if(!isNaN(b)){e.Fe=b;e.frames=[];a=null;break a}}e.Fe=1;e.frames=[]}null!==a&&df(e,a)}};this.Ia.onerror=function(a){e.f("WebSocket error.  Closing connection.");(a=a.message||a.data)&&e.f(a);e.bb()}};af.prototype.start=function(){};
af.isAvailable=function(){var a=!1;if("undefined"!==typeof navigator&&navigator.userAgent){var b=navigator.userAgent.match(/Android ([0-9]{0,}\.[0-9]{0,})/);b&&1<b.length&&4.4>parseFloat(b[1])&&(a=!0)}return!a&&null!==$e&&!bf};af.responsesRequiredToBeHealthy=2;af.healthyTimeout=3E4;g=af.prototype;g.sd=function(){Fb.remove("previous_websocket_failure")};function df(a,b){a.frames.push(b);if(a.frames.length==a.Fe){var c=a.frames.join("");a.frames=null;c=gb(c);a.Xf(c)}}
g.send=function(a){cf(this);a=w(a);this.qb+=a.length;Ab(this.Va,"bytes_sent",a.length);a=Sc(a,16384);1<a.length&&ef(this,String(a.length));for(var b=0;b<a.length;b++)ef(this,a[b])};g.Tc=function(){this.Ab=!0;this.zc&&(clearInterval(this.zc),this.zc=null);this.Ia&&(this.Ia.close(),this.Ia=null)};g.bb=function(){this.Ab||(this.f("WebSocket is closing itself"),this.Tc(),this.ib&&(this.ib(this.wc),this.ib=null))};g.close=function(){this.Ab||(this.f("WebSocket is being closed"),this.Tc())};
function cf(a){clearInterval(a.zc);a.zc=setInterval(function(){a.Ia&&ef(a,"0");cf(a)},Math.floor(45E3))}function ef(a,b){try{a.Ia.send(b)}catch(c){a.f("Exception thrown from WebSocket.send():",c.message||c.data,"Closing connection."),setTimeout(q(a.bb,a),0)}};function ff(a){gf(this,a)}var hf=[ge,af];function gf(a,b){var c=af&&af.isAvailable(),d=c&&!(Fb.Ze||!0===Fb.get("previous_websocket_failure"));b.qg&&(c||O("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),d=!0);if(d)a.Wc=[af];else{var e=a.Wc=[];Tc(hf,function(a,b){b&&b.isAvailable()&&e.push(b)})}}function jf(a){if(0<a.Wc.length)return a.Wc[0];throw Error("No transports available");};function kf(a,b,c,d,e,f,h){this.id=a;this.f=Ic("c:"+this.id+":");this.te=c;this.Lc=d;this.ia=e;this.se=f;this.L=b;this.Ad=[];this.Le=0;this.sf=new ff(b);this.Ua=0;this.Cb=h;this.f("Connection created");lf(this)}
function lf(a){var b=jf(a.sf);a.I=new b("c:"+a.id+":"+a.Le++,a.L,void 0,a.Cb);a.xe=b.responsesRequiredToBeHealthy||0;var c=mf(a,a.I),d=nf(a,a.I);a.Xc=a.I;a.Rc=a.I;a.D=null;a.Bb=!1;setTimeout(function(){a.I&&a.I.open(c,d)},Math.floor(0));b=b.healthyTimeout||0;0<b&&(a.md=Xc(function(){a.md=null;a.Bb||(a.I&&102400<a.I.pb?(a.f("Connection exceeded healthy timeout but has received "+a.I.pb+" bytes.  Marking connection healthy."),a.Bb=!0,a.I.sd()):a.I&&10240<a.I.qb?a.f("Connection exceeded healthy timeout but has sent "+
a.I.qb+" bytes.  Leaving connection alive."):(a.f("Closing unhealthy connection after timeout."),a.close()))},Math.floor(b)))}function nf(a,b){return function(c){b===a.I?(a.I=null,c||0!==a.Ua?1===a.Ua&&a.f("Realtime connection lost."):(a.f("Realtime connection failed."),"s-"===a.L.$a.substr(0,2)&&(Fb.remove("host:"+a.L.host),a.L.$a=a.L.host)),a.close()):b===a.D?(a.f("Secondary connection lost."),c=a.D,a.D=null,a.Xc!==c&&a.Rc!==c||a.close()):a.f("closing an old connection")}}
function mf(a,b){return function(c){if(2!=a.Ua)if(b===a.Rc){var d=Qc("t",c);c=Qc("d",c);if("c"==d){if(d=Qc("t",c),"d"in c)if(c=c.d,"h"===d){var d=c.ts,e=c.v,f=c.h;a.qf=c.s;Ib(a.L,f);0==a.Ua&&(a.I.start(),of(a,a.I,d),"5"!==e&&O("Protocol version mismatch detected"),c=a.sf,(c=1<c.Wc.length?c.Wc[1]:null)&&pf(a,c))}else if("n"===d){a.f("recvd end transmission on primary");a.Rc=a.D;for(c=0;c<a.Ad.length;++c)a.wd(a.Ad[c]);a.Ad=[];qf(a)}else"s"===d?(a.f("Connection shutdown command received. Shutting down..."),
a.se&&(a.se(c),a.se=null),a.ia=null,a.close()):"r"===d?(a.f("Reset packet received.  New host: "+c),Ib(a.L,c),1===a.Ua?a.close():(rf(a),lf(a))):"e"===d?Jc("Server Error: "+c):"o"===d?(a.f("got pong on primary."),sf(a),tf(a)):Jc("Unknown control packet command: "+d)}else"d"==d&&a.wd(c)}else if(b===a.D)if(d=Qc("t",c),c=Qc("d",c),"c"==d)"t"in c&&(c=c.t,"a"===c?uf(a):"r"===c?(a.f("Got a reset on secondary, closing it"),a.D.close(),a.Xc!==a.D&&a.Rc!==a.D||a.close()):"o"===c&&(a.f("got pong on secondary."),
a.pf--,uf(a)));else if("d"==d)a.Ad.push(c);else throw Error("Unknown protocol layer: "+d);else a.f("message on old connection")}}kf.prototype.ua=function(a){vf(this,{t:"d",d:a})};function qf(a){a.Xc===a.D&&a.Rc===a.D&&(a.f("cleaning up and promoting a connection: "+a.D.Zd),a.I=a.D,a.D=null)}
function uf(a){0>=a.pf?(a.f("Secondary connection is healthy."),a.Bb=!0,a.D.sd(),a.D.start(),a.f("sending client ack on secondary"),a.D.send({t:"c",d:{t:"a",d:{}}}),a.f("Ending transmission on primary"),a.I.send({t:"c",d:{t:"n",d:{}}}),a.Xc=a.D,qf(a)):(a.f("sending ping on secondary."),a.D.send({t:"c",d:{t:"p",d:{}}}))}kf.prototype.wd=function(a){sf(this);this.te(a)};function sf(a){a.Bb||(a.xe--,0>=a.xe&&(a.f("Primary connection is healthy."),a.Bb=!0,a.I.sd()))}
function pf(a,b){a.D=new b("c:"+a.id+":"+a.Le++,a.L,a.qf);a.pf=b.responsesRequiredToBeHealthy||0;a.D.open(mf(a,a.D),nf(a,a.D));Xc(function(){a.D&&(a.f("Timed out trying to upgrade."),a.D.close())},Math.floor(6E4))}function of(a,b,c){a.f("Realtime connection established.");a.I=b;a.Ua=1;a.Lc&&(a.Lc(c,a.qf),a.Lc=null);0===a.xe?(a.f("Primary connection is healthy."),a.Bb=!0):Xc(function(){tf(a)},Math.floor(5E3))}
function tf(a){a.Bb||1!==a.Ua||(a.f("sending ping on primary."),vf(a,{t:"c",d:{t:"p",d:{}}}))}function vf(a,b){if(1!==a.Ua)throw"Connection is not connected";a.Xc.send(b)}kf.prototype.close=function(){2!==this.Ua&&(this.f("Closing realtime connection."),this.Ua=2,rf(this),this.ia&&(this.ia(),this.ia=null))};function rf(a){a.f("Shutting down all connections");a.I&&(a.I.close(),a.I=null);a.D&&(a.D.close(),a.D=null);a.md&&(clearTimeout(a.md),a.md=null)};function wf(a,b,c,d,e,f){this.id=xf++;this.f=Ic("p:"+this.id+":");this.qd={};this.$={};this.pa=[];this.Oc=0;this.Kc=[];this.ma=!1;this.Sa=1E3;this.td=3E5;this.Gb=b;this.Jc=c;this.ue=d;this.L=a;this.ob=this.Fa=this.Cb=this.ze=null;this.$c=e;this.de=!1;this.ke=0;if(f)throw Error("Auth override specified in options, but not supported on non Node.js platforms");this.Vd=f;this.ub=null;this.Mb=!1;this.Gd={};this.ig=0;this.Re=!0;this.Ac=this.me=null;yf(this,0);Ge.Vb().gc("visible",this.Zf,this);-1===a.host.indexOf("fblocal")&&
He.Vb().gc("online",this.Yf,this)}var xf=0,zf=0;g=wf.prototype;g.ua=function(a,b,c){var d=++this.ig;a={r:d,a:a,b:b};this.f(w(a));E(this.ma,"sendRequest call when we're not connected not allowed.");this.Fa.ua(a);c&&(this.Gd[d]=c)};
g.$e=function(a,b,c,d){var e=a.ja(),f=a.path.toString();this.f("Listen called for "+f+" "+e);this.$[f]=this.$[f]||{};E(ed(a.m)||!V(a.m),"listen() called for non-default but complete query");E(!this.$[f][e],"listen() called twice for same path/queryId.");a={G:d,ld:b,eg:a,tag:c};this.$[f][e]=a;this.ma&&Af(this,a)};
function Af(a,b){var c=b.eg,d=c.path.toString(),e=c.ja();a.f("Listen on "+d+" for "+e);var f={p:d};b.tag&&(f.q=Bf(c.m),f.t=b.tag);f.h=b.ld();a.ua("q",f,function(f){var k=f.d,l=f.s;if(k&&"object"===typeof k&&ib(k,"w")){var m=B(k,"w");ea(m)&&0<=xa(m,"no_index")&&O("Using an unspecified index. Consider adding "+('".indexOn": "'+c.m.g.toString()+'"')+" at "+c.path.toString()+" to your security rules for better performance")}(a.$[d]&&a.$[d][e])===b&&(a.f("listen response",f),"ok"!==l&&Cf(a,d,e),b.G&&b.G(l,
k))})}g.kf=function(a){this.ob=a;this.f("Auth token refreshed");this.ob?Df(this):this.ma&&this.ua("unauth",{},function(){});if(a&&40===a.length||$c(a))this.f("Admin auth credential detected.  Reducing max reconnect time."),this.td=3E4};function Df(a){if(a.ma&&a.ob){var b=a.ob,c=Zc(b)?"auth":"gauth",d={cred:b};null===a.Vd?d.noauth=!0:"object"===typeof a.Vd&&(d.authvar=a.Vd);a.ua(c,d,function(c){var d=c.s;c=c.d||"error";a.ob===b&&("ok"===d?a.ke=0:Ef(a,d,c))})}}
g.uf=function(a,b){var c=a.path.toString(),d=a.ja();this.f("Unlisten called for "+c+" "+d);E(ed(a.m)||!V(a.m),"unlisten() called for non-default but complete query");if(Cf(this,c,d)&&this.ma){var e=Bf(a.m);this.f("Unlisten on "+c+" for "+d);c={p:c};b&&(c.q=e,c.t=b);this.ua("n",c)}};g.re=function(a,b,c){this.ma?Ff(this,"o",a,b,c):this.Kc.push({we:a,action:"o",data:b,G:c})};g.cf=function(a,b,c){this.ma?Ff(this,"om",a,b,c):this.Kc.push({we:a,action:"om",data:b,G:c})};
g.xd=function(a,b){this.ma?Ff(this,"oc",a,null,b):this.Kc.push({we:a,action:"oc",data:null,G:b})};function Ff(a,b,c,d,e){c={p:c,d:d};a.f("onDisconnect "+b,c);a.ua(b,c,function(a){e&&setTimeout(function(){e(a.s,a.d)},Math.floor(0))})}g.put=function(a,b,c,d){Gf(this,"p",a,b,c,d)};g.af=function(a,b,c,d){Gf(this,"m",a,b,c,d)};function Gf(a,b,c,d,e,f){d={p:c,d:d};n(f)&&(d.h=f);a.pa.push({action:b,mf:d,G:e});a.Oc++;b=a.pa.length-1;a.ma?Hf(a,b):a.f("Buffering put: "+c)}
function Hf(a,b){var c=a.pa[b].action,d=a.pa[b].mf,e=a.pa[b].G;a.pa[b].fg=a.ma;a.ua(c,d,function(d){a.f(c+" response",d);delete a.pa[b];a.Oc--;0===a.Oc&&(a.pa=[]);e&&e(d.s,d.d)})}g.ye=function(a){this.ma&&(a={c:a},this.f("reportStats",a),this.ua("s",a,function(a){"ok"!==a.s&&this.f("reportStats","Error sending stats: "+a.d)}))};
g.wd=function(a){if("r"in a){this.f("from server: "+w(a));var b=a.r,c=this.Gd[b];c&&(delete this.Gd[b],c(a.b))}else{if("error"in a)throw"A server-side error has occurred: "+a.error;"a"in a&&(b=a.a,a=a.b,this.f("handleServerMessage",b,a),"d"===b?this.Gb(a.p,a.d,!1,a.t):"m"===b?this.Gb(a.p,a.d,!0,a.t):"c"===b?If(this,a.p,a.q):"ac"===b?Ef(this,a.s,a.d):"sd"===b?this.ze?this.ze(a):"msg"in a&&"undefined"!==typeof console&&console.log("FIREBASE: "+a.msg.replace("\n","\nFIREBASE: ")):Jc("Unrecognized action received from server: "+
w(b)+"\nAre you using the latest client?"))}};g.Lc=function(a,b){this.f("connection ready");this.ma=!0;this.Ac=(new Date).getTime();this.ue({serverTimeOffset:a-(new Date).getTime()});this.Cb=b;if(this.Re){var c={};c["sdk.js."+firebase.SDK_VERSION.replace(/\./g,"-")]=1;tb()?c["framework.cordova"]=1:"object"===typeof navigator&&"ReactNative"===navigator.product&&(c["framework.reactnative"]=1);this.ye(c)}Jf(this);this.Re=!1;this.Jc(!0)};
function yf(a,b){E(!a.Fa,"Scheduling a connect when we're already connected/ing?");a.ub&&clearTimeout(a.ub);a.ub=setTimeout(function(){a.ub=null;Kf(a)},Math.floor(b))}g.Zf=function(a){a&&!this.Mb&&this.Sa===this.td&&(this.f("Window became visible.  Reducing delay."),this.Sa=1E3,this.Fa||yf(this,0));this.Mb=a};g.Yf=function(a){a?(this.f("Browser went online."),this.Sa=1E3,this.Fa||yf(this,0)):(this.f("Browser went offline.  Killing connection."),this.Fa&&this.Fa.close())};
g.df=function(){this.f("data client disconnected");this.ma=!1;this.Fa=null;for(var a=0;a<this.pa.length;a++){var b=this.pa[a];b&&"h"in b.mf&&b.fg&&(b.G&&b.G("disconnect"),delete this.pa[a],this.Oc--)}0===this.Oc&&(this.pa=[]);this.Gd={};Lf(this)&&(this.Mb?this.Ac&&(3E4<(new Date).getTime()-this.Ac&&(this.Sa=1E3),this.Ac=null):(this.f("Window isn't visible.  Delaying reconnect."),this.Sa=this.td,this.me=(new Date).getTime()),a=Math.max(0,this.Sa-((new Date).getTime()-this.me)),a*=Math.random(),this.f("Trying to reconnect in "+
a+"ms"),yf(this,a),this.Sa=Math.min(this.td,1.3*this.Sa));this.Jc(!1)};
function Kf(a){if(Lf(a)){a.f("Making a connection attempt");a.me=(new Date).getTime();a.Ac=null;var b=q(a.wd,a),c=q(a.Lc,a),d=q(a.df,a),e=a.id+":"+zf++,f=a.Cb,h=!1,k=null,l=function(){k?k.close():(h=!0,d())};a.Fa={close:l,ua:function(a){E(k,"sendRequest call when we're not connected not allowed.");k.ua(a)}};var m=a.de;a.de=!1;a.$c.getToken(m).then(function(l){h?G("getToken() completed but was canceled"):(G("getToken() completed. Creating connection."),a.ob=l&&l.accessToken,k=new kf(e,a.L,b,c,d,function(b){O(b+
" ("+a.L.toString()+")");a.ab("server_kill")},f))}).then(null,function(b){a.f("Failed to get token: "+b);h||l()})}}g.ab=function(a){G("Interrupting connection for reason: "+a);this.qd[a]=!0;this.Fa?this.Fa.close():(this.ub&&(clearTimeout(this.ub),this.ub=null),this.ma&&this.df())};g.kc=function(a){G("Resuming connection for reason: "+a);delete this.qd[a];va(this.qd)&&(this.Sa=1E3,this.Fa||yf(this,0))};
function If(a,b,c){c=c?Aa(c,function(a){return Rc(a)}).join("$"):"default";(a=Cf(a,b,c))&&a.G&&a.G("permission_denied")}function Cf(a,b,c){b=(new L(b)).toString();var d;n(a.$[b])?(d=a.$[b][c],delete a.$[b][c],0===oa(a.$[b])&&delete a.$[b]):d=void 0;return d}
function Ef(a,b,c){G("Auth token revoked: "+b+"/"+c);a.ob=null;a.de=!0;a.Fa.close();"invalid_token"===b&&(a.ke++,3<=a.ke&&(a.Sa=3E4,a=a.$c,b='Provided authentication credentials for the app named "'+a.oc.name+'" are invalid. This usually indicates your app was not initialized correctly. ',b="credential"in a.oc.options?b+'Make sure the "credential" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':"serviceAccount"in a.oc.options?
b+'Make sure the "serviceAccount" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':b+'Make sure the "apiKey" and "databaseURL" properties provided to initializeApp() match the values provided for your app at https://console.firebase.google.com/.',O(b)))}
function Jf(a){Df(a);r(a.$,function(b){r(b,function(b){Af(a,b)})});for(var b=0;b<a.pa.length;b++)a.pa[b]&&Hf(a,b);for(;a.Kc.length;)b=a.Kc.shift(),Ff(a,b.action,b.we,b.data,b.G)}function Lf(a){var b;b=He.Vb().hc;return va(a.qd)&&b};var W={Mf:function(){he=bf=!0}};W.forceLongPolling=W.Mf;W.Nf=function(){ie=!0};W.forceWebSockets=W.Nf;W.Tf=function(){return af.isAvailable()};W.isWebSocketsAvailable=W.Tf;W.lg=function(a,b){a.u.Ra.ze=b};W.setSecurityDebugCallback=W.lg;W.Be=function(a,b){a.u.Be(b)};W.stats=W.Be;W.Ce=function(a,b){a.u.Ce(b)};W.statsIncrementCounter=W.Ce;W.fd=function(a){return a.u.fd};W.dataUpdateCount=W.fd;W.Sf=function(a,b){a.u.je=b};W.interceptServerData=W.Sf;function R(a,b){this.name=a;this.R=b}function Mf(a,b){return new R(a,b)};function Nf(a){this.V=a;this.g=a.m.g}function Of(a,b,c,d){var e=[],f=[];ya(b,function(b){"child_changed"===b.type&&a.g.nd(b.qe,b.Ja)&&f.push(new I("child_moved",b.Ja,b.Xa))});Pf(a,e,"child_removed",b,d,c);Pf(a,e,"child_added",b,d,c);Pf(a,e,"child_moved",f,d,c);Pf(a,e,"child_changed",b,d,c);Pf(a,e,ac,b,d,c);return e}function Pf(a,b,c,d,e,f){d=za(d,function(a){return a.type===c});Ha(d,q(a.Ff,a));ya(d,function(c){var d=Qf(a,c,f);ya(e,function(e){e.nf(c.type)&&b.push(e.createEvent(d,a.V))})})}
function Qf(a,b,c){"value"!==b.type&&"child_removed"!==b.type&&(b.Dd=c.Ve(b.Xa,b.Ja,a.g));return b}Nf.prototype.Ff=function(a,b){if(null==a.Xa||null==b.Xa)throw Cc("Should only compare child_ events.");return this.g.compare(new R(a.Xa,a.Ja),new R(b.Xa,b.Ja))};function Rf(a){this.sa=new Id(a);this.g=a.g;E(a.xa,"Only valid if limit has been set");this.oa=a.oa;this.Ib=!Sf(a)}g=Rf.prototype;g.F=function(a,b,c,d,e,f){this.sa.matches(new R(b,c))||(c=J);return a.Q(b).Z(c)?a:a.Eb()<this.oa?this.sa.Ub().F(a,b,c,d,e,f):Tf(this,a,b,c,e,f)};
g.ya=function(a,b,c){var d;if(b.J()||b.e())d=J.nb(this.g);else if(2*this.oa<b.Eb()&&b.yc(this.g)){d=J.nb(this.g);b=this.Ib?b.Zb(this.sa.vc,this.g):b.Xb(this.sa.Uc,this.g);for(var e=0;0<b.Pa.length&&e<this.oa;){var f=K(b),h;if(h=this.Ib?0>=this.g.compare(this.sa.Uc,f):0>=this.g.compare(f,this.sa.vc))d=d.T(f.name,f.R),e++;else break}}else{d=b.nb(this.g);d=d.fa(J);var k,l,m;if(this.Ib){b=d.We(this.g);k=this.sa.vc;l=this.sa.Uc;var u=Uf(this.g);m=function(a,b){return u(b,a)}}else b=d.Wb(this.g),k=this.sa.Uc,
l=this.sa.vc,m=Uf(this.g);for(var e=0,z=!1;0<b.Pa.length;)f=K(b),!z&&0>=m(k,f)&&(z=!0),(h=z&&e<this.oa&&0>=m(f,l))?e++:d=d.T(f.name,J)}return this.sa.Ub().ya(a,d,c)};g.fa=function(a){return a};g.Na=function(){return!0};g.Ub=function(){return this.sa.Ub()};
function Tf(a,b,c,d,e,f){var h;if(a.Ib){var k=Uf(a.g);h=function(a,b){return k(b,a)}}else h=Uf(a.g);E(b.Eb()==a.oa,"");var l=new R(c,d),m=a.Ib?Vf(b,a.g):Wf(b,a.g),u=a.sa.matches(l);if(b.Da(c)){for(var z=b.Q(c),m=e.fe(a.g,m,a.Ib);null!=m&&(m.name==c||b.Da(m.name));)m=e.fe(a.g,m,a.Ib);e=null==m?1:h(m,l);if(u&&!d.e()&&0<=e)return null!=f&&Gd(f,new I("child_changed",d,c,z)),b.T(c,d);null!=f&&Gd(f,new I("child_removed",z,c));b=b.T(c,J);return null!=m&&a.sa.matches(m)?(null!=f&&Gd(f,new I("child_added",
m.R,m.name)),b.T(m.name,m.R)):b}return d.e()?b:u&&0<=h(m,l)?(null!=f&&(Gd(f,new I("child_removed",m.R,m.name)),Gd(f,new I("child_added",d,c))),b.T(c,d).T(m.name,J)):b};function Ac(a,b){this.B=a;E(n(this.B)&&null!==this.B,"LeafNode shouldn't be created with null/undefined value.");this.aa=b||J;Xf(this.aa);this.Db=null}var Yf=["object","boolean","number","string"];g=Ac.prototype;g.J=function(){return!0};g.C=function(){return this.aa};g.fa=function(a){return new Ac(this.B,a)};g.Q=function(a){return".priority"===a?this.aa:J};g.P=function(a){return a.e()?this:".priority"===H(a)?this.aa:J};g.Da=function(){return!1};g.Ve=function(){return null};
g.T=function(a,b){return".priority"===a?this.fa(b):b.e()&&".priority"!==a?this:J.T(a,b).fa(this.aa)};g.F=function(a,b){var c=H(a);if(null===c)return b;if(b.e()&&".priority"!==c)return this;E(".priority"!==c||1===Ad(a),".priority must be the last token in a path");return this.T(c,J.F(D(a),b))};g.e=function(){return!1};g.Eb=function(){return 0};g.O=function(){return!1};g.H=function(a){return a&&!this.C().e()?{".value":this.Ca(),".priority":this.C().H()}:this.Ca()};
g.hash=function(){if(null===this.Db){var a="";this.aa.e()||(a+="priority:"+Zf(this.aa.H())+":");var b=typeof this.B,a=a+(b+":"),a="number"===b?a+Uc(this.B):a+this.B;this.Db=Ec(a)}return this.Db};g.Ca=function(){return this.B};g.sc=function(a){if(a===J)return 1;if(a instanceof P)return-1;E(a.J(),"Unknown node type");var b=typeof a.B,c=typeof this.B,d=xa(Yf,b),e=xa(Yf,c);E(0<=d,"Unknown leaf type: "+b);E(0<=e,"Unknown leaf type: "+c);return d===e?"object"===c?0:this.B<a.B?-1:this.B===a.B?0:1:e-d};
g.nb=function(){return this};g.yc=function(){return!0};g.Z=function(a){return a===this?!0:a.J()?this.B===a.B&&this.aa.Z(a.aa):!1};g.toString=function(){return w(this.H(!0))};function $f(a,b){return Oc(a.name,b.name)}function ag(a,b){return Oc(a,b)};function bg(){}var cg={};function Uf(a){return q(a.compare,a)}bg.prototype.nd=function(a,b){return 0!==this.compare(new R("[MIN_NAME]",a),new R("[MIN_NAME]",b))};bg.prototype.Hc=function(){return dg};function eg(a){E(!a.e()&&".priority"!==H(a),"Can't create PathIndex with empty path or .priority key");this.bc=a}la(eg,bg);g=eg.prototype;g.xc=function(a){return!a.P(this.bc).e()};g.compare=function(a,b){var c=a.R.P(this.bc),d=b.R.P(this.bc),c=c.sc(d);return 0===c?Oc(a.name,b.name):c};
g.Ec=function(a,b){var c=M(a),c=J.F(this.bc,c);return new R(b,c)};g.Fc=function(){var a=J.F(this.bc,fg);return new R("[MAX_NAME]",a)};g.toString=function(){return this.bc.slice().join("/")};function gg(){}la(gg,bg);g=gg.prototype;g.compare=function(a,b){var c=a.R.C(),d=b.R.C(),c=c.sc(d);return 0===c?Oc(a.name,b.name):c};g.xc=function(a){return!a.C().e()};g.nd=function(a,b){return!a.C().Z(b.C())};g.Hc=function(){return dg};g.Fc=function(){return new R("[MAX_NAME]",new Ac("[PRIORITY-POST]",fg))};
g.Ec=function(a,b){var c=M(a);return new R(b,new Ac("[PRIORITY-POST]",c))};g.toString=function(){return".priority"};var N=new gg;function hg(){}la(hg,bg);g=hg.prototype;g.compare=function(a,b){return Oc(a.name,b.name)};g.xc=function(){throw Cc("KeyIndex.isDefinedOn not expected to be called.");};g.nd=function(){return!1};g.Hc=function(){return dg};g.Fc=function(){return new R("[MAX_NAME]",J)};g.Ec=function(a){E(p(a),"KeyIndex indexValue must always be a string.");return new R(a,J)};g.toString=function(){return".key"};
var Fd=new hg;function ig(){}la(ig,bg);g=ig.prototype;g.compare=function(a,b){var c=a.R.sc(b.R);return 0===c?Oc(a.name,b.name):c};g.xc=function(){return!0};g.nd=function(a,b){return!a.Z(b)};g.Hc=function(){return dg};g.Fc=function(){return jg};g.Ec=function(a,b){var c=M(a);return new R(b,c)};g.toString=function(){return".value"};var kg=new ig;function lg(){this.Rb=this.na=this.Kb=this.ka=this.xa=!1;this.oa=0;this.mb="";this.dc=null;this.zb="";this.ac=null;this.xb="";this.g=N}var mg=new lg;function Sf(a){return""===a.mb?a.ka:"l"===a.mb}function Kd(a){E(a.ka,"Only valid if start has been set");return a.dc}function Jd(a){E(a.ka,"Only valid if start has been set");return a.Kb?a.zb:"[MIN_NAME]"}function Md(a){E(a.na,"Only valid if end has been set");return a.ac}
function Ld(a){E(a.na,"Only valid if end has been set");return a.Rb?a.xb:"[MAX_NAME]"}function ng(a){var b=new lg;b.xa=a.xa;b.oa=a.oa;b.ka=a.ka;b.dc=a.dc;b.Kb=a.Kb;b.zb=a.zb;b.na=a.na;b.ac=a.ac;b.Rb=a.Rb;b.xb=a.xb;b.g=a.g;b.mb=a.mb;return b}g=lg.prototype;g.ne=function(a){var b=ng(this);b.xa=!0;b.oa=a;b.mb="l";return b};g.oe=function(a){var b=ng(this);b.xa=!0;b.oa=a;b.mb="r";return b};g.Nd=function(a,b){var c=ng(this);c.ka=!0;n(a)||(a=null);c.dc=a;null!=b?(c.Kb=!0,c.zb=b):(c.Kb=!1,c.zb="");return c};
g.gd=function(a,b){var c=ng(this);c.na=!0;n(a)||(a=null);c.ac=a;n(b)?(c.Rb=!0,c.xb=b):(c.vg=!1,c.xb="");return c};function og(a,b){var c=ng(a);c.g=b;return c}function Bf(a){var b={};a.ka&&(b.sp=a.dc,a.Kb&&(b.sn=a.zb));a.na&&(b.ep=a.ac,a.Rb&&(b.en=a.xb));if(a.xa){b.l=a.oa;var c=a.mb;""===c&&(c=Sf(a)?"l":"r");b.vf=c}a.g!==N&&(b.i=a.g.toString());return b}function V(a){return!(a.ka||a.na||a.xa)}function ed(a){return V(a)&&a.g==N}
function fd(a){var b={};if(ed(a))return b;var c;a.g===N?c="$priority":a.g===kg?c="$value":a.g===Fd?c="$key":(E(a.g instanceof eg,"Unrecognized index type!"),c=a.g.toString());b.orderBy=w(c);a.ka&&(b.startAt=w(a.dc),a.Kb&&(b.startAt+=","+w(a.zb)));a.na&&(b.endAt=w(a.ac),a.Rb&&(b.endAt+=","+w(a.xb)));a.xa&&(Sf(a)?b.limitToFirst=a.oa:b.limitToLast=a.oa);return b}g.toString=function(){return w(Bf(this))};function wc(){this.k=this.B=null}wc.prototype.find=function(a){if(null!=this.B)return this.B.P(a);if(a.e()||null==this.k)return null;var b=H(a);a=D(a);return this.k.contains(b)?this.k.get(b).find(a):null};function yc(a,b,c){if(b.e())a.B=c,a.k=null;else if(null!==a.B)a.B=a.B.F(b,c);else{null==a.k&&(a.k=new ee);var d=H(b);a.k.contains(d)||a.k.add(d,new wc);a=a.k.get(d);b=D(b);yc(a,b,c)}}
function pg(a,b){if(b.e())return a.B=null,a.k=null,!0;if(null!==a.B){if(a.B.J())return!1;var c=a.B;a.B=null;c.O(N,function(b,c){yc(a,new L(b),c)});return pg(a,b)}return null!==a.k?(c=H(b),b=D(b),a.k.contains(c)&&pg(a.k.get(c),b)&&a.k.remove(c),a.k.e()?(a.k=null,!0):!1):!0}function xc(a,b,c){null!==a.B?c(b,a.B):a.O(function(a,e){var f=new L(b.toString()+"/"+a);xc(e,f,c)})}wc.prototype.O=function(a){null!==this.k&&fe(this.k,function(b,c){a(b,c)})};function qg(a,b){this.od=a;this.cc=b}qg.prototype.get=function(a){var b=B(this.od,a);if(!b)throw Error("No index defined for "+a);return b===cg?null:b};function rg(a,b,c){var d=ma(a.od,function(d,f){var h=B(a.cc,f);E(h,"Missing index implementation for "+f);if(d===cg){if(h.xc(b.R)){for(var k=[],l=c.Wb(Mf),m=K(l);m;)m.name!=b.name&&k.push(m),m=K(l);k.push(b);return sg(k,Uf(h))}return cg}h=c.get(b.name);k=d;h&&(k=k.remove(new R(b.name,h)));return k.Oa(b,b.R)});return new qg(d,a.cc)}
function tg(a,b,c){var d=ma(a.od,function(a){if(a===cg)return a;var d=c.get(b.name);return d?a.remove(new R(b.name,d)):a});return new qg(d,a.cc)}var ug=new qg({".priority":cg},{".priority":N});function P(a,b,c){this.k=a;(this.aa=b)&&Xf(this.aa);a.e()&&E(!this.aa||this.aa.e(),"An empty node cannot have a priority");this.yb=c;this.Db=null}g=P.prototype;g.J=function(){return!1};g.C=function(){return this.aa||J};g.fa=function(a){return this.k.e()?this:new P(this.k,a,this.yb)};g.Q=function(a){if(".priority"===a)return this.C();a=this.k.get(a);return null===a?J:a};g.P=function(a){var b=H(a);return null===b?this:this.Q(b).P(D(a))};g.Da=function(a){return null!==this.k.get(a)};
g.T=function(a,b){E(b,"We should always be passing snapshot nodes");if(".priority"===a)return this.fa(b);var c=new R(a,b),d,e;b.e()?(d=this.k.remove(a),c=tg(this.yb,c,this.k)):(d=this.k.Oa(a,b),c=rg(this.yb,c,this.k));e=d.e()?J:this.aa;return new P(d,e,c)};g.F=function(a,b){var c=H(a);if(null===c)return b;E(".priority"!==H(a)||1===Ad(a),".priority must be the last token in a path");var d=this.Q(c).F(D(a),b);return this.T(c,d)};g.e=function(){return this.k.e()};g.Eb=function(){return this.k.count()};
var vg=/^(0|[1-9]\d*)$/;g=P.prototype;g.H=function(a){if(this.e())return null;var b={},c=0,d=0,e=!0;this.O(N,function(f,h){b[f]=h.H(a);c++;e&&vg.test(f)?d=Math.max(d,Number(f)):e=!1});if(!a&&e&&d<2*c){var f=[],h;for(h in b)f[h]=b[h];return f}a&&!this.C().e()&&(b[".priority"]=this.C().H());return b};g.hash=function(){if(null===this.Db){var a="";this.C().e()||(a+="priority:"+Zf(this.C().H())+":");this.O(N,function(b,c){var d=c.hash();""!==d&&(a+=":"+b+":"+d)});this.Db=""===a?"":Ec(a)}return this.Db};
g.Ve=function(a,b,c){return(c=wg(this,c))?(a=ic(c,new R(a,b)))?a.name:null:ic(this.k,a)};function Vf(a,b){var c;c=(c=wg(a,b))?(c=c.Gc())&&c.name:a.k.Gc();return c?new R(c,a.k.get(c)):null}function Wf(a,b){var c;c=(c=wg(a,b))?(c=c.ec())&&c.name:a.k.ec();return c?new R(c,a.k.get(c)):null}g.O=function(a,b){var c=wg(this,a);return c?c.ha(function(a){return b(a.name,a.R)}):this.k.ha(b)};g.Wb=function(a){return this.Xb(a.Hc(),a)};
g.Xb=function(a,b){var c=wg(this,b);if(c)return c.Xb(a,function(a){return a});for(var c=this.k.Xb(a.name,Mf),d=kc(c);null!=d&&0>b.compare(d,a);)K(c),d=kc(c);return c};g.We=function(a){return this.Zb(a.Fc(),a)};g.Zb=function(a,b){var c=wg(this,b);if(c)return c.Zb(a,function(a){return a});for(var c=this.k.Zb(a.name,Mf),d=kc(c);null!=d&&0<b.compare(d,a);)K(c),d=kc(c);return c};g.sc=function(a){return this.e()?a.e()?0:-1:a.J()||a.e()?1:a===fg?-1:0};
g.nb=function(a){if(a===Fd||sa(this.yb.cc,a.toString()))return this;var b=this.yb,c=this.k;E(a!==Fd,"KeyIndex always exists and isn't meant to be added to the IndexMap.");for(var d=[],e=!1,c=c.Wb(Mf),f=K(c);f;)e=e||a.xc(f.R),d.push(f),f=K(c);d=e?sg(d,Uf(a)):cg;e=a.toString();c=wa(b.cc);c[e]=a;a=wa(b.od);a[e]=d;return new P(this.k,this.aa,new qg(a,c))};g.yc=function(a){return a===Fd||sa(this.yb.cc,a.toString())};
g.Z=function(a){if(a===this)return!0;if(a.J())return!1;if(this.C().Z(a.C())&&this.k.count()===a.k.count()){var b=this.Wb(N);a=a.Wb(N);for(var c=K(b),d=K(a);c&&d;){if(c.name!==d.name||!c.R.Z(d.R))return!1;c=K(b);d=K(a)}return null===c&&null===d}return!1};function wg(a,b){return b===Fd?null:a.yb.get(b.toString())}g.toString=function(){return w(this.H(!0))};function M(a,b){if(null===a)return J;var c=null;"object"===typeof a&&".priority"in a?c=a[".priority"]:"undefined"!==typeof b&&(c=b);E(null===c||"string"===typeof c||"number"===typeof c||"object"===typeof c&&".sv"in c,"Invalid priority type found: "+typeof c);"object"===typeof a&&".value"in a&&null!==a[".value"]&&(a=a[".value"]);if("object"!==typeof a||".sv"in a)return new Ac(a,M(c));if(a instanceof Array){var d=J,e=a;r(e,function(a,b){if(ib(e,b)&&"."!==b.substring(0,1)){var c=M(a);if(c.J()||!c.e())d=
d.T(b,c)}});return d.fa(M(c))}var f=[],h=!1,k=a;jb(k,function(a){if("string"!==typeof a||"."!==a.substring(0,1)){var b=M(k[a]);b.e()||(h=h||!b.C().e(),f.push(new R(a,b)))}});if(0==f.length)return J;var l=sg(f,$f,function(a){return a.name},ag);if(h){var m=sg(f,Uf(N));return new P(l,M(c),new qg({".priority":m},{".priority":N}))}return new P(l,M(c),ug)}var xg=Math.log(2);
function yg(a){this.count=parseInt(Math.log(a+1)/xg,10);this.Oe=this.count-1;this.Cf=a+1&parseInt(Array(this.count+1).join("1"),2)}function zg(a){var b=!(a.Cf&1<<a.Oe);a.Oe--;return b}
function sg(a,b,c,d){function e(b,d){var f=d-b;if(0==f)return null;if(1==f){var m=a[b],u=c?c(m):m;return new lc(u,m.R,!1,null,null)}var m=parseInt(f/2,10)+b,f=e(b,m),z=e(m+1,d),m=a[m],u=c?c(m):m;return new lc(u,m.R,!1,f,z)}a.sort(b);var f=function(b){function d(b,h){var k=u-b,z=u;u-=b;var z=e(k+1,z),k=a[k],F=c?c(k):k,z=new lc(F,k.R,h,null,z);f?f.left=z:m=z;f=z}for(var f=null,m=null,u=a.length,z=0;z<b.count;++z){var F=zg(b),td=Math.pow(2,b.count-(z+1));F?d(td,!1):(d(td,!1),d(td,!0))}return m}(new yg(a.length));
return null!==f?new gc(d||b,f):new gc(d||b)}function Zf(a){return"number"===typeof a?"number:"+Uc(a):"string:"+a}function Xf(a){if(a.J()){var b=a.H();E("string"===typeof b||"number"===typeof b||"object"===typeof b&&ib(b,".sv"),"Priority must be a string or number.")}else E(a===fg||a.e(),"priority of unexpected type.");E(a===fg||a.C().e(),"Priority nodes can't have a priority of their own.")}var J=new P(new gc(ag),null,ug);function Ag(){P.call(this,new gc(ag),J,ug)}la(Ag,P);g=Ag.prototype;
g.sc=function(a){return a===this?0:1};g.Z=function(a){return a===this};g.C=function(){return this};g.Q=function(){return J};g.e=function(){return!1};var fg=new Ag,dg=new R("[MIN_NAME]",J),jg=new R("[MAX_NAME]",fg);function X(a,b,c){this.A=a;this.V=b;this.g=c}X.prototype.H=function(){x("Firebase.DataSnapshot.val",0,0,arguments.length);return this.A.H()};X.prototype.val=X.prototype.H;X.prototype.be=function(){x("Firebase.DataSnapshot.exportVal",0,0,arguments.length);return this.A.H(!0)};X.prototype.exportVal=X.prototype.be;X.prototype.toJSON=function(){x("Firebase.DataSnapshot.toJSON",0,1,arguments.length);return this.be()};X.prototype.toJSON=X.prototype.toJSON;
X.prototype.Lf=function(){x("Firebase.DataSnapshot.exists",0,0,arguments.length);return!this.A.e()};X.prototype.exists=X.prototype.Lf;X.prototype.n=function(a){x("Firebase.DataSnapshot.child",0,1,arguments.length);ga(a)&&(a=String(a));ze("Firebase.DataSnapshot.child",a);var b=new L(a),c=this.V.n(b);return new X(this.A.P(b),c,N)};X.prototype.child=X.prototype.n;
X.prototype.Da=function(a){x("Firebase.DataSnapshot.hasChild",1,1,arguments.length);ze("Firebase.DataSnapshot.hasChild",a);var b=new L(a);return!this.A.P(b).e()};X.prototype.hasChild=X.prototype.Da;X.prototype.C=function(){x("Firebase.DataSnapshot.getPriority",0,0,arguments.length);return this.A.C().H()};X.prototype.getPriority=X.prototype.C;
X.prototype.forEach=function(a){x("Firebase.DataSnapshot.forEach",1,1,arguments.length);A("Firebase.DataSnapshot.forEach",1,a,!1);if(this.A.J())return!1;var b=this;return!!this.A.O(this.g,function(c,d){return a(new X(d,b.V.n(c),N))})};X.prototype.forEach=X.prototype.forEach;X.prototype.kd=function(){x("Firebase.DataSnapshot.hasChildren",0,0,arguments.length);return this.A.J()?!1:!this.A.e()};X.prototype.hasChildren=X.prototype.kd;
X.prototype.getKey=function(){x("Firebase.DataSnapshot.key",0,0,arguments.length);return this.V.getKey()};Wc(X.prototype,"key",X.prototype.getKey);X.prototype.Eb=function(){x("Firebase.DataSnapshot.numChildren",0,0,arguments.length);return this.A.Eb()};X.prototype.numChildren=X.prototype.Eb;X.prototype.wb=function(){x("Firebase.DataSnapshot.ref",0,0,arguments.length);return this.V};Wc(X.prototype,"ref",X.prototype.wb);function yd(a,b){this.N=a;this.Ld=b}function vd(a,b,c,d){return new yd(new Mb(b,c,d),a.Ld)}function zd(a){return a.N.da?a.N.j():null}yd.prototype.w=function(){return this.Ld};function ec(a){return a.Ld.da?a.Ld.j():null};function Bg(a,b){this.V=a;var c=a.m,d=new Hd(c.g),c=V(c)?new Hd(c.g):c.xa?new Rf(c):new Id(c);this.hf=new nd(c);var e=b.w(),f=b.N,h=d.ya(J,e.j(),null),k=c.ya(J,f.j(),null);this.Ka=new yd(new Mb(k,f.da,c.Na()),new Mb(h,e.da,d.Na()));this.Za=[];this.Jf=new Nf(a)}function Cg(a){return a.V}g=Bg.prototype;g.w=function(){return this.Ka.w().j()};g.hb=function(a){var b=ec(this.Ka);return b&&(V(this.V.m)||!a.e()&&!b.Q(H(a)).e())?b.P(a):null};g.e=function(){return 0===this.Za.length};g.Nb=function(a){this.Za.push(a)};
g.kb=function(a,b){var c=[];if(b){E(null==a,"A cancel should cancel all event registrations.");var d=this.V.path;ya(this.Za,function(a){(a=a.Me(b,d))&&c.push(a)})}if(a){for(var e=[],f=0;f<this.Za.length;++f){var h=this.Za[f];if(!h.matches(a))e.push(h);else if(a.Xe()){e=e.concat(this.Za.slice(f+1));break}}this.Za=e}else this.Za=[];return c};
g.eb=function(a,b,c){a.type===bd&&null!==a.source.Hb&&(E(ec(this.Ka),"We should always have a full cache before handling merges"),E(zd(this.Ka),"Missing event cache, even though we have a server cache"));var d=this.Ka;a=this.hf.eb(d,a,b,c);b=this.hf;c=a.Sd;E(c.N.j().yc(b.U.g),"Event snap not indexed");E(c.w().j().yc(b.U.g),"Server snap not indexed");E(Nb(a.Sd.w())||!Nb(d.w()),"Once a server snap is complete, it should never go back");this.Ka=a.Sd;return Dg(this,a.Df,a.Sd.N.j(),null)};
function Eg(a,b){var c=a.Ka.N,d=[];c.j().J()||c.j().O(N,function(a,b){d.push(new I("child_added",b,a))});c.da&&d.push($b(c.j()));return Dg(a,d,c.j(),b)}function Dg(a,b,c,d){return Of(a.Jf,b,c,d?[d]:a.Za)};function Fg(a,b,c){this.Pb=a;this.rb=b;this.tb=c||null}g=Fg.prototype;g.nf=function(a){return"value"===a};g.createEvent=function(a,b){var c=b.m.g;return new Rb("value",this,new X(a.Ja,b.wb(),c))};g.Tb=function(a){var b=this.tb;if("cancel"===a.ge()){E(this.rb,"Raising a cancel event on a listener with no cancel callback");var c=this.rb;return function(){c.call(b,a.error)}}var d=this.Pb;return function(){d.call(b,a.Md)}};g.Me=function(a,b){return this.rb?new Sb(this,a,b):null};
g.matches=function(a){return a instanceof Fg?a.Pb&&this.Pb?a.Pb===this.Pb&&a.tb===this.tb:!0:!1};g.Xe=function(){return null!==this.Pb};function Gg(a,b,c){this.ga=a;this.rb=b;this.tb=c}g=Gg.prototype;g.nf=function(a){a="children_added"===a?"child_added":a;return("children_removed"===a?"child_removed":a)in this.ga};g.Me=function(a,b){return this.rb?new Sb(this,a,b):null};
g.createEvent=function(a,b){E(null!=a.Xa,"Child events should have a childName.");var c=b.wb().n(a.Xa);return new Rb(a.type,this,new X(a.Ja,c,b.m.g),a.Dd)};g.Tb=function(a){var b=this.tb;if("cancel"===a.ge()){E(this.rb,"Raising a cancel event on a listener with no cancel callback");var c=this.rb;return function(){c.call(b,a.error)}}var d=this.ga[a.hd];return function(){d.call(b,a.Md,a.Dd)}};
g.matches=function(a){if(a instanceof Gg){if(!this.ga||!a.ga)return!0;if(this.tb===a.tb){var b=oa(a.ga);if(b===oa(this.ga)){if(1===b){var b=pa(a.ga),c=pa(this.ga);return c===b&&(!a.ga[b]||!this.ga[c]||a.ga[b]===this.ga[c])}return na(this.ga,function(b,c){return a.ga[c]===b})}}}return!1};g.Xe=function(){return null!==this.ga};function Y(a,b,c,d){this.u=a;this.path=b;this.m=c;this.Nc=d}
function Hg(a){var b=null,c=null;a.ka&&(b=Kd(a));a.na&&(c=Md(a));if(a.g===Fd){if(a.ka){if("[MIN_NAME]"!=Jd(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==typeof b)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}if(a.na){if("[MAX_NAME]"!=Ld(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==
typeof c)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}}else if(a.g===N){if(null!=b&&!re(b)||null!=c&&!re(c))throw Error("Query: When ordering by priority, the first argument passed to startAt(), endAt(), or equalTo() must be a valid priority value (null, a number, or a string).");}else if(E(a.g instanceof eg||a.g===kg,"unknown index type."),null!=b&&"object"===typeof b||null!=c&&"object"===typeof c)throw Error("Query: First argument passed to startAt(), endAt(), or equalTo() cannot be an object.");
}function Ig(a){if(a.ka&&a.na&&a.xa&&(!a.xa||""===a.mb))throw Error("Query: Can't combine startAt(), endAt(), and limit(). Use limitToFirst() or limitToLast() instead.");}function Jg(a,b){if(!0===a.Nc)throw Error(b+": You can't combine multiple orderBy calls.");}g=Y.prototype;g.wb=function(){x("Query.ref",0,0,arguments.length);return new T(this.u,this.path)};
g.gc=function(a,b,c,d){x("Query.on",2,4,arguments.length);xe("Query.on",a,!1);A("Query.on",2,b,!1);var e=Kg("Query.on",c,d);if("value"===a)Lg(this.u,this,new Fg(b,e.cancel||null,e.Ma||null));else{var f={};f[a]=b;Lg(this.u,this,new Gg(f,e.cancel,e.Ma))}return b};
g.Ic=function(a,b,c){x("Query.off",0,3,arguments.length);xe("Query.off",a,!0);A("Query.off",2,b,!0);hb("Query.off",3,c);var d=null,e=null;"value"===a?d=new Fg(b||null,null,c||null):a&&(b&&(e={},e[a]=b),d=new Gg(e,null,c||null));e=this.u;d=".info"===H(this.path)?e.pd.kb(this,d):e.K.kb(this,d);Wb(e.ca,this.path,d)};
g.$f=function(a,b){function c(k){f&&(f=!1,e.Ic(a,c),b&&b.call(d.Ma,k),h.resolve(k))}x("Query.once",1,4,arguments.length);xe("Query.once",a,!1);A("Query.once",2,b,!0);var d=Kg("Query.once",arguments[2],arguments[3]),e=this,f=!0,h=new db;fb(h.ra);this.gc(a,c,function(b){e.Ic(a,c);d.cancel&&d.cancel.call(d.Ma,b);h.reject(b)});return h.ra};
g.ne=function(a){x("Query.limitToFirst",1,1,arguments.length);if(!ga(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToFirst: First argument must be a positive integer.");if(this.m.xa)throw Error("Query.limitToFirst: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new Y(this.u,this.path,this.m.ne(a),this.Nc)};
g.oe=function(a){x("Query.limitToLast",1,1,arguments.length);if(!ga(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToLast: First argument must be a positive integer.");if(this.m.xa)throw Error("Query.limitToLast: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new Y(this.u,this.path,this.m.oe(a),this.Nc)};
g.ag=function(a){x("Query.orderByChild",1,1,arguments.length);if("$key"===a)throw Error('Query.orderByChild: "$key" is invalid.  Use Query.orderByKey() instead.');if("$priority"===a)throw Error('Query.orderByChild: "$priority" is invalid.  Use Query.orderByPriority() instead.');if("$value"===a)throw Error('Query.orderByChild: "$value" is invalid.  Use Query.orderByValue() instead.');ze("Query.orderByChild",a);Jg(this,"Query.orderByChild");var b=new L(a);if(b.e())throw Error("Query.orderByChild: cannot pass in empty path.  Use Query.orderByValue() instead.");
b=new eg(b);b=og(this.m,b);Hg(b);return new Y(this.u,this.path,b,!0)};g.bg=function(){x("Query.orderByKey",0,0,arguments.length);Jg(this,"Query.orderByKey");var a=og(this.m,Fd);Hg(a);return new Y(this.u,this.path,a,!0)};g.cg=function(){x("Query.orderByPriority",0,0,arguments.length);Jg(this,"Query.orderByPriority");var a=og(this.m,N);Hg(a);return new Y(this.u,this.path,a,!0)};
g.dg=function(){x("Query.orderByValue",0,0,arguments.length);Jg(this,"Query.orderByValue");var a=og(this.m,kg);Hg(a);return new Y(this.u,this.path,a,!0)};g.Nd=function(a,b){x("Query.startAt",0,2,arguments.length);se("Query.startAt",a,this.path,!0);ye("Query.startAt",b);var c=this.m.Nd(a,b);Ig(c);Hg(c);if(this.m.ka)throw Error("Query.startAt: Starting point was already set (by another call to startAt or equalTo).");n(a)||(b=a=null);return new Y(this.u,this.path,c,this.Nc)};
g.gd=function(a,b){x("Query.endAt",0,2,arguments.length);se("Query.endAt",a,this.path,!0);ye("Query.endAt",b);var c=this.m.gd(a,b);Ig(c);Hg(c);if(this.m.na)throw Error("Query.endAt: Ending point was already set (by another call to endAt or equalTo).");return new Y(this.u,this.path,c,this.Nc)};
g.If=function(a,b){x("Query.equalTo",1,2,arguments.length);se("Query.equalTo",a,this.path,!1);ye("Query.equalTo",b);if(this.m.ka)throw Error("Query.equalTo: Starting point was already set (by another call to endAt or equalTo).");if(this.m.na)throw Error("Query.equalTo: Ending point was already set (by another call to endAt or equalTo).");return this.Nd(a,b).gd(a,b)};
g.toString=function(){x("Query.toString",0,0,arguments.length);for(var a=this.path,b="",c=a.Y;c<a.o.length;c++)""!==a.o[c]&&(b+="/"+encodeURIComponent(String(a.o[c])));return this.u.toString()+(b||"/")};g.toJSON=function(){x("Query.toJSON",0,1,arguments.length);return this.toString()};g.ja=function(){var a=Rc(Bf(this.m));return"{}"===a?"default":a};
g.isEqual=function(a){x("Query.isEqual",1,1,arguments.length);if(!(a instanceof Y))throw Error("Query.isEqual failed: First argument must be an instance of firebase.database.Query.");var b=this.u===a.u,c=this.path.Z(a.path),d=this.ja()===a.ja();return b&&c&&d};
function Kg(a,b,c){var d={cancel:null,Ma:null};if(b&&c)d.cancel=b,A(a,3,d.cancel,!0),d.Ma=c,hb(a,4,d.Ma);else if(b)if("object"===typeof b&&null!==b)d.Ma=b;else if("function"===typeof b)d.cancel=b;else throw Error(y(a,3,!0)+" must either be a cancel callback or a context object.");return d}Y.prototype.on=Y.prototype.gc;Y.prototype.off=Y.prototype.Ic;Y.prototype.once=Y.prototype.$f;Y.prototype.limitToFirst=Y.prototype.ne;Y.prototype.limitToLast=Y.prototype.oe;Y.prototype.orderByChild=Y.prototype.ag;
Y.prototype.orderByKey=Y.prototype.bg;Y.prototype.orderByPriority=Y.prototype.cg;Y.prototype.orderByValue=Y.prototype.dg;Y.prototype.startAt=Y.prototype.Nd;Y.prototype.endAt=Y.prototype.gd;Y.prototype.equalTo=Y.prototype.If;Y.prototype.toString=Y.prototype.toString;Y.prototype.isEqual=Y.prototype.isEqual;Wc(Y.prototype,"ref",Y.prototype.wb);function Mg(){this.za={}}g=Mg.prototype;g.e=function(){return va(this.za)};g.eb=function(a,b,c){var d=a.source.Hb;if(null!==d)return d=B(this.za,d),E(null!=d,"SyncTree gave us an op for an invalid query."),d.eb(a,b,c);var e=[];r(this.za,function(d){e=e.concat(d.eb(a,b,c))});return e};g.Nb=function(a,b,c,d,e){var f=a.ja(),h=B(this.za,f);if(!h){var h=c.Aa(e?d:null),k=!1;h?k=!0:(h=d instanceof P?c.rc(d):J,k=!1);h=new Bg(a,new yd(new Mb(h,k,!1),new Mb(d,e,!1)));this.za[f]=h}h.Nb(b);return Eg(h,b)};
g.kb=function(a,b,c){var d=a.ja(),e=[],f=[],h=null!=Ng(this);if("default"===d){var k=this;r(this.za,function(a,d){f=f.concat(a.kb(b,c));a.e()&&(delete k.za[d],V(a.V.m)||e.push(a.V))})}else{var l=B(this.za,d);l&&(f=f.concat(l.kb(b,c)),l.e()&&(delete this.za[d],V(l.V.m)||e.push(l.V)))}h&&null==Ng(this)&&e.push(new T(a.u,a.path));return{hg:e,Kf:f}};function Og(a){return za(qa(a.za),function(a){return!V(a.V.m)})}g.hb=function(a){var b=null;r(this.za,function(c){b=b||c.hb(a)});return b};
function Pg(a,b){if(V(b.m))return Ng(a);var c=b.ja();return B(a.za,c)}function Ng(a){return ua(a.za,function(a){return V(a.V.m)})||null};function Qg(a){this.W=a}var Rg=new Qg(new Je(null));function Sg(a,b,c){if(b.e())return new Qg(new Je(c));var d=Ne(a.W,b);if(null!=d){var e=d.path,d=d.value;b=S(e,b);d=d.F(b,c);return new Qg(a.W.set(e,d))}a=Ed(a.W,b,new Je(c));return new Qg(a)}function Tg(a,b,c){var d=a;jb(c,function(a,c){d=Sg(d,b.n(a),c)});return d}Qg.prototype.Ed=function(a){if(a.e())return Rg;a=Ed(this.W,a,Q);return new Qg(a)};function Ug(a,b){var c=Ne(a.W,b);return null!=c?a.W.get(c.path).P(S(c.path,b)):null}
function Vg(a){var b=[],c=a.W.value;null!=c?c.J()||c.O(N,function(a,c){b.push(new R(a,c))}):a.W.children.ha(function(a,c){null!=c.value&&b.push(new R(a,c.value))});return b}function Wg(a,b){if(b.e())return a;var c=Ug(a,b);return null!=c?new Qg(new Je(c)):new Qg(a.W.subtree(b))}Qg.prototype.e=function(){return this.W.e()};Qg.prototype.apply=function(a){return Xg(C,this.W,a)};
function Xg(a,b,c){if(null!=b.value)return c.F(a,b.value);var d=null;b.children.ha(function(b,f){".priority"===b?(E(null!==f.value,"Priority writes must always be leaf nodes"),d=f.value):c=Xg(a.n(b),f,c)});c.P(a).e()||null===d||(c=c.F(a.n(".priority"),d));return c};function Yg(){this.S=Rg;this.la=[];this.Bc=-1}function Zg(a,b){for(var c=0;c<a.la.length;c++){var d=a.la[c];if(d.Zc===b)return d}return null}g=Yg.prototype;
g.Ed=function(a){var b=Ea(this.la,function(b){return b.Zc===a});E(0<=b,"removeWrite called with nonexistent writeId.");var c=this.la[b];this.la.splice(b,1);for(var d=c.visible,e=!1,f=this.la.length-1;d&&0<=f;){var h=this.la[f];h.visible&&(f>=b&&$g(h,c.path)?d=!1:c.path.contains(h.path)&&(e=!0));f--}if(d){if(e)this.S=ah(this.la,bh,C),this.Bc=0<this.la.length?this.la[this.la.length-1].Zc:-1;else if(c.Ga)this.S=this.S.Ed(c.path);else{var k=this;r(c.children,function(a,b){k.S=k.S.Ed(c.path.n(b))})}return!0}return!1};
g.Aa=function(a,b,c,d){if(c||d){var e=Wg(this.S,a);return!d&&e.e()?b:d||null!=b||null!=Ug(e,C)?(e=ah(this.la,function(b){return(b.visible||d)&&(!c||!(0<=xa(c,b.Zc)))&&(b.path.contains(a)||a.contains(b.path))},a),b=b||J,e.apply(b)):null}e=Ug(this.S,a);if(null!=e)return e;e=Wg(this.S,a);return e.e()?b:null!=b||null!=Ug(e,C)?(b=b||J,e.apply(b)):null};
g.rc=function(a,b){var c=J,d=Ug(this.S,a);if(d)d.J()||d.O(N,function(a,b){c=c.T(a,b)});else if(b){var e=Wg(this.S,a);b.O(N,function(a,b){var d=Wg(e,new L(a)).apply(b);c=c.T(a,d)});ya(Vg(e),function(a){c=c.T(a.name,a.R)})}else e=Wg(this.S,a),ya(Vg(e),function(a){c=c.T(a.name,a.R)});return c};g.ad=function(a,b,c,d){E(c||d,"Either existingEventSnap or existingServerSnap must exist");a=a.n(b);if(null!=Ug(this.S,a))return null;a=Wg(this.S,a);return a.e()?d.P(b):a.apply(d.P(b))};
g.qc=function(a,b,c){a=a.n(b);var d=Ug(this.S,a);return null!=d?d:Qb(c,b)?Wg(this.S,a).apply(c.j().Q(b)):null};g.lc=function(a){return Ug(this.S,a)};g.Xd=function(a,b,c,d,e,f){var h;a=Wg(this.S,a);h=Ug(a,C);if(null==h)if(null!=b)h=a.apply(b);else return[];h=h.nb(f);if(h.e()||h.J())return[];b=[];a=Uf(f);e=e?h.Zb(c,f):h.Xb(c,f);for(f=K(e);f&&b.length<d;)0!==a(f,c)&&b.push(f),f=K(e);return b};
function $g(a,b){return a.Ga?a.path.contains(b):!!ta(a.children,function(c,d){return a.path.n(d).contains(b)})}function bh(a){return a.visible}
function ah(a,b,c){for(var d=Rg,e=0;e<a.length;++e){var f=a[e];if(b(f)){var h=f.path;if(f.Ga)c.contains(h)?(h=S(c,h),d=Sg(d,h,f.Ga)):h.contains(c)&&(h=S(h,c),d=Sg(d,C,f.Ga.P(h)));else if(f.children)if(c.contains(h))h=S(c,h),d=Tg(d,h,f.children);else{if(h.contains(c))if(h=S(h,c),h.e())d=Tg(d,C,f.children);else if(f=B(f.children,H(h)))f=f.P(D(h)),d=Sg(d,C,f)}else throw Cc("WriteRecord should have .snap or .children");}}return d}function ch(a,b){this.Lb=a;this.W=b}g=ch.prototype;
g.Aa=function(a,b,c){return this.W.Aa(this.Lb,a,b,c)};g.rc=function(a){return this.W.rc(this.Lb,a)};g.ad=function(a,b,c){return this.W.ad(this.Lb,a,b,c)};g.lc=function(a){return this.W.lc(this.Lb.n(a))};g.Xd=function(a,b,c,d,e){return this.W.Xd(this.Lb,a,b,c,d,e)};g.qc=function(a,b){return this.W.qc(this.Lb,a,b)};g.n=function(a){return new ch(this.Lb.n(a),this.W)};function dh(a){this.wa=Q;this.jb=new Yg;this.De={};this.ic={};this.Cc=a}function eh(a,b,c,d,e){var f=a.jb,h=e;E(d>f.Bc,"Stacking an older write on top of newer ones");n(h)||(h=!0);f.la.push({path:b,Ga:c,Zc:d,visible:h});h&&(f.S=Sg(f.S,b,c));f.Bc=d;return e?fh(a,new vb(Xe,b,c)):[]}function gh(a,b,c,d){var e=a.jb;E(d>e.Bc,"Stacking an older merge on top of newer ones");e.la.push({path:b,children:c,Zc:d,visible:!0});e.S=Tg(e.S,b,c);e.Bc=d;c=Le(c);return fh(a,new ad(Xe,b,c))}
function hh(a,b,c){c=c||!1;var d=Zg(a.jb,b);if(a.jb.Ed(b)){var e=Q;null!=d.Ga?e=e.set(C,!0):jb(d.children,function(a,b){e=e.set(new L(a),b)});return fh(a,new We(d.path,e,c))}return[]}function ih(a,b,c){c=Le(c);return fh(a,new ad(Ze,b,c))}function jh(a,b,c,d){d=kh(a,d);if(null!=d){var e=lh(d);d=e.path;e=e.Hb;b=S(d,b);c=new vb(new Ye(!1,!0,e,!0),b,c);return mh(a,d,c)}return[]}
function nh(a,b,c,d){if(d=kh(a,d)){var e=lh(d);d=e.path;e=e.Hb;b=S(d,b);c=Le(c);c=new ad(new Ye(!1,!0,e,!0),b,c);return mh(a,d,c)}return[]}
dh.prototype.Nb=function(a,b){var c=a.path,d=null,e=!1;Se(this.wa,c,function(a,b){var f=S(a,c);d=d||b.hb(f);e=e||null!=Ng(b)});var f=this.wa.get(c);f?(e=e||null!=Ng(f),d=d||f.hb(C)):(f=new Mg,this.wa=this.wa.set(c,f));var h;null!=d?h=!0:(h=!1,d=J,Ve(this.wa.subtree(c),function(a,b){var c=b.hb(C);c&&(d=d.T(a,c))}));var k=null!=Pg(f,a);if(!k&&!V(a.m)){var l=oh(a);E(!(l in this.ic),"View does not exist, but we have a tag");var m=ph++;this.ic[l]=m;this.De["_"+m]=l}h=f.Nb(a,b,new ch(c,this.jb),d,h);k||
e||(f=Pg(f,a),h=h.concat(qh(this,a,f)));return h};
dh.prototype.kb=function(a,b,c){var d=a.path,e=this.wa.get(d),f=[];if(e&&("default"===a.ja()||null!=Pg(e,a))){f=e.kb(a,b,c);e.e()&&(this.wa=this.wa.remove(d));e=f.hg;f=f.Kf;b=-1!==Ea(e,function(a){return V(a.m)});var h=Qe(this.wa,d,function(a,b){return null!=Ng(b)});if(b&&!h&&(d=this.wa.subtree(d),!d.e()))for(var d=rh(d),k=0;k<d.length;++k){var l=d[k],m=l.V,l=sh(this,l);this.Cc.Ae(th(m),uh(this,m),l.ld,l.G)}if(!h&&0<e.length&&!c)if(b)this.Cc.Od(th(a),null);else{var u=this;ya(e,function(a){a.ja();
var b=u.ic[oh(a)];u.Cc.Od(th(a),b)})}vh(this,e)}return f};dh.prototype.Aa=function(a,b){var c=this.jb,d=Qe(this.wa,a,function(b,c){var d=S(b,a);if(d=c.hb(d))return d});return c.Aa(a,d,b,!0)};function rh(a){return Oe(a,function(a,c,d){if(c&&null!=Ng(c))return[Ng(c)];var e=[];c&&(e=Og(c));r(d,function(a){e=e.concat(a)});return e})}function vh(a,b){for(var c=0;c<b.length;++c){var d=b[c];if(!V(d.m)){var d=oh(d),e=a.ic[d];delete a.ic[d];delete a.De["_"+e]}}}
function th(a){return V(a.m)&&!ed(a.m)?a.wb():a}function qh(a,b,c){var d=b.path,e=uh(a,b);c=sh(a,c);b=a.Cc.Ae(th(b),e,c.ld,c.G);d=a.wa.subtree(d);if(e)E(null==Ng(d.value),"If we're adding a query, it shouldn't be shadowed");else for(e=Oe(d,function(a,b,c){if(!a.e()&&b&&null!=Ng(b))return[Cg(Ng(b))];var d=[];b&&(d=d.concat(Aa(Og(b),function(a){return a.V})));r(c,function(a){d=d.concat(a)});return d}),d=0;d<e.length;++d)c=e[d],a.Cc.Od(th(c),uh(a,c));return b}
function sh(a,b){var c=b.V,d=uh(a,c);return{ld:function(){return(b.w()||J).hash()},G:function(b){if("ok"===b){if(d){var f=c.path;if(b=kh(a,d)){var h=lh(b);b=h.path;h=h.Hb;f=S(b,f);f=new xb(new Ye(!1,!0,h,!0),f);b=mh(a,b,f)}else b=[]}else b=fh(a,new xb(Ze,c.path));return b}f="Unknown Error";"too_big"===b?f="The data requested exceeds the maximum size that can be accessed with a single request.":"permission_denied"==b?f="Client doesn't have permission to access the desired data.":"unavailable"==b&&
(f="The service is unavailable");f=Error(b+" at "+c.path.toString()+": "+f);f.code=b.toUpperCase();return a.kb(c,null,f)}}}function oh(a){return a.path.toString()+"$"+a.ja()}function lh(a){var b=a.indexOf("$");E(-1!==b&&b<a.length-1,"Bad queryKey.");return{Hb:a.substr(b+1),path:new L(a.substr(0,b))}}function kh(a,b){var c=a.De,d="_"+b;return d in c?c[d]:void 0}function uh(a,b){var c=oh(b);return B(a.ic,c)}var ph=1;
function mh(a,b,c){var d=a.wa.get(b);E(d,"Missing sync point for query tag that we're tracking");return d.eb(c,new ch(b,a.jb),null)}function fh(a,b){return wh(a,b,a.wa,null,new ch(C,a.jb))}function wh(a,b,c,d,e){if(b.path.e())return xh(a,b,c,d,e);var f=c.get(C);null==d&&null!=f&&(d=f.hb(C));var h=[],k=H(b.path),l=b.Mc(k);if((c=c.children.get(k))&&l)var m=d?d.Q(k):null,k=e.n(k),h=h.concat(wh(a,l,c,m,k));f&&(h=h.concat(f.eb(b,e,d)));return h}
function xh(a,b,c,d,e){var f=c.get(C);null==d&&null!=f&&(d=f.hb(C));var h=[];c.children.ha(function(c,f){var m=d?d.Q(c):null,u=e.n(c),z=b.Mc(c);z&&(h=h.concat(xh(a,z,f,m,u)))});f&&(h=h.concat(f.eb(b,e,d)));return h};function Sd(a,b,c){this.app=c;var d=new Kb(c);this.L=a;this.Va=kd(a);this.Vc=null;this.ca=new Tb;this.vd=1;this.Ra=null;if(b||0<=("object"===typeof window&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i))this.va=new cd(this.L,q(this.Gb,this),d),setTimeout(q(this.Jc,this,!0),0);else{b=c.options.databaseAuthVariableOverride;if("undefined"!==da(b)&&null!==b){if("object"!==da(b))throw Error("Only objects are supported for option databaseAuthVariableOverride");
try{w(b)}catch(e){throw Error("Invalid authOverride provided: "+e);}}this.va=this.Ra=new wf(this.L,q(this.Gb,this),q(this.Jc,this),q(this.ue,this),d,b)}var f=this;Lb(d,function(a){f.va.kf(a)});this.og=ld(a,q(function(){return new hd(this.Va,this.va)},this));this.mc=new Zd;this.ie=new fc;this.pd=new dh({Ae:function(a,b,c,d){b=[];c=f.ie.j(a.path);c.e()||(b=fh(f.pd,new vb(Ze,a.path,c)),setTimeout(function(){d("ok")},0));return b},Od:ba});yh(this,"connected",!1);this.ia=new wc;this.Ya=new Rd(this);this.fd=
0;this.je=null;this.K=new dh({Ae:function(a,b,c,d){f.va.$e(a,c,b,function(b,c){var e=d(b,c);Yb(f.ca,a.path,e)});return[]},Od:function(a,b){f.va.uf(a,b)}})}g=Sd.prototype;g.toString=function(){return(this.L.Sc?"https://":"http://")+this.L.host};g.name=function(){return this.L.pe};function zh(a){a=a.ie.j(new L(".info/serverTimeOffset")).H()||0;return(new Date).getTime()+a}function Ah(a){a=a={timestamp:zh(a)};a.timestamp=a.timestamp||(new Date).getTime();return a}
g.Gb=function(a,b,c,d){this.fd++;var e=new L(a);b=this.je?this.je(a,b):b;a=[];d?c?(b=ma(b,function(a){return M(a)}),a=nh(this.K,e,b,d)):(b=M(b),a=jh(this.K,e,b,d)):c?(d=ma(b,function(a){return M(a)}),a=ih(this.K,e,d)):(d=M(b),a=fh(this.K,new vb(Ze,e,d)));d=e;0<a.length&&(d=Bh(this,e));Yb(this.ca,d,a)};g.Jc=function(a){yh(this,"connected",a);!1===a&&Ch(this)};g.ue=function(a){var b=this;Tc(a,function(a,d){yh(b,d,a)})};
function yh(a,b,c){b=new L("/.info/"+b);c=M(c);var d=a.ie;d.Jd=d.Jd.F(b,c);c=fh(a.pd,new vb(Ze,b,c));Yb(a.ca,b,c)}g.Jb=function(a,b,c,d){this.f("set",{path:a.toString(),value:b,ug:c});var e=Ah(this);b=M(b,c);var e=zc(b,e),f=this.vd++,e=eh(this.K,a,e,f,!0);Ub(this.ca,e);var h=this;this.va.put(a.toString(),b.H(!0),function(b,c){var e="ok"===b;e||O("set at "+a+" failed: "+b);e=hh(h.K,f,!e);Yb(h.ca,a,e);Dh(d,b,c)});e=Eh(this,a);Bh(this,e);Yb(this.ca,e,[])};
g.update=function(a,b,c){this.f("update",{path:a.toString(),value:b});var d=!0,e=Ah(this),f={};r(b,function(a,b){d=!1;var c=M(a);f[b]=zc(c,e)});if(d)G("update() called with empty data.  Don't do anything."),Dh(c,"ok");else{var h=this.vd++,k=gh(this.K,a,f,h);Ub(this.ca,k);var l=this;this.va.af(a.toString(),b,function(b,d){var e="ok"===b;e||O("update at "+a+" failed: "+b);var e=hh(l.K,h,!e),f=a;0<e.length&&(f=Bh(l,a));Yb(l.ca,f,e);Dh(c,b,d)});r(b,function(b,c){var d=Eh(l,a.n(c));Bh(l,d)});Yb(this.ca,
a,[])}};function Ch(a){a.f("onDisconnectEvents");var b=Ah(a),c=[];xc(vc(a.ia,b),C,function(b,e){c=c.concat(fh(a.K,new vb(Ze,b,e)));var f=Eh(a,b);Bh(a,f)});a.ia=new wc;Yb(a.ca,C,c)}g.xd=function(a,b){var c=this;this.va.xd(a.toString(),function(d,e){"ok"===d&&pg(c.ia,a);Dh(b,d,e)})};function Be(a,b,c,d){var e=M(c);a.va.re(b.toString(),e.H(!0),function(c,h){"ok"===c&&yc(a.ia,b,e);Dh(d,c,h)})}
function Ce(a,b,c,d,e){var f=M(c,d);a.va.re(b.toString(),f.H(!0),function(c,d){"ok"===c&&yc(a.ia,b,f);Dh(e,c,d)})}function De(a,b,c,d){var e=!0,f;for(f in c)e=!1;e?(G("onDisconnect().update() called with empty data.  Don't do anything."),Dh(d,"ok")):a.va.cf(b.toString(),c,function(e,f){if("ok"===e)for(var l in c){var m=M(c[l]);yc(a.ia,b.n(l),m)}Dh(d,e,f)})}function Lg(a,b,c){c=".info"===H(b.path)?a.pd.Nb(b,c):a.K.Nb(b,c);Wb(a.ca,b.path,c)}g.ab=function(){this.Ra&&this.Ra.ab("repo_interrupt")};
g.kc=function(){this.Ra&&this.Ra.kc("repo_interrupt")};g.Be=function(a){if("undefined"!==typeof console){a?(this.Vc||(this.Vc=new Bb(this.Va)),a=this.Vc.get()):a=this.Va.get();var b=Ba(ra(a),function(a,b){return Math.max(b.length,a)},0),c;for(c in a){for(var d=a[c],e=c.length;e<b+2;e++)c+=" ";console.log(c+d)}}};g.Ce=function(a){Ab(this.Va,a);this.og.rf[a]=!0};g.f=function(a){var b="";this.Ra&&(b=this.Ra.id+":");G(b,arguments)};
function Dh(a,b,c){a&&sb(function(){if("ok"==b)a(null);else{var d=(b||"error").toUpperCase(),e=d;c&&(e+=": "+c);e=Error(e);e.code=d;a(e)}})};function Fh(a,b,c,d,e){function f(){}a.f("transaction on "+b);var h=new T(a,b);h.gc("value",f);c={path:b,update:c,G:d,status:null,ef:Bc(),He:e,of:0,Rd:function(){h.Ic("value",f)},Td:null,Ba:null,cd:null,dd:null,ed:null};d=a.K.Aa(b,void 0)||J;c.cd=d;d=c.update(d.H());if(n(d)){te("transaction failed: Data returned ",d,c.path);c.status=1;e=$d(a.mc,b);var k=e.Ca()||[];k.push(c);ae(e,k);"object"===typeof d&&null!==d&&ib(d,".priority")?(k=B(d,".priority"),E(re(k),"Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")):
k=(a.K.Aa(b)||J).C().H();e=Ah(a);d=M(d,k);e=zc(d,e);c.dd=d;c.ed=e;c.Ba=a.vd++;c=eh(a.K,b,e,c.Ba,c.He);Yb(a.ca,b,c);Gh(a)}else c.Rd(),c.dd=null,c.ed=null,c.G&&(a=new X(c.cd,new T(a,c.path),N),c.G(null,!1,a))}function Gh(a,b){var c=b||a.mc;b||Hh(a,c);if(null!==c.Ca()){var d=Ih(a,c);E(0<d.length,"Sending zero length transaction queue");Ca(d,function(a){return 1===a.status})&&Jh(a,c.path(),d)}else c.kd()&&c.O(function(b){Gh(a,b)})}
function Jh(a,b,c){for(var d=Aa(c,function(a){return a.Ba}),e=a.K.Aa(b,d)||J,d=e,e=e.hash(),f=0;f<c.length;f++){var h=c[f];E(1===h.status,"tryToSendTransactionQueue_: items in queue should all be run.");h.status=2;h.of++;var k=S(b,h.path),d=d.F(k,h.dd)}d=d.H(!0);a.va.put(b.toString(),d,function(d){a.f("transaction put response",{path:b.toString(),status:d});var e=[];if("ok"===d){d=[];for(f=0;f<c.length;f++){c[f].status=3;e=e.concat(hh(a.K,c[f].Ba));if(c[f].G){var h=c[f].ed,k=new T(a,c[f].path);d.push(q(c[f].G,
null,null,!0,new X(h,k,N)))}c[f].Rd()}Hh(a,$d(a.mc,b));Gh(a);Yb(a.ca,b,e);for(f=0;f<d.length;f++)sb(d[f])}else{if("datastale"===d)for(f=0;f<c.length;f++)c[f].status=4===c[f].status?5:1;else for(O("transaction at "+b.toString()+" failed: "+d),f=0;f<c.length;f++)c[f].status=5,c[f].Td=d;Bh(a,b)}},e)}function Bh(a,b){var c=Kh(a,b),d=c.path(),c=Ih(a,c);Lh(a,c,d);return d}
function Lh(a,b,c){if(0!==b.length){for(var d=[],e=[],f=za(b,function(a){return 1===a.status}),f=Aa(f,function(a){return a.Ba}),h=0;h<b.length;h++){var k=b[h],l=S(c,k.path),m=!1,u;E(null!==l,"rerunTransactionsUnderNode_: relativePath should not be null.");if(5===k.status)m=!0,u=k.Td,e=e.concat(hh(a.K,k.Ba,!0));else if(1===k.status)if(25<=k.of)m=!0,u="maxretry",e=e.concat(hh(a.K,k.Ba,!0));else{var z=a.K.Aa(k.path,f)||J;k.cd=z;var F=b[h].update(z.H());n(F)?(te("transaction failed: Data returned ",F,
k.path),l=M(F),"object"===typeof F&&null!=F&&ib(F,".priority")||(l=l.fa(z.C())),z=k.Ba,F=Ah(a),F=zc(l,F),k.dd=l,k.ed=F,k.Ba=a.vd++,Fa(f,z),e=e.concat(eh(a.K,k.path,F,k.Ba,k.He)),e=e.concat(hh(a.K,z,!0))):(m=!0,u="nodata",e=e.concat(hh(a.K,k.Ba,!0)))}Yb(a.ca,c,e);e=[];m&&(b[h].status=3,setTimeout(b[h].Rd,Math.floor(0)),b[h].G&&("nodata"===u?(k=new T(a,b[h].path),d.push(q(b[h].G,null,null,!1,new X(b[h].cd,k,N)))):d.push(q(b[h].G,null,Error(u),!1,null))))}Hh(a,a.mc);for(h=0;h<d.length;h++)sb(d[h]);Gh(a)}}
function Kh(a,b){for(var c,d=a.mc;null!==(c=H(b))&&null===d.Ca();)d=$d(d,c),b=D(b);return d}function Ih(a,b){var c=[];Mh(a,b,c);c.sort(function(a,b){return a.ef-b.ef});return c}function Mh(a,b,c){var d=b.Ca();if(null!==d)for(var e=0;e<d.length;e++)c.push(d[e]);b.O(function(b){Mh(a,b,c)})}function Hh(a,b){var c=b.Ca();if(c){for(var d=0,e=0;e<c.length;e++)3!==c[e].status&&(c[d]=c[e],d++);c.length=d;ae(b,0<c.length?c:null)}b.O(function(b){Hh(a,b)})}
function Eh(a,b){var c=Kh(a,b).path(),d=$d(a.mc,b);de(d,function(b){Nh(a,b)});Nh(a,d);ce(d,function(b){Nh(a,b)});return c}
function Nh(a,b){var c=b.Ca();if(null!==c){for(var d=[],e=[],f=-1,h=0;h<c.length;h++)4!==c[h].status&&(2===c[h].status?(E(f===h-1,"All SENT items should be at beginning of queue."),f=h,c[h].status=4,c[h].Td="set"):(E(1===c[h].status,"Unexpected transaction status in abort"),c[h].Rd(),e=e.concat(hh(a.K,c[h].Ba,!0)),c[h].G&&d.push(q(c[h].G,null,Error("set"),!1,null))));-1===f?ae(b,null):c.length=f+1;Yb(a.ca,b.path(),e);for(h=0;h<d.length;h++)sb(d[h])}};function Xd(){this.lb={};this.wf=!1}Xd.prototype.ab=function(){for(var a in this.lb)this.lb[a].ab()};Xd.prototype.kc=function(){for(var a in this.lb)this.lb[a].kc()};Xd.prototype.ce=function(a){this.wf=a};ca(Xd);Xd.prototype.interrupt=Xd.prototype.ab;Xd.prototype.resume=Xd.prototype.kc;var Z={};Z.nc=wf;Z.DataConnection=Z.nc;wf.prototype.ng=function(a,b){this.ua("q",{p:a},b)};Z.nc.prototype.simpleListen=Z.nc.prototype.ng;wf.prototype.Hf=function(a,b){this.ua("echo",{d:a},b)};Z.nc.prototype.echo=Z.nc.prototype.Hf;wf.prototype.interrupt=wf.prototype.ab;Z.zf=kf;Z.RealTimeConnection=Z.zf;kf.prototype.sendRequest=kf.prototype.ua;kf.prototype.close=kf.prototype.close;
Z.Rf=function(a){var b=wf.prototype.put;wf.prototype.put=function(c,d,e,f){n(f)&&(f=a());b.call(this,c,d,e,f)};return function(){wf.prototype.put=b}};Z.hijackHash=Z.Rf;Z.yf=Hb;Z.ConnectionTarget=Z.yf;Z.ja=function(a){return a.ja()};Z.queryIdentifier=Z.ja;Z.Uf=function(a){return a.u.Ra.$};Z.listens=Z.Uf;Z.ce=function(a){Xd.Vb().ce(a)};Z.forceRestClient=Z.ce;Z.Context=Xd;function T(a,b){if(!(a instanceof Sd))throw Error("new Firebase() no longer supported - use app.database().");Y.call(this,a,b,mg,!1);this.then=void 0;this["catch"]=void 0}la(T,Y);g=T.prototype;g.getKey=function(){x("Firebase.key",0,0,arguments.length);return this.path.e()?null:Bd(this.path)};
g.n=function(a){x("Firebase.child",1,1,arguments.length);if(ga(a))a=String(a);else if(!(a instanceof L))if(null===H(this.path)){var b=a;b&&(b=b.replace(/^\/*\.info(\/|$)/,"/"));ze("Firebase.child",b)}else ze("Firebase.child",a);return new T(this.u,this.path.n(a))};g.getParent=function(){x("Firebase.parent",0,0,arguments.length);var a=this.path.parent();return null===a?null:new T(this.u,a)};
g.Of=function(){x("Firebase.ref",0,0,arguments.length);for(var a=this;null!==a.getParent();)a=a.getParent();return a};g.Gf=function(){return this.u.Ya};g.set=function(a,b){x("Firebase.set",1,2,arguments.length);Ae("Firebase.set",this.path);se("Firebase.set",a,this.path,!1);A("Firebase.set",2,b,!0);var c=new db;this.u.Jb(this.path,a,null,eb(c,b));return c.ra};
g.update=function(a,b){x("Firebase.update",1,2,arguments.length);Ae("Firebase.update",this.path);if(ea(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;O("Passing an Array to Firebase.update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}ve("Firebase.update",a,this.path);A("Firebase.update",2,b,!0);c=new db;this.u.update(this.path,a,eb(c,b));return c.ra};
g.Jb=function(a,b,c){x("Firebase.setWithPriority",2,3,arguments.length);Ae("Firebase.setWithPriority",this.path);se("Firebase.setWithPriority",a,this.path,!1);we("Firebase.setWithPriority",2,b);A("Firebase.setWithPriority",3,c,!0);if(".length"===this.getKey()||".keys"===this.getKey())throw"Firebase.setWithPriority failed: "+this.getKey()+" is a read-only object.";var d=new db;this.u.Jb(this.path,a,b,eb(d,c));return d.ra};
g.remove=function(a){x("Firebase.remove",0,1,arguments.length);Ae("Firebase.remove",this.path);A("Firebase.remove",1,a,!0);return this.set(null,a)};
g.transaction=function(a,b,c){x("Firebase.transaction",1,3,arguments.length);Ae("Firebase.transaction",this.path);A("Firebase.transaction",1,a,!1);A("Firebase.transaction",2,b,!0);if(n(c)&&"boolean"!=typeof c)throw Error(y("Firebase.transaction",3,!0)+"must be a boolean.");if(".length"===this.getKey()||".keys"===this.getKey())throw"Firebase.transaction failed: "+this.getKey()+" is a read-only object.";"undefined"===typeof c&&(c=!0);var d=new db;ha(b)&&fb(d.ra);Fh(this.u,this.path,a,function(a,c,h){a?
d.reject(a):d.resolve(new ub(c,h));ha(b)&&b(a,c,h)},c);return d.ra};g.kg=function(a,b){x("Firebase.setPriority",1,2,arguments.length);Ae("Firebase.setPriority",this.path);we("Firebase.setPriority",1,a);A("Firebase.setPriority",2,b,!0);var c=new db;this.u.Jb(this.path.n(".priority"),a,null,eb(c,b));return c.ra};
g.push=function(a,b){x("Firebase.push",0,2,arguments.length);Ae("Firebase.push",this.path);se("Firebase.push",a,this.path,!0);A("Firebase.push",2,b,!0);var c=zh(this.u),d=Ie(c),c=this.n(d),e;if(null!=a){var f=this;e=c.set(a,b).then(function(){return f.n(d)})}else e=cb.resolve(c);c.then=q(e.then,e);c["catch"]=q(e.then,e,void 0);ha(b)&&fb(e);return c};g.ib=function(){Ae("Firebase.onDisconnect",this.path);return new U(this.u,this.path)};T.prototype.child=T.prototype.n;T.prototype.set=T.prototype.set;
T.prototype.update=T.prototype.update;T.prototype.setWithPriority=T.prototype.Jb;T.prototype.remove=T.prototype.remove;T.prototype.transaction=T.prototype.transaction;T.prototype.setPriority=T.prototype.kg;T.prototype.push=T.prototype.push;T.prototype.onDisconnect=T.prototype.ib;Wc(T.prototype,"database",T.prototype.Gf);Wc(T.prototype,"key",T.prototype.getKey);Wc(T.prototype,"parent",T.prototype.getParent);Wc(T.prototype,"root",T.prototype.Of);if("undefined"===typeof firebase)throw Error("Cannot install Firebase Database - be sure to load firebase-app.js first.");
try{firebase.INTERNAL.registerService("database",function(a){var b=Xd.Vb(),c=a.options.databaseURL;n(c)||Kc("Can't determine Firebase Database URL.  Be sure to include databaseURL option when calling firebase.intializeApp().");var d=Lc(c),c=d.jc;Wd("Invalid Firebase Database URL",d);d.path.e()||Kc("Database URL must point to the root of a Firebase Database (not including a child path).");(d=B(b.lb,a.name))&&Kc("FIREBASE INTERNAL ERROR: Database initialized multiple times.");d=new Sd(c,b.wf,a);b.lb[a.name]=
d;return d.Ya},{Reference:T,Query:Y,Database:Rd,enableLogging:Hc,INTERNAL:W,TEST_ACCESS:Z,ServerValue:Ud})}catch(Oh){Kc("Failed to register the Firebase Database Service ("+Oh+")")};})();

(function(){var f=function(a,b){function c(){}c.prototype=b.prototype;a.prototype=new c;for(var d in b)if(Object.defineProperties){var e=Object.getOwnPropertyDescriptor(b,d);e&&Object.defineProperty(a,d,e)}else a[d]=b[d]},g=this,h=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=
typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},k=function(a,b){function c(){}c.prototype=b.prototype;a.B=b.prototype;a.prototype=new c;a.u=function(a,c,n){for(var d=Array(arguments.length-2),e=2;e<arguments.length;e++)d[e-2]=arguments[e];
return b.prototype[c].apply(a,d)}};var m={},p=(m["only-available-in-window"]="This method is available in a Window context.",m["only-available-in-sw"]="This method is available in a service worker context.",m["should-be-overriden"]="This method should be overriden by extended classes.",m["bad-sender-id"]="Please ensure that 'messagingSenderId' is set correctly in the options passed into firebase.initializeApp().",m["permission-default"]="The required permissions were not granted and dismissed instead.",m["permission-blocked"]="The required permissions were not granted and blocked instead.",
m["unsupported-browser"]="This browser doesn't support the API's required to use the firebase SDK.",m["notifications-blocked"]="Notifications have been blocked.",m["failed-serviceworker-registration"]="We are unable to register the default service worker. {$browserErrorMessage}",m["sw-registration-expected"]="A service worker registration was the expected input.",m["get-subscription-failed"]="There was an error when trying to get any existing Push Subscriptions.",m["invalid-saved-token"]="Unable to access details of the saved token.",
m["sw-reg-redundant"]="The service worker being used for push was made redundant.",m["token-subscribe-failed"]="A problem occured while subscribing the user to FCM: {$message}",m["token-subscribe-no-token"]="FCM returned no token when subscribing the user to push.",m["token-subscribe-no-push-set"]="FCM returned an invalid response when getting an FCM token.",m["use-sw-before-get-token"]="You must call useServiceWorker() before calling getToken() to ensure your service worker is used.",m["invalid-delete-token"]=
"You must pass a valid token into deleteToken(), i.e. the token from getToken().",m["delete-token-not-found"]="The deletion attempt for token could not be performed as the token was not found.",m["bg-handler-function-expected"]="The input to setBackgroundMessageHandler() must be a function.",m["no-window-client-to-msg"]="An attempt was made to message a non-existant window client.",m["unable-to-resubscribe"]="There was an error while re-subscribing the FCM token for push messaging. Will have to resubscribe the user on next visit. {$message}",
m["no-fcm-token-for-resubscribe"]="Could not find an FCM token and as a result, unable to resubscribe. Will have to resubscribe the user on next visit.",m["failed-to-delete-token"]="Unable to delete the currently saved token.",m["no-sw-in-reg"]="Even though the service worker registration was successful, there was a problem accessing the service worker itself.",m["incorrect-gcm-sender-id"]="Please change your web app manifest's 'gcm_sender_id' value to '103953800507' to use Firebase messaging.",m);var q={userVisibleOnly:!0,applicationServerKey:new Uint8Array([4,51,148,247,223,161,235,177,220,3,162,94,21,113,219,72,211,46,237,237,178,52,219,183,71,58,12,143,196,204,225,111,60,140,132,223,171,182,102,62,242,12,212,139,254,227,249,118,47,20,28,99,8,106,111,45,177,26,149,176,206,55,192,156,110])};var r=function(a,b){var c={};return c["firebase-messaging-msg-type"]=a,c["firebase-messaging-msg-data"]=b,c};var u=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,u);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};k(u,Error);var v=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")};var w=function(a,b){b.unshift(a);u.call(this,v.apply(null,b));b.shift()};k(w,u);var x=function(a,b,c){if(!a){var d="Assertion failed";if(b)var d=d+(": "+b),e=Array.prototype.slice.call(arguments,2);throw new w(""+d,e||[]);}};var y=null;var A=function(a){a=new Uint8Array(a);var b=h(a);x("array"==b||"object"==b&&"number"==typeof a.length,"encodeByteArray takes an array as a parameter");if(!y)for(y={},b=0;65>b;b++)y[b]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(b);for(var b=y,c=[],d=0;d<a.length;d+=3){var e=a[d],n=d+1<a.length,l=n?a[d+1]:0,z=d+2<a.length,t=z?a[d+2]:0,M=e>>2,e=(e&3)<<4|l>>4,l=(l&15)<<2|t>>6,t=t&63;z||(t=64,n||(l=64));c.push(b[M],b[e],b[l],b[t])}return c.join("").replace(/\+/g,"-").replace(/\//g,
"_").replace(/=+$/,"")};var B=new firebase.INTERNAL.ErrorFactory("messaging","Messaging",p),C=function(){this.a=null},D=function(a){if(a.a)return a.a;a.a=new Promise(function(a,c){var b=g.indexedDB.open("fcm_token_details_db",1);b.onerror=function(a){c(a.target.error)};b.onsuccess=function(b){a(b.target.result)};b.onupgradeneeded=function(a){a=a.target.result.createObjectStore("fcm_token_object_Store",{keyPath:"swScope"});a.createIndex("fcmSenderId","fcmSenderId",{unique:!1});a.createIndex("fcmToken","fcmToken",{unique:!0})}});
return a.a},E=function(a){a.a?a.a.then(function(b){b.close();a.a=null}):Promise.resolve()},F=function(a,b){return D(a).then(function(a){return new Promise(function(c,e){var d=a.transaction(["fcm_token_object_Store"]).objectStore("fcm_token_object_Store").index("fcmToken").get(b);d.onerror=function(a){e(a.target.error)};d.onsuccess=function(a){c(a.target.result)}})})},G=function(a,b){return D(a).then(function(a){return new Promise(function(c,e){var d=[],l=a.transaction(["fcm_token_object_Store"]).objectStore("fcm_token_object_Store").openCursor();
l.onerror=function(a){e(a.target.error)};l.onsuccess=function(a){(a=a.target.result)?(a.value.fcmSenderId===b&&d.push(a.value),a.continue()):c(d)}})})},H=function(a,b,c){var d=A(b.getKey("p256dh")),e=A(b.getKey("auth"));a="authorized_entity="+a+"&"+("endpoint="+b.endpoint+"&")+("encryption_key="+d+"&")+("encryption_auth="+e);c&&(a+="&pushSet="+c);c=new Headers;c.append("Content-Type","application/x-www-form-urlencoded");return fetch("https://fcm.googleapis.com/fcm/connect/subscribe",{method:"POST",
headers:c,body:a}).then(function(a){return a.json()}).then(function(a){if(a.error)throw B.create("token-subscribe-failed",{message:a.error.message});if(!a.token)throw B.create("token-subscribe-no-token");if(!a.pushSet)throw B.create("token-subscribe-no-push-set");return{token:a.token,pushSet:a.pushSet}})},I=function(a,b,c,d,e,n){var l={swScope:c.scope,endpoint:d.endpoint,auth:A(d.getKey("auth")),p256dh:A(d.getKey("p256dh")),fcmToken:e,fcmPushSet:n,fcmSenderId:b};return D(a).then(function(a){return new Promise(function(b,
c){var d=a.transaction(["fcm_token_object_Store"],"readwrite").objectStore("fcm_token_object_Store").put(l);d.onerror=function(a){c(a.target.error)};d.onsuccess=function(){b()}})})};
C.prototype.i=function(a,b){return b instanceof ServiceWorkerRegistration?"string"!==typeof a||0===a.length?Promise.reject(B.create("bad-sender-id")):G(this,a).then(function(c){if(0!==c.length){var d=c.findIndex(function(c){return b.scope===c.swScope&&a===c.fcmSenderId});if(-1!==d)return c[d]}}).then(function(a){if(a)return b.pushManager.getSubscription().catch(function(){throw B.create("get-subscription-failed");}).then(function(b){var c;if(c=b)c=b.endpoint===a.endpoint&&A(b.getKey("auth"))===a.auth&&
A(b.getKey("p256dh"))===a.p256dh;if(c)return a.fcmToken})}):Promise.reject(B.create("sw-registration-expected"))};C.prototype.getSavedToken=C.prototype.i;
C.prototype.h=function(a,b){var c=this;return"string"!==typeof a||0===a.length?Promise.reject(B.create("bad-sender-id")):b instanceof ServiceWorkerRegistration?b.pushManager.getSubscription().then(function(a){return a?a:b.pushManager.subscribe(q)}).then(function(d){return H(a,d).then(function(e){return I(c,a,b,d,e.token,e.pushSet).then(function(){return e.token})})}):Promise.reject(B.create("sw-registration-expected"))};C.prototype.createToken=C.prototype.h;
C.prototype.deleteToken=function(a){var b=this;return"string"!==typeof a||0===a.length?Promise.reject(B.create("invalid-delete-token")):F(this,a).then(function(a){if(!a)throw B.create("delete-token-not-found");return D(b).then(function(b){return new Promise(function(c,d){var e=b.transaction(["fcm_token_object_Store"],"readwrite").objectStore("fcm_token_object_Store").delete(a.swScope);e.onerror=function(a){d(a.target.error)};e.onsuccess=function(b){0===b.target.result?d(B.create("failed-to-delete-token")):
c(a)}})})})};var J=function(a){var b=this;this.a=new firebase.INTERNAL.ErrorFactory("messaging","Messaging",p);if(!a.options.messagingSenderId||"string"!==typeof a.options.messagingSenderId)throw this.a.create("bad-sender-id");this.l=a.options.messagingSenderId;this.c=new C;this.app=a;this.INTERNAL={};this.INTERNAL.delete=function(){return b.delete}};
J.prototype.getToken=function(){var a=this,b=Notification.permission;return"granted"!==b?"denied"===b?Promise.reject(this.a.create("notifications-blocked")):Promise.resolve(null):this.f().then(function(b){return a.c.i(a.l,b).then(function(c){return c?c:a.c.h(a.l,b)})})};J.prototype.getToken=J.prototype.getToken;J.prototype.deleteToken=function(a){var b=this;return this.c.deleteToken(a).then(function(){return b.f()}).then(function(a){return a?a.pushManager.getSubscription():null}).then(function(a){if(a)return a.unsubscribe()})};
J.prototype.deleteToken=J.prototype.deleteToken;J.prototype.f=function(){throw this.a.create("should-be-overriden");};J.prototype.requestPermission=function(){throw this.a.create("only-available-in-window");};J.prototype.useServiceWorker=function(){throw this.a.create("only-available-in-window");};J.prototype.useServiceWorker=J.prototype.useServiceWorker;J.prototype.onMessage=function(){throw this.a.create("only-available-in-window");};J.prototype.onMessage=J.prototype.onMessage;
J.prototype.onTokenRefresh=function(){throw this.a.create("only-available-in-window");};J.prototype.onTokenRefresh=J.prototype.onTokenRefresh;J.prototype.setBackgroundMessageHandler=function(){throw this.a.create("only-available-in-sw");};J.prototype.setBackgroundMessageHandler=J.prototype.setBackgroundMessageHandler;J.prototype.delete=function(){E(this.c)};var K=self,P=function(a){J.call(this,a);var b=this;this.a=new firebase.INTERNAL.ErrorFactory("messaging","Messaging",p);K.addEventListener("push",function(a){return L(b,a)},!1);K.addEventListener("pushsubscriptionchange",function(a){return N(b,a)},!1);K.addEventListener("notificationclick",function(a){return O(b,a)},!1);this.b=null};f(P,J);
var L=function(a,b){var c;try{c=b.data.json()}catch(e){return}var d=Q().then(function(b){if(b){if(c.notification||a.b)return R(a,c)}else{if((b=c)&&"object"===typeof b.notification){var d=Object.assign({},b.notification),e={};d.data=(e.FCM_MSG=b,e);b=d}else b=void 0;if(b)return K.registration.showNotification(b.title||"",b);if(a.b)return a.b(c)}});b.waitUntil(d)},N=function(a,b){var c=a.getToken().then(function(b){if(!b)throw a.a.create("no-fcm-token-for-resubscribe");var c=a.c;return F(c,b).then(function(b){if(!b)throw a.a.create("invalid-saved-token");
return K.registration.pushManager.subscribe(q).then(function(a){return H(b.w,a,b.v)}).catch(function(d){return c.deleteToken(b.A).then(function(){throw a.a.create("unable-to-resubscribe",{message:d});})})})});b.waitUntil(c)},O=function(a,b){if(b.notification&&b.notification.data&&b.notification.data.FCM_MSG){b.stopImmediatePropagation();b.notification.close();var c=b.notification.data.FCM_MSG,d=c.notification.click_action;if(d){var e=S(d).then(function(a){return a?a:K.clients.openWindow(d)}).then(function(b){if(b)return delete c.notification,
T(a,b,r("notification-clicked",c))});b.waitUntil(e)}}};P.prototype.setBackgroundMessageHandler=function(a){if(a&&"function"!==typeof a)throw this.a.create("bg-handler-function-expected");this.b=a};P.prototype.setBackgroundMessageHandler=P.prototype.setBackgroundMessageHandler;
var S=function(a){var b=(new URL(a)).href;return K.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(a){for(var c=null,e=0;e<a.length;e++)if((new URL(a[e].url)).href===b){c=a[e];break}if(c)return c.focus(),c})},T=function(a,b,c){return new Promise(function(d,e){if(!b)return e(a.a.create("no-window-client-to-msg"));b.postMessage(c);d()})},Q=function(){return K.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(a){return a.some(function(a){return"visible"===
a.visibilityState})})},R=function(a,b){return K.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(c){var d=r("push-msg-received",b);return Promise.all(c.map(function(b){return T(a,b,d)}))})};P.prototype.f=function(){return Promise.resolve(K.registration)};var V=function(a){J.call(this,a);var b=this;this.j=null;this.m=firebase.INTERNAL.createSubscribe(function(a){b.j=a});this.s=null;this.o=firebase.INTERNAL.createSubscribe(function(a){b.s=a});U(this)};f(V,J);
V.prototype.getToken=function(){var a=this;return"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")?W(this).then(function(){return J.prototype.getToken.call(a)}):Promise.reject(this.a.create("unsupported-browser"))};V.prototype.getToken=V.prototype.getToken;
var W=function(a){if(a.g)return a.g;var b=document.querySelector('link[rel="manifest"]');b?a.g=fetch(b.href).then(function(a){return a.json()}).catch(function(){return Promise.resolve()}).then(function(b){if(b&&b.gcm_sender_id&&"103953800507"!==b.gcm_sender_id)throw a.a.create("incorrect-gcm-sender-id");}):a.g=Promise.resolve();return a.g};
V.prototype.requestPermission=function(){var a=this;return"granted"===Notification.permission?Promise.resolve():new Promise(function(b,c){var d=function(d){return"granted"===d?b():"denied"===d?c(a.a.create("permission-blocked")):c(a.a.create("permission-default"))},e=Notification.requestPermission(function(a){e||d(a)});e&&e.then(d)})};V.prototype.requestPermission=V.prototype.requestPermission;
V.prototype.useServiceWorker=function(a){if(!(a instanceof ServiceWorkerRegistration))throw this.a.create("sw-registration-expected");if("undefined"!==typeof this.b)throw this.a.create("use-sw-before-get-token");this.b=a};V.prototype.useServiceWorker=V.prototype.useServiceWorker;V.prototype.onMessage=function(a,b,c){return this.m(a,b,c)};V.prototype.onMessage=V.prototype.onMessage;V.prototype.onTokenRefresh=function(a,b,c){return this.o(a,b,c)};V.prototype.onTokenRefresh=V.prototype.onTokenRefresh;
var X=function(a,b){var c=b.installing||b.waiting||b.active;return new Promise(function(d,e){if(c)if("activated"===c.state)d(b);else if("redundant"===c.state)e(a.a.create("sw-reg-redundant"));else{var n=function(){if("activated"===c.state)d(b);else if("redundant"===c.state)e(a.a.create("sw-reg-redundant"));else return;c.removeEventListener("statechange",n)};c.addEventListener("statechange",n)}else e(a.a.create("no-sw-in-reg"))})};
V.prototype.f=function(){var a=this;if(this.b)return X(this,this.b);this.b=null;return navigator.serviceWorker.register("/firebase-messaging-sw.js",{scope:"/firebase-cloud-messaging-push-scope"}).catch(function(b){throw a.a.create("failed-serviceworker-registration",{browserErrorMessage:b.message});}).then(function(b){return X(a,b).then(function(){a.b=b;b.update();return b})})};
var U=function(a){"serviceWorker"in navigator&&navigator.serviceWorker.addEventListener("message",function(b){if(b.data&&b.data["firebase-messaging-msg-type"])switch(b=b.data,b["firebase-messaging-msg-type"]){case "push-msg-received":case "notification-clicked":a.j.next(b["firebase-messaging-msg-data"])}},!1)};if(!(firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerService))throw Error("Cannot install Firebase Messaging - be sure to load firebase-app.js first.");firebase.INTERNAL.registerService("messaging",function(a){return self&&"ServiceWorkerGlobalScope"in self?new P(a):new V(a)},{Messaging:V});}).call(this);
(function(){for(var k,aa="function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,c){if(c.get||c.set)throw new TypeError("ES3 does not support getters and setters.");a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value)},l="undefined"!=typeof window&&window===this?this:"undefined"!=typeof global&&null!=global?global:this,m=["Number","MIN_SAFE_INTEGER"],ba=0;ba<m.length-1;ba++){var ca=m[ba];ca in l||(l[ca]={});l=l[ca]}var da=m[m.length-1];
-9007199254740991!=l[da]&&aa(l,da,{configurable:!0,writable:!0,value:-9007199254740991});
var n=this,q=function(a){return void 0!==a},ea=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&
!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b};var r=function(a,b){return-1!==a.indexOf(b)};var fa=function(a,b,c){function d(){z||(z=!0,b.apply(null,arguments))}function e(b){p=setTimeout(function(){p=null;a(g,2===C)},b)}function g(a,b){if(!z)if(a)d.apply(null,arguments);else if(2===C||B)d.apply(null,arguments);else{64>h&&(h*=2);var c;1===C?(C=2,c=0):c=1E3*(h+Math.random());e(c)}}function f(a){Ma||(Ma=!0,z||(null!==p?(a||(C=2),clearTimeout(p),e(0)):a||(C=1)))}var h=1,p=null,B=!1,C=0,z=!1,Ma=!1;e(0);setTimeout(function(){B=!0;f(!0)},c);return f};var t="https://firebasestorage.googleapis.com";var u=function(a,b){this.code="storage/"+a;this.message="Firebase Storage: "+b;this.serverResponse=null;this.name="FirebaseError"};(function(){var a=Error;function b(){}b.prototype=a.prototype;u.b=a.prototype;u.prototype=new b;u.a=function(b,d,e){for(var c=Array(arguments.length-2),f=2;f<arguments.length;f++)c[f-2]=arguments[f];return a.prototype[d].apply(b,c)}})();
var ga=function(){return new u("unknown","An unknown error occurred, please check the error payload for server response.")},ha=function(){return new u("canceled","User canceled the upload/download.")},ia=function(){return new u("cannot-slice-blob","Cannot slice blob for upload. Please retry the upload.")},ja=function(a,b,c){return new u("invalid-argument","Invalid argument in `"+b+"` at index "+a+": "+c)},ka=function(){return new u("app-deleted","The Firebase app was deleted.")},v=function(a,b){return new u("invalid-format",
"String does not match format '"+a+"': "+b)},la=function(a){throw new u("internal-error","Internal error: "+a);};var ma=function(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b(c,a[c])},na=function(a){var b={};ma(a,function(a,d){b[a]=d});return b};var oa=function(a,b){b=b.split("/").filter(function(a){return 0<a.length}).join("/");return 0===a.length?b:a+"/"+b},pa=function(a){var b=a.lastIndexOf("/",a.length-2);return-1===b?a:a.slice(b+1)};var qa=function(a){if("undefined"!==typeof firebase)return new firebase.Promise(a);throw Error("Error in Firebase Storage - be sure to load firebase-app.js first.");};var w=function(a,b,c,d){this.h=a;this.b={};this.method=b;this.headers={};this.body=null;this.j=c;this.l=this.a=null;this.c=[200];this.g=[];this.timeout=d;this.f=!0};var ra={STATE_CHANGED:"state_changed"},x={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"},sa=function(a){switch(a){case "running":case "pausing":case "canceling":return"running";case "paused":return"paused";case "success":return"success";case "canceled":return"canceled";case "error":return"error";default:return"error"}};var y=function(a){return q(a)&&null!==a},ta=function(a){return"string"===typeof a||a instanceof String},ua=function(){return"undefined"!==typeof Blob};var wa=function(a,b){var c=va;return Object.prototype.hasOwnProperty.call(c,a)?c[a]:c[a]=b(a)};var xa=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},ya=function(a,b){return a<b?-1:a>b?1:0};var A=function(a){return function(){var b=[];Array.prototype.push.apply(b,arguments);firebase.Promise.resolve(!0).then(function(){a.apply(null,b)})}};var D=function(a,b){this.bucket=a;this.path=b},za=function(a){var b=encodeURIComponent;return"/b/"+b(a.bucket)+"/o/"+b(a.path)},Ba=function(a){var b;try{b=Aa(a)}catch(c){return new D(a,"")}if(""===b.path)return b;throw new u("invalid-default-bucket","Invalid default bucket '"+a+"'.");},Aa=function(a){for(var b=null,c=[{K:/^gs:\/\/([A-Za-z0-9.\-]+)(\/(.*))?$/i,G:{bucket:1,path:3},J:function(a){"/"===a.path.charAt(a.path.length-1)&&(a.path=a.path.slice(0,-1))}},{K:/^https?:\/\/firebasestorage\.googleapis\.com\/v[A-Za-z0-9_]+\/b\/([A-Za-z0-9.\-]+)\/o(\/([^?#]*).*)?$/i,
G:{bucket:1,path:3},J:function(a){a.path=decodeURIComponent(a.path)}}],d=0;d<c.length;d++){var e=c[d],g=e.K.exec(a);if(g){b=g[e.G.bucket];(g=g[e.G.path])||(g="");b=new D(b,g);e.J(b);break}}if(null==b)throw new u("invalid-url","Invalid URL '"+a+"'.");return b};var Ca=function(a,b,c){"function"==ea(a)||y(b)||y(c)?(this.b=a,this.error=b||null,this.a=c||null):(this.b=a.next||null,this.error=a.error||null,this.a=a.complete||null)};var E={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"},Da=function(a){switch(a){case "raw":case "base64":case "base64url":case "data_url":break;default:throw"Expected one of the event types: [raw, base64, base64url, data_url].";}},Ea=function(a,b){this.data=a;this.a=b||null},Ia=function(a,b){switch(a){case "raw":return new Ea(Fa(b));case "base64":case "base64url":return new Ea(Ga(a,b));case "data_url":a=new Ha(b);var c;if(a.a)c=Ga("base64",a.c);else{try{c=decodeURIComponent(a.c)}catch(d){throw v("data_url",
"Malformed data URL.");}c=Fa(c)}return new Ea(c,(new Ha(b)).b)}throw ga();},Fa=function(a){for(var b=[],c=0;c<a.length;c++){var d=a.charCodeAt(c);if(127>=d)b.push(d);else if(2047>=d)b.push(192|d>>6,128|d&63);else if(55296==(d&64512))if(c<a.length-1&&56320==(a.charCodeAt(c+1)&64512)){var e=a.charCodeAt(++c),d=65536|(d&1023)<<10|e&1023;b.push(240|d>>18,128|d>>12&63,128|d>>6&63,128|d&63)}else b.push(239,191,189);else 56320==(d&64512)?b.push(239,191,189):b.push(224|d>>12,128|d>>6&63,128|d&63)}return new Uint8Array(b)},
Ga=function(a,b){switch(a){case "base64":var c=-1!==b.indexOf("-"),d=-1!==b.indexOf("_");if(c||d)throw v(a,"Invalid character '"+(c?"-":"_")+"' found: is it base64url encoded?");break;case "base64url":c=-1!==b.indexOf("+");d=-1!==b.indexOf("/");if(c||d)throw v(a,"Invalid character '"+(c?"+":"/")+"' found: is it base64 encoded?");b=b.replace(/-/g,"+").replace(/_/g,"/")}var e;try{e=atob(b)}catch(g){throw v(a,"Invalid character found");}a=new Uint8Array(e.length);for(b=0;b<e.length;b++)a[b]=e.charCodeAt(b);
return a},Ha=function(a){var b=a.match(/^data:([^,]+)?,/);if(null===b)throw v("data_url","Must be formatted 'data:[<mediatype>][;base64],<data>");b=b[1]||null;this.a=!1;this.b=null;if(null!=b){var c=b.length-7;this.b=(this.a=0<=c&&b.indexOf(";base64",c)==c)?b.substring(0,b.length-7):b}this.c=a.substring(a.indexOf(",")+1)};var Ja=function(a){var b=encodeURIComponent,c="?";ma(a,function(a,e){a=b(a)+"="+b(e);c=c+a+"&"});return c=c.slice(0,-1)};var Ka=function(){var a=this;this.a=new XMLHttpRequest;this.c=0;this.f=qa(function(b){a.a.addEventListener("abort",function(){a.c=2;b(a)});a.a.addEventListener("error",function(){a.c=1;b(a)});a.a.addEventListener("load",function(){b(a)})});this.b=!1},La=function(a,b,c,d,e){if(a.b)throw la("cannot .send() more than once");a.b=!0;a.a.open(c,b,!0);y(e)&&ma(e,function(b,c){a.a.setRequestHeader(b,c.toString())});y(d)?a.a.send(d):a.a.send();return a.f},Na=function(a){if(!a.b)throw la("cannot .getErrorCode() before sending");
return a.c},F=function(a){if(!a.b)throw la("cannot .getStatus() before sending");try{return a.a.status}catch(b){return-1}},Oa=function(a){if(!a.b)throw la("cannot .getResponseText() before sending");return a.a.responseText};Ka.prototype.abort=function(){this.a.abort()};var G=function(a,b,c,d,e,g){this.b=a;this.h=b;this.f=c;this.a=d;this.g=e;this.c=g};k=G.prototype;k.V=function(){return this.b};k.qa=function(){return this.h};k.na=function(){return this.f};k.ia=function(){return this.a};k.W=function(){if(y(this.a)){var a=this.a.downloadURLs;return y(a)&&y(a[0])?a[0]:null}return null};k.pa=function(){return this.g};k.la=function(){return this.c};var H;a:{var Pa=n.navigator;if(Pa){var Qa=Pa.userAgent;if(Qa){H=Qa;break a}}H=""};var Sa=function(a,b,c,d,e,g,f,h,p,B,C){this.C=a;this.A=b;this.v=c;this.o=d;this.B=e.slice();this.m=g.slice();this.j=this.l=this.c=this.b=null;this.f=this.g=!1;this.s=f;this.h=h;this.D=C;this.w=p;var z=this;this.u=qa(function(a,b){z.l=a;z.j=b;Ra(z)})},Ta=function(a,b,c){this.b=a;this.c=b;this.a=!!c},Ra=function(a){function b(a,b){b?a(!1,new Ta(!1,null,!0)):(b=new Ka,b.a.withCredentials=d.D,d.b=b,La(b,d.C,d.A,d.o,d.v).then(function(b){d.b=null;var c=0===Na(b),e=F(b);if(!(c=!c))var c=r([408,429],e),
g=r(d.m,e),c=500<=e&&600>e||c||g;c?(b=2===Na(b),a(!1,new Ta(!1,null,b))):a(!0,new Ta(r(d.B,e),b))}))}function c(a,b){var c=d.l;a=d.j;var e=b.c;if(b.b)try{var g=d.s(e,Oa(e));q(g)?c(g):c()}catch(B){a(B)}else null!==e?(b=ga(),g=Oa(e),b.serverResponse=g,d.h?a(d.h(e,b)):a(b)):(b=b.a?d.f?ka():ha():new u("retry-limit-exceeded","Max retry time for operation exceeded, please try again."),a(b))}var d=a;a.g?c(0,new Ta(!1,null,!0)):a.c=fa(b,c,a.w)};Sa.prototype.a=function(){return this.u};
Sa.prototype.cancel=function(a){this.g=!0;this.f=a||!1;null!==this.c&&(0,this.c)(!1);null!==this.b&&this.b.abort()};var Ua=function(a,b,c){var d=Ja(a.b),d=a.h+d,e=a.headers?na(a.headers):{};null!==b&&0<b.length&&(e.Authorization="Firebase "+b);e["X-Firebase-Storage-Version"]="webjs/"+("undefined"!==typeof firebase?firebase.SDK_VERSION:"AppManager");return new Sa(d,a.method,e,a.body,a.c,a.g,a.j,a.a,a.timeout,0,c)};var Va=function(){};var Wa=function(a){this.b=firebase.Promise.reject(a)};Wa.prototype.a=function(){return this.b};Wa.prototype.cancel=function(){};var Xa=function(){this.a={};this.b=Number.MIN_SAFE_INTEGER},Ya=function(a,b){function c(){delete e.a[d]}var d=a.b;a.b++;a.a[d]=b;var e=a;b.a().then(c,c)},Za=function(a){ma(a.a,function(a,c){c&&c.cancel(!0)});a.a={}};var $a=function(a,b,c,d,e){this.a=a;this.g=null;null!==this.a&&(a=this.a.options,y(a)&&(a=a.storageBucket||null,this.g=null==a?null:Ba(a).bucket));this.o=b;this.m=c;this.j=e;this.l=d;this.c=12E4;this.b=6E4;this.h=new Xa;this.f=!1},ab=function(a){return null!==a.a&&y(a.a.INTERNAL)&&y(a.a.INTERNAL.getToken)?a.a.INTERNAL.getToken().then(function(a){return y(a)?a.accessToken:null},function(){return null}):firebase.Promise.resolve(null)};$a.prototype.bucket=function(){if(this.f)throw ka();return this.g};
var I=function(a,b,c){if(a.f)return new Wa(ka());b=a.m(b,c,null===a.a,a.j);Ya(a.h,b);return b};var bb=-1!=H.indexOf("Opera"),cb=-1!=H.indexOf("Trident")||-1!=H.indexOf("MSIE"),db=-1!=H.indexOf("Edge"),eb=-1!=H.indexOf("Gecko")&&!(-1!=H.toLowerCase().indexOf("webkit")&&-1==H.indexOf("Edge"))&&!(-1!=H.indexOf("Trident")||-1!=H.indexOf("MSIE"))&&-1==H.indexOf("Edge"),fb=-1!=H.toLowerCase().indexOf("webkit")&&-1==H.indexOf("Edge"),gb;
a:{var hb="",ib=function(){var a=H;if(eb)return/rv\:([^\);]+)(\)|;)/.exec(a);if(db)return/Edge\/([\d\.]+)/.exec(a);if(cb)return/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(fb)return/WebKit\/(\S+)/.exec(a);if(bb)return/(?:Version)[ \/]?(\S+)/.exec(a)}();ib&&(hb=ib?ib[1]:"");if(cb){var jb,kb=n.document;jb=kb?kb.documentMode:void 0;if(null!=jb&&jb>parseFloat(hb)){gb=String(jb);break a}}gb=hb}
var lb=gb,va={},mb=function(a){return wa(a,function(){for(var b=0,c=xa(String(lb)).split("."),d=xa(String(a)).split("."),e=Math.max(c.length,d.length),g=0;0==b&&g<e;g++){var f=c[g]||"",h=d[g]||"";do{f=/(\d*)(\D*)(.*)/.exec(f)||["","","",""];h=/(\d*)(\D*)(.*)/.exec(h)||["","","",""];if(0==f[0].length&&0==h[0].length)break;b=ya(0==f[1].length?0:parseInt(f[1],10),0==h[1].length?0:parseInt(h[1],10))||ya(0==f[2].length,0==h[2].length)||ya(f[2],h[2]);f=f[3];h=h[3]}while(0==b)}return 0<=b})};var nb=function(a){var b=n.BlobBuilder||n.WebKitBlobBuilder;if(q(b)){for(var b=new b,c=0;c<arguments.length;c++)b.append(arguments[c]);return b.getBlob()}b=Array.prototype.slice.call(arguments);c=n.BlobBuilder||n.WebKitBlobBuilder;if(q(c)){for(var c=new c,d=0;d<b.length;d++)c.append(b[d],void 0);b=c.getBlob(void 0)}else if(q(n.Blob))b=new Blob(b,{});else throw Error("This browser doesn't seem to support creating Blobs");return b},ob=function(a,b,c){q(c)||(c=a.size);return a.webkitSlice?a.webkitSlice(b,
c):a.mozSlice?a.mozSlice(b,c):a.slice?eb&&!mb("13.0")||fb&&!mb("537.1")?(0>b&&(b+=a.size),0>b&&(b=0),0>c&&(c+=a.size),c<b&&(c=b),a.slice(b,c-b)):a.slice(b,c):null};var pb=function(a,b){return b},J=function(a,b,c,d){this.c=a;this.b=b||a;this.writable=!!c;this.a=d||pb},qb=null,rb=function(){if(qb)return qb;var a=[];a.push(new J("bucket"));a.push(new J("generation"));a.push(new J("metageneration"));a.push(new J("name","fullPath",!0));var b=new J("name");b.a=function(a,b){return!ta(b)||2>b.length?b:pa(b)};a.push(b);b=new J("size");b.a=function(a,b){return y(b)?+b:b};a.push(b);a.push(new J("timeCreated"));a.push(new J("updated"));a.push(new J("md5Hash",null,!0));
a.push(new J("cacheControl",null,!0));a.push(new J("contentDisposition",null,!0));a.push(new J("contentEncoding",null,!0));a.push(new J("contentLanguage",null,!0));a.push(new J("contentType",null,!0));a.push(new J("metadata","customMetadata",!0));a.push(new J("downloadTokens","downloadURLs",!1,function(a,b){if(!(ta(b)&&0<b.length))return[];var c=encodeURIComponent;return b.split(",").map(function(b){var d=a.fullPath,d="https://firebasestorage.googleapis.com/v0"+("/b/"+c(a.bucket)+"/o/"+c(d));b=Ja({alt:"media",
token:b});return d+b})}));return qb=a},sb=function(a,b){Object.defineProperty(a,"ref",{get:function(){return b.o(b,new D(a.bucket,a.fullPath))}})},tb=function(a,b){for(var c={},d=b.length,e=0;e<d;e++){var g=b[e];g.writable&&(c[g.c]=a[g.b])}return JSON.stringify(c)},ub=function(a){if(!a||"object"!==typeof a)throw"Expected Metadata object.";for(var b in a){var c=a[b];if("customMetadata"===b){if("object"!==typeof c)throw"Expected object for 'customMetadata' mapping.";}else if(null!=c&&"object"===typeof c)throw"Mapping for '"+
b+"' cannot be an object.";}};var K=function(a,b,c){for(var d=b.length,e=b.length,g=0;g<b.length;g++)if(b[g].b){d=g;break}if(!(d<=c.length&&c.length<=e))throw d===e?(b=d,d=1===d?"argument":"arguments"):(b="between "+d+" and "+e,d="arguments"),new u("invalid-argument-count","Invalid argument count in `"+a+"`: Expected "+b+" "+d+", received "+c.length+".");for(g=0;g<c.length;g++)try{b[g].a(c[g])}catch(f){if(f instanceof Error)throw ja(g,a,f.message);throw ja(g,a,f);}},L=function(a,b){var c=this;this.a=function(b){c.b&&!q(b)||a(b)};
this.b=!!b},vb=function(a,b){return function(c){a(c);b(c)}},M=function(a,b){function c(a){if(!("string"===typeof a||a instanceof String))throw"Expected string.";}var d;a?d=vb(c,a):d=c;return new L(d,b)},wb=function(){return new L(function(a){if(!(a instanceof Uint8Array||a instanceof ArrayBuffer||ua()&&a instanceof Blob))throw"Expected Blob or File.";})},xb=function(){return new L(function(a){if(!(("number"===typeof a||a instanceof Number)&&0<=a))throw"Expected a number 0 or greater.";})},yb=function(a,
b){return new L(function(b){if(!(null===b||y(b)&&b instanceof Object))throw"Expected an Object.";y(a)&&a(b)},b)},N=function(){return new L(function(a){if(null!==a&&"function"!=ea(a))throw"Expected a Function.";},!0)};var O=function(a,b){ua()&&a instanceof Blob?(this.i=a,b=a.size,a=a.type):(a instanceof ArrayBuffer?(b?this.i=new Uint8Array(a):(this.i=new Uint8Array(a.byteLength),this.i.set(new Uint8Array(a))),b=this.i.length):(b?this.i=a:(this.i=new Uint8Array(a.length),this.i.set(a)),b=a.length),a="");this.a=b;this.b=a};O.prototype.type=function(){return this.b};
O.prototype.slice=function(a,b){if(ua()&&this.i instanceof Blob)return a=ob(this.i,a,b),null===a?null:new O(a);a=new Uint8Array(this.i.buffer,a,b-a);return new O(a,!0)};
var zb=function(a){var b=[];Array.prototype.push.apply(b,arguments);if(ua())return b=b.map(function(a){return a instanceof O?a.i:a}),new O(nb.apply(null,b));var b=b.map(function(a){return ta(a)?Ia("raw",a).data.buffer:a.i.buffer}),c=0;b.forEach(function(a){c+=a.byteLength});var d=new Uint8Array(c),e=0;b.forEach(function(a){a=new Uint8Array(a);for(var b=0;b<a.length;b++)d[e++]=a[b]});return new O(d,!0)};var P=function(a){if(!a)throw ga();},Ab=function(a,b){return function(c,d){var e;a:{try{e=JSON.parse(d)}catch(h){e=null;break a}c=typeof e;e="object"==c&&null!=e||"function"==c?e:null}if(null===e)e=null;else{c={type:"file"};d=b.length;for(var g=0;g<d;g++){var f=b[g];c[f.b]=f.a(c,e[f.c])}sb(c,a);e=c}P(null!==e);return e}},Q=function(a){return function(b,c){b=401===F(b)?new u("unauthenticated","User is not authenticated, please authenticate using Firebase Authentication and try again."):402===F(b)?
new u("quota-exceeded","Quota for bucket '"+a.bucket+"' exceeded, please view quota on https://firebase.google.com/pricing/."):403===F(b)?new u("unauthorized","User does not have permission to access '"+a.path+"'."):c;b.serverResponse=c.serverResponse;return b}},Bb=function(a){var b=Q(a);return function(c,d){var e=b(c,d);404===F(c)&&(e=new u("object-not-found","Object '"+a.path+"' does not exist."));e.serverResponse=d.serverResponse;return e}},Cb=function(a,b,c){var d=za(b);a=new w(t+"/v0"+d,"GET",
Ab(a,c),a.c);a.a=Bb(b);return a},Db=function(a,b){var c=za(b);a=new w(t+"/v0"+c,"DELETE",function(){},a.c);a.c=[200,204];a.a=Bb(b);return a},Eb=function(a,b,c){c=c?na(c):{};c.fullPath=a.path;c.size=b.a;c.contentType||(a=b&&b.type()||"application/octet-stream",c.contentType=a);return c},Fb=function(a,b,c,d,e){var g="/b/"+encodeURIComponent(b.bucket)+"/o",f={"X-Goog-Upload-Protocol":"multipart"},h;h="";for(var p=0;2>p;p++)h+=Math.random().toString().slice(2);f["Content-Type"]="multipart/related; boundary="+
h;e=Eb(b,d,e);p=tb(e,c);d=zb("--"+h+"\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"+p+"\r\n--"+h+"\r\nContent-Type: "+e.contentType+"\r\n\r\n",d,"\r\n--"+h+"--");if(null===d)throw ia();a=new w(t+"/v0"+g,"POST",Ab(a,c),a.b);a.b={name:e.fullPath};a.headers=f;a.body=d.i;a.a=Q(b);return a},Gb=function(a,b,c,d){this.a=a;this.total=b;this.b=!!c;this.c=d||null},Hb=function(a,b){var c;try{c=a.a.getResponseHeader("X-Goog-Upload-Status")}catch(d){P(!1)}P(r(b||["active"],c));return c},Ib=function(a,
b,c,d,e){var g="/b/"+encodeURIComponent(b.bucket)+"/o",f=Eb(b,d,e);e={name:f.fullPath};g=t+"/v0"+g;d={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":d.a,"X-Goog-Upload-Header-Content-Type":f.contentType,"Content-Type":"application/json; charset=utf-8"};c=tb(f,c);a=new w(g,"POST",function(a){Hb(a);var b;try{b=a.a.getResponseHeader("X-Goog-Upload-URL")}catch(B){P(!1)}P(ta(b));return b},a.b);a.b=e;a.headers=d;a.body=c;a.a=Q(b);return a},Jb=
function(a,b,c,d){a=new w(c,"POST",function(a){var b=Hb(a,["active","final"]),c;try{c=a.a.getResponseHeader("X-Goog-Upload-Size-Received")}catch(h){P(!1)}a=c;isFinite(a)&&(a=String(a));a="string"==typeof a?/^\s*-?0x/i.test(a)?parseInt(a,16):parseInt(a,10):NaN;P(!isNaN(a));return new Gb(a,d.a,"final"===b)},a.b);a.headers={"X-Goog-Upload-Command":"query"};a.a=Q(b);a.f=!1;return a},Kb=function(a,b,c,d,e,g,f){var h=new Gb(0,0);f?(h.a=f.a,h.total=f.total):(h.a=0,h.total=d.a);if(d.a!==h.total)throw new u("server-file-wrong-size",
"Server recorded incorrect upload file size, please retry the upload.");var p=f=h.total-h.a;0<e&&(p=Math.min(p,e));var B=h.a;e={"X-Goog-Upload-Command":p===f?"upload, finalize":"upload","X-Goog-Upload-Offset":h.a};f=d.slice(B,B+p);if(null===f)throw ia();c=new w(c,"POST",function(a,c){var e=Hb(a,["active","final"]),f=h.a+p,C=d.a,z;"final"===e?z=Ab(b,g)(a,c):z=null;return new Gb(f,C,"final"===e,z)},b.b);c.headers=e;c.body=f.i;c.l=null;c.a=Q(a);c.f=!1;return c};var T=function(a,b,c,d,e,g){this.L=a;this.c=b;this.l=c;this.f=e;this.h=g||null;this.s=d;this.m=0;this.D=this.u=!1;this.B=[];this.S=262144<this.f.a;this.b="running";this.a=this.v=this.g=null;this.j=1;var f=this;this.F=function(a){f.a=null;f.j=1;"storage/canceled"===a.code?(f.u=!0,R(f)):(f.g=a,S(f,"error"))};this.P=function(a){f.a=null;"storage/canceled"===a.code?R(f):(f.g=a,S(f,"error"))};this.A=this.o=null;this.C=qa(function(a,b){f.o=a;f.A=b;Lb(f)});this.C.then(null,function(){})},Lb=function(a){"running"===
a.b&&null===a.a&&(a.S?null===a.v?Mb(a):a.u?Nb(a):a.D?Ob(a):Pb(a):Qb(a))},U=function(a,b){ab(a.c).then(function(c){switch(a.b){case "running":b(c);break;case "canceling":S(a,"canceled");break;case "pausing":S(a,"paused")}})},Mb=function(a){U(a,function(b){var c=Ib(a.c,a.l,a.s,a.f,a.h);a.a=I(a.c,c,b);a.a.a().then(function(b){a.a=null;a.v=b;a.u=!1;R(a)},this.F)})},Nb=function(a){var b=a.v;U(a,function(c){var d=Jb(a.c,a.l,b,a.f);a.a=I(a.c,d,c);a.a.a().then(function(b){a.a=null;Rb(a,b.a);a.u=!1;b.b&&(a.D=
!0);R(a)},a.F)})},Pb=function(a){var b=262144*a.j,c=new Gb(a.m,a.f.a),d=a.v;U(a,function(e){var g;try{g=Kb(a.l,a.c,d,a.f,b,a.s,c)}catch(f){a.g=f;S(a,"error");return}a.a=I(a.c,g,e);a.a.a().then(function(b){33554432>262144*a.j&&(a.j*=2);a.a=null;Rb(a,b.a);b.b?(a.h=b.c,S(a,"success")):R(a)},a.F)})},Ob=function(a){U(a,function(b){var c=Cb(a.c,a.l,a.s);a.a=I(a.c,c,b);a.a.a().then(function(b){a.a=null;a.h=b;S(a,"success")},a.P)})},Qb=function(a){U(a,function(b){var c=Fb(a.c,a.l,a.s,a.f,a.h);a.a=I(a.c,c,
b);a.a.a().then(function(b){a.a=null;a.h=b;Rb(a,a.f.a);S(a,"success")},a.F)})},Rb=function(a,b){var c=a.m;a.m=b;a.m>c&&V(a)},S=function(a,b){if(a.b!==b)switch(b){case "canceling":a.b=b;null!==a.a&&a.a.cancel();break;case "pausing":a.b=b;null!==a.a&&a.a.cancel();break;case "running":var c="paused"===a.b;a.b=b;c&&(V(a),Lb(a));break;case "paused":a.b=b;V(a);break;case "canceled":a.g=ha();a.b=b;V(a);break;case "error":a.b=b;V(a);break;case "success":a.b=b,V(a)}},R=function(a){switch(a.b){case "pausing":S(a,
"paused");break;case "canceling":S(a,"canceled");break;case "running":Lb(a)}};T.prototype.w=function(){return new G(this.m,this.f.a,sa(this.b),this.h,this,this.L)};
T.prototype.M=function(a,b,c,d){function e(a){try{f(a);return}catch(z){}try{if(h(a),!(q(a.next)||q(a.error)||q(a.complete)))throw"";}catch(z){throw"Expected a function or an Object with one of `next`, `error`, `complete` properties.";}}function g(a){return function(b,c,d){null!==a&&K("on",a,arguments);var e=new Ca(b,c,d);Sb(p,e);return function(){var a=p.B,b=a.indexOf(e);-1!==b&&a.splice(b,1)}}}var f=N().a,h=yb(null,!0).a;K("on",[M(function(){if("state_changed"!==a)throw"Expected one of the event types: [state_changed].";
}),yb(e,!0),N(),N()],arguments);var p=this,B=[yb(function(a){if(null===a)throw"Expected a function or an Object with one of `next`, `error`, `complete` properties.";e(a)}),N(),N()];return q(b)||q(c)||q(d)?g(null)(b,c,d):g(B)};T.prototype.then=function(a,b){return this.C.then(a,b)};T.prototype["catch"]=function(a){return this.then(null,a)};
var Sb=function(a,b){a.B.push(b);Tb(a,b)},V=function(a){Ub(a);Array.prototype.slice.call(a.B).forEach(function(b){Tb(a,b)})},Ub=function(a){if(null!==a.o){var b=!0;switch(sa(a.b)){case "success":A(a.o.bind(null,a.w()))();break;case "canceled":case "error":A(a.A.bind(null,a.g))();break;default:b=!1}b&&(a.o=null,a.A=null)}},Tb=function(a,b){switch(sa(a.b)){case "running":case "paused":null!==b.b&&A(b.b.bind(b,a.w()))();break;case "success":null!==b.a&&A(b.a.bind(b))();break;case "canceled":case "error":null!==
b.error&&A(b.error.bind(b,a.g))();break;default:null!==b.error&&A(b.error.bind(b,a.g))()}};T.prototype.O=function(){K("resume",[],arguments);var a="paused"===this.b||"pausing"===this.b;a&&S(this,"running");return a};T.prototype.N=function(){K("pause",[],arguments);var a="running"===this.b;a&&S(this,"pausing");return a};T.prototype.cancel=function(){K("cancel",[],arguments);var a="running"===this.b||"pausing"===this.b;a&&S(this,"canceling");return a};var W=function(a,b){this.a=a;this.location=b instanceof D?b:Aa(b)};W.prototype.toString=function(){K("toString",[],arguments);return"gs://"+this.location.bucket+"/"+this.location.path};var Vb=function(a,b){return new W(a,b)};k=W.prototype;k.H=function(a){K("child",[M()],arguments);var b=oa(this.location.path,a);return Vb(this.a,new D(this.location.bucket,b))};
k.ka=function(){var a;a=this.location.path;if(0==a.length)a=null;else{var b=a.lastIndexOf("/");a=-1===b?"":a.slice(0,b)}return null===a?null:Vb(this.a,new D(this.location.bucket,a))};k.ma=function(){return Vb(this.a,new D(this.location.bucket,""))};k.U=function(){return this.location.bucket};k.fa=function(){return this.location.path};k.ja=function(){return pa(this.location.path)};k.oa=function(){return this.a.l};
k.Z=function(a,b){K("put",[wb(),new L(ub,!0)],arguments);X(this,"put");return new T(this,this.a,this.location,rb(),new O(a),b)};k.$=function(a,b,c){K("putString",[M(),M(Da,!0),new L(ub,!0)],arguments);X(this,"putString");var d=Ia(y(b)?b:"raw",a),e=c?na(c):{};!y(e.contentType)&&y(d.a)&&(e.contentType=d.a);return new T(this,this.a,this.location,rb(),new O(d.data,!0),e)};
k.X=function(){K("delete",[],arguments);X(this,"delete");var a=this;return ab(this.a).then(function(b){var c=Db(a.a,a.location);return I(a.a,c,b).a()})};k.I=function(){K("getMetadata",[],arguments);X(this,"getMetadata");var a=this;return ab(this.a).then(function(b){var c=Cb(a.a,a.location,rb());return I(a.a,c,b).a()})};
k.aa=function(a){K("updateMetadata",[new L(ub,void 0)],arguments);X(this,"updateMetadata");var b=this;return ab(this.a).then(function(c){var d=b.a,e=b.location,g=a,f=rb(),h=za(e),h=t+"/v0"+h,g=tb(g,f),d=new w(h,"PATCH",Ab(d,f),d.c);d.headers={"Content-Type":"application/json; charset=utf-8"};d.body=g;d.a=Bb(e);return I(b.a,d,c).a()})};
k.Y=function(){K("getDownloadURL",[],arguments);X(this,"getDownloadURL");return this.I().then(function(a){a=a.downloadURLs[0];if(y(a))return a;throw new u("no-download-url","The given file does not have any download URLs.");})};var X=function(a,b){if(""===a.location.path)throw new u("invalid-root-operation","The operation '"+b+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').");};var Y=function(a,b,c){this.a=new $a(a,function(a,b){return new W(a,b)},Ua,this,b);this.c=a;q(c)?this.b=Ba(c):null!=this.a.bucket()&&(this.b=new D(this.a.bucket(),""));this.f=new Wb(this)};k=Y.prototype;k.ba=function(a){K("ref",[M(function(a){if(/^[A-Za-z]+:\/\//.test(a))throw"Expected child path but got a URL, use refFromURL instead.";},!0)],arguments);if(null===this.b)throw Error("No Storage Bucket defined in Firebase Options.");var b=new W(this.a,this.b);return q(a)?b.H(a):b};
k.ca=function(a){K("refFromURL",[M(function(a){if(!/^[A-Za-z]+:\/\//.test(a))throw"Expected full URL but got a child path, use ref instead.";try{Aa(a)}catch(c){throw"Expected valid full URL but got an invalid one.";}},!1)],arguments);return new W(this.a,a)};k.ha=function(){return this.a.b};k.ea=function(a){K("setMaxUploadRetryTime",[xb()],arguments);this.a.b=a};k.ga=function(){return this.a.c};k.da=function(a){K("setMaxOperationRetryTime",[xb()],arguments);this.a.c=a};k.T=function(){return this.c};
k.R=function(){return this.f};var Wb=function(a){this.a=a};Wb.prototype.b=function(){var a=this.a.a;a.f=!0;a.a=null;Za(a.h)};var Z=function(a,b,c){Object.defineProperty(a,b,{get:c})};W.prototype.toString=W.prototype.toString;W.prototype.child=W.prototype.H;W.prototype.put=W.prototype.Z;W.prototype.putString=W.prototype.$;W.prototype["delete"]=W.prototype.X;W.prototype.getMetadata=W.prototype.I;W.prototype.updateMetadata=W.prototype.aa;W.prototype.getDownloadURL=W.prototype.Y;Z(W.prototype,"parent",W.prototype.ka);Z(W.prototype,"root",W.prototype.ma);Z(W.prototype,"bucket",W.prototype.U);Z(W.prototype,"fullPath",W.prototype.fa);
Z(W.prototype,"name",W.prototype.ja);Z(W.prototype,"storage",W.prototype.oa);Y.prototype.ref=Y.prototype.ba;Y.prototype.refFromURL=Y.prototype.ca;Z(Y.prototype,"maxOperationRetryTime",Y.prototype.ga);Y.prototype.setMaxOperationRetryTime=Y.prototype.da;Z(Y.prototype,"maxUploadRetryTime",Y.prototype.ha);Y.prototype.setMaxUploadRetryTime=Y.prototype.ea;Z(Y.prototype,"app",Y.prototype.T);Z(Y.prototype,"INTERNAL",Y.prototype.R);Wb.prototype["delete"]=Wb.prototype.b;Y.prototype.capi_=function(a){t=a};
T.prototype.on=T.prototype.M;T.prototype.resume=T.prototype.O;T.prototype.pause=T.prototype.N;T.prototype.cancel=T.prototype.cancel;T.prototype.then=T.prototype.then;T.prototype["catch"]=T.prototype["catch"];Z(T.prototype,"snapshot",T.prototype.w);Z(G.prototype,"bytesTransferred",G.prototype.V);Z(G.prototype,"totalBytes",G.prototype.qa);Z(G.prototype,"state",G.prototype.na);Z(G.prototype,"metadata",G.prototype.ia);Z(G.prototype,"downloadURL",G.prototype.W);Z(G.prototype,"task",G.prototype.pa);
Z(G.prototype,"ref",G.prototype.la);ra.STATE_CHANGED="state_changed";x.RUNNING="running";x.PAUSED="paused";x.SUCCESS="success";x.CANCELED="canceled";x.ERROR="error";E.RAW="raw";E.BASE64="base64";E.BASE64URL="base64url";E.DATA_URL="data_url";
(function(){function a(a,b,e){return new Y(a,new Va,e)}var b={TaskState:x,TaskEvent:ra,StringFormat:E,Storage:Y,Reference:W};if("undefined"!==typeof firebase)firebase.INTERNAL.registerService("storage",a,b);else throw Error("Cannot install Firebase Storage - be sure to load firebase-app.js first.");})();}).call(this);

//! moment.js
//! version : 2.18.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

var hookCallback;

function hooks () {
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

function isObject(input) {
    // IE8 will treat undefined and null as object if it wasn't for
    // input != null
    return input != null && Object.prototype.toString.call(input) === '[object Object]';
}

function isObjectEmpty(obj) {
    var k;
    for (k in obj) {
        // even if its not own property I'd still call it non-empty
        return false;
    }
    return true;
}

function isUndefined(input) {
    return input === void 0;
}

function isNumber(input) {
    return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
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

function createUTC (input, format, locale, strict) {
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
        meridiem        : null,
        rfc2822         : false,
        weekdayMismatch : false
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

var some$1 = some;

function isValid(m) {
    if (m._isValid == null) {
        var flags = getParsingFlags(m);
        var parsedParts = some$1.call(flags.parsedDateParts, function (i) {
            return i != null;
        });
        var isNowValid = !isNaN(m._d.getTime()) &&
            flags.overflow < 0 &&
            !flags.empty &&
            !flags.invalidMonth &&
            !flags.invalidWeekday &&
            !flags.nullInput &&
            !flags.invalidFormat &&
            !flags.userInvalidated &&
            (!flags.meridiem || (flags.meridiem && parsedParts));

        if (m._strict) {
            isNowValid = isNowValid &&
                flags.charsLeftOver === 0 &&
                flags.unusedTokens.length === 0 &&
                flags.bigHour === undefined;
        }

        if (Object.isFrozen == null || !Object.isFrozen(m)) {
            m._isValid = isNowValid;
        }
        else {
            return isNowValid;
        }
    }
    return m._isValid;
}

function createInvalid (flags) {
    var m = createUTC(NaN);
    if (flags != null) {
        extend(getParsingFlags(m), flags);
    }
    else {
        getParsingFlags(m).userInvalidated = true;
    }

    return m;
}

// Plugins that add properties should also add the key here (null value),
// so we can properly clone ourselves.
var momentProperties = hooks.momentProperties = [];

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
        for (i = 0; i < momentProperties.length; i++) {
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
    if (!this.isValid()) {
        this._d = new Date(NaN);
    }
    // Prevent infinite loop in case updateOffset creates new moment
    // objects.
    if (updateInProgress === false) {
        updateInProgress = true;
        hooks.updateOffset(this);
        updateInProgress = false;
    }
}

function isMoment (obj) {
    return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
}

function absFloor (number) {
    if (number < 0) {
        // -0 -> 0
        return Math.ceil(number) || 0;
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
    if (hooks.suppressDeprecationWarnings === false &&
            (typeof console !==  'undefined') && console.warn) {
        console.warn('Deprecation warning: ' + msg);
    }
}

function deprecate(msg, fn) {
    var firstTime = true;

    return extend(function () {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(null, msg);
        }
        if (firstTime) {
            var args = [];
            var arg;
            for (var i = 0; i < arguments.length; i++) {
                arg = '';
                if (typeof arguments[i] === 'object') {
                    arg += '\n[' + i + '] ';
                    for (var key in arguments[0]) {
                        arg += key + ': ' + arguments[0][key] + ', ';
                    }
                    arg = arg.slice(0, -2); // Remove trailing comma and space
                } else {
                    arg = arguments[i];
                }
                args.push(arg);
            }
            warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
            firstTime = false;
        }
        return fn.apply(this, arguments);
    }, fn);
}

var deprecations = {};

function deprecateSimple(name, msg) {
    if (hooks.deprecationHandler != null) {
        hooks.deprecationHandler(name, msg);
    }
    if (!deprecations[name]) {
        warn(msg);
        deprecations[name] = true;
    }
}

hooks.suppressDeprecationWarnings = false;
hooks.deprecationHandler = null;

function isFunction(input) {
    return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
}

function set (config) {
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
    // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
    // TODO: Remove "ordinalParse" fallback in next major release.
    this._dayOfMonthOrdinalParseLenient = new RegExp(
        (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
            '|' + (/\d{1,2}/).source);
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
    for (prop in parentConfig) {
        if (hasOwnProp(parentConfig, prop) &&
                !hasOwnProp(childConfig, prop) &&
                isObject(parentConfig[prop])) {
            // make sure changes to properties don't modify parent config
            res[prop] = extend({}, res[prop]);
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

var keys$1 = keys;

var defaultCalendar = {
    sameDay : '[Today at] LT',
    nextDay : '[Tomorrow at] LT',
    nextWeek : 'dddd [at] LT',
    lastDay : '[Yesterday at] LT',
    lastWeek : '[Last] dddd [at] LT',
    sameElse : 'L'
};

function calendar (key, mom, now) {
    var output = this._calendar[key] || this._calendar['sameElse'];
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
var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

function ordinal (number) {
    return this._ordinal.replace('%d', number);
}

var defaultRelativeTime = {
    future : 'in %s',
    past   : '%s ago',
    s  : 'a few seconds',
    ss : '%d seconds',
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

function relativeTime (number, withoutSuffix, string, isFuture) {
    var output = this._relativeTime[string];
    return (isFunction(output)) ?
        output(number, withoutSuffix, string, isFuture) :
        output.replace(/%d/i, number);
}

function pastFuture (diff, output) {
    var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
    return isFunction(format) ? format(output) : format.replace(/%s/i, output);
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

var priorities = {};

function addUnitPriority(unit, priority) {
    priorities[unit] = priority;
}

function getPrioritizedUnits(unitsObj) {
    var units = [];
    for (var u in unitsObj) {
        units.push({unit: u, priority: priorities[u]});
    }
    units.sort(function (a, b) {
        return a.priority - b.priority;
    });
    return units;
}

function makeGetSet (unit, keepTime) {
    return function (value) {
        if (value != null) {
            set$1(this, unit, value);
            hooks.updateOffset(this, keepTime);
            return this;
        } else {
            return get(this, unit);
        }
    };
}

function get (mom, unit) {
    return mom.isValid() ?
        mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
}

function set$1 (mom, unit, value) {
    if (mom.isValid()) {
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
    }
}

// MOMENTS

function stringGet (units) {
    units = normalizeUnits(units);
    if (isFunction(this[units])) {
        return this[units]();
    }
    return this;
}


function stringSet (units, value) {
    if (typeof units === 'object') {
        units = normalizeObjectUnits(units);
        var prioritized = getPrioritizedUnits(units);
        for (var i = 0; i < prioritized.length; i++) {
            this[prioritized[i].unit](units[prioritized[i].unit]);
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
            output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
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
    if (isNumber(callback)) {
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

var indexOf$1 = indexOf;

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

// PRIORITY

addUnitPriority('month', 8);

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

var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
function localeMonths (m, format) {
    if (!m) {
        return isArray(this._months) ? this._months :
            this._months['standalone'];
    }
    return isArray(this._months) ? this._months[m.month()] :
        this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
}

var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
function localeMonthsShort (m, format) {
    if (!m) {
        return isArray(this._monthsShort) ? this._monthsShort :
            this._monthsShort['standalone'];
    }
    return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
        this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
}

function handleStrictParse(monthName, format, strict) {
    var i, ii, mom, llc = monthName.toLocaleLowerCase();
    if (!this._monthsParse) {
        // this is not used
        this._monthsParse = [];
        this._longMonthsParse = [];
        this._shortMonthsParse = [];
        for (i = 0; i < 12; ++i) {
            mom = createUTC([2000, i]);
            this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
            this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'MMM') {
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'MMM') {
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._longMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeMonthsParse (monthName, format, strict) {
    var i, mom, regex;

    if (this._monthsParseExact) {
        return handleStrictParse.call(this, monthName, format, strict);
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
        mom = createUTC([2000, i]);
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
            if (!isNumber(value)) {
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
        hooks.updateOffset(this, true);
        return this;
    } else {
        return get(this, 'Month');
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
        if (!hasOwnProp(this, '_monthsShortRegex')) {
            this._monthsShortRegex = defaultMonthsShortRegex;
        }
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
        if (!hasOwnProp(this, '_monthsRegex')) {
            this._monthsRegex = defaultMonthsRegex;
        }
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
        mom = createUTC([2000, i]);
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
    }
    for (i = 0; i < 24; i++) {
        mixedPieces[i] = regexEscape(mixedPieces[i]);
    }

    this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
    this._monthsShortRegex = this._monthsRegex;
    this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
    this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
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

// PRIORITIES

addUnitPriority('year', 1);

// PARSING

addRegexToken('Y',      matchSigned);
addRegexToken('YY',     match1to2, match2);
addRegexToken('YYYY',   match1to4, match4);
addRegexToken('YYYYY',  match1to6, match6);
addRegexToken('YYYYYY', match1to6, match6);

addParseToken(['YYYYY', 'YYYYYY'], YEAR);
addParseToken('YYYY', function (input, array) {
    array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
});
addParseToken('YY', function (input, array) {
    array[YEAR] = hooks.parseTwoDigitYear(input);
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

hooks.parseTwoDigitYear = function (input) {
    return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
};

// MOMENTS

var getSetYear = makeGetSet('FullYear', true);

function getIsLeapYear () {
    return isLeapYear(this.year());
}

function createDate (y, m, d, h, M, s, ms) {
    // can't just apply() to create a date:
    // https://stackoverflow.com/q/181348
    var date = new Date(y, m, d, h, M, s, ms);

    // the date constructor remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
        date.setFullYear(y);
    }
    return date;
}

function createUTCDate (y) {
    var date = new Date(Date.UTC.apply(null, arguments));

    // the Date.UTC function remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
        date.setUTCFullYear(y);
    }
    return date;
}

// start-of-first-week - start-of-year
function firstWeekOffset(year, dow, doy) {
    var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
        fwd = 7 + dow - doy,
        // first-week day local weekday -- which local weekday is fwd
        fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

    return -fwdlw + fwd - 1;
}

// https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
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

// FORMATTING

addFormatToken('w', ['ww', 2], 'wo', 'week');
addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

// ALIASES

addUnitAlias('week', 'w');
addUnitAlias('isoWeek', 'W');

// PRIORITIES

addUnitPriority('week', 5);
addUnitPriority('isoWeek', 5);

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

// PRIORITY
addUnitPriority('day', 11);
addUnitPriority('weekday', 11);
addUnitPriority('isoWeekday', 11);

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

function parseIsoWeekday(input, locale) {
    if (typeof input === 'string') {
        return locale.weekdaysParse(input) % 7 || 7;
    }
    return isNaN(input) ? null : input;
}

// LOCALES

var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
function localeWeekdays (m, format) {
    if (!m) {
        return isArray(this._weekdays) ? this._weekdays :
            this._weekdays['standalone'];
    }
    return isArray(this._weekdays) ? this._weekdays[m.day()] :
        this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
}

var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
function localeWeekdaysShort (m) {
    return (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
}

var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
function localeWeekdaysMin (m) {
    return (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
}

function handleStrictParse$1(weekdayName, format, strict) {
    var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._minWeekdaysParse = [];

        for (i = 0; i < 7; ++i) {
            mom = createUTC([2000, 1]).day(i);
            this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
            this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
            this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'dddd') {
            ii = indexOf$1.call(this._weekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'dddd') {
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeWeekdaysParse (weekdayName, format, strict) {
    var i, mom, regex;

    if (this._weekdaysParseExact) {
        return handleStrictParse$1.call(this, weekdayName, format, strict);
    }

    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._minWeekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._fullWeekdaysParse = [];
    }

    for (i = 0; i < 7; i++) {
        // make the regex if we don't have it already

        mom = createUTC([2000, 1]).day(i);
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

    if (input != null) {
        var weekday = parseIsoWeekday(input, this.localeData());
        return this.day(this.day() % 7 ? weekday : weekday - 7);
    } else {
        return this.day() || 7;
    }
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
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            this._weekdaysRegex = defaultWeekdaysRegex;
        }
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
        if (!hasOwnProp(this, '_weekdaysShortRegex')) {
            this._weekdaysShortRegex = defaultWeekdaysShortRegex;
        }
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
        if (!hasOwnProp(this, '_weekdaysMinRegex')) {
            this._weekdaysMinRegex = defaultWeekdaysMinRegex;
        }
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
        mom = createUTC([2000, 1]).day(i);
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

// PRIORITY
addUnitPriority('hour', 13);

// PARSING

function matchMeridiem (isStrict, locale) {
    return locale._meridiemParse;
}

addRegexToken('a',  matchMeridiem);
addRegexToken('A',  matchMeridiem);
addRegexToken('H',  match1to2);
addRegexToken('h',  match1to2);
addRegexToken('k',  match1to2);
addRegexToken('HH', match1to2, match2);
addRegexToken('hh', match1to2, match2);
addRegexToken('kk', match1to2, match2);

addRegexToken('hmm', match3to4);
addRegexToken('hmmss', match5to6);
addRegexToken('Hmm', match3to4);
addRegexToken('Hmmss', match5to6);

addParseToken(['H', 'HH'], HOUR);
addParseToken(['k', 'kk'], function (input, array, config) {
    var kInput = toInt(input);
    array[HOUR] = kInput === 24 ? 0 : kInput;
});
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

// months
// week
// weekdays
// meridiem
var baseConfig = {
    calendar: defaultCalendar,
    longDateFormat: defaultLongDateFormat,
    invalidDate: defaultInvalidDate,
    ordinal: defaultOrdinal,
    dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
    relativeTime: defaultRelativeTime,

    months: defaultLocaleMonths,
    monthsShort: defaultLocaleMonthsShort,

    week: defaultLocaleWeek,

    weekdays: defaultLocaleWeekdays,
    weekdaysMin: defaultLocaleWeekdaysMin,
    weekdaysShort: defaultLocaleWeekdaysShort,

    meridiemParse: defaultLocaleMeridiemParse
};

// internal storage for locale config files
var locales = {};
var localeFamilies = {};
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
            getSetGlobalLocale(oldLocale);
        } catch (e) { }
    }
    return locales[name];
}

// This function will load locale and then set the global locale.  If
// no arguments are passed in, it will simply return the current global
// locale key.
function getSetGlobalLocale (key, values) {
    var data;
    if (key) {
        if (isUndefined(values)) {
            data = getLocale(key);
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
        var parentConfig = baseConfig;
        config.abbr = name;
        if (locales[name] != null) {
            deprecateSimple('defineLocaleOverride',
                    'use moment.updateLocale(localeName, config) to change ' +
                    'an existing locale. moment.defineLocale(localeName, ' +
                    'config) should only be used for creating a new locale ' +
                    'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
            parentConfig = locales[name]._config;
        } else if (config.parentLocale != null) {
            if (locales[config.parentLocale] != null) {
                parentConfig = locales[config.parentLocale]._config;
            } else {
                if (!localeFamilies[config.parentLocale]) {
                    localeFamilies[config.parentLocale] = [];
                }
                localeFamilies[config.parentLocale].push({
                    name: name,
                    config: config
                });
                return null;
            }
        }
        locales[name] = new Locale(mergeConfigs(parentConfig, config));

        if (localeFamilies[name]) {
            localeFamilies[name].forEach(function (x) {
                defineLocale(x.name, x.config);
            });
        }

        // backwards compat for now: also set the locale
        // make sure we set the locale AFTER all child locales have been
        // created, so we won't end up with the child locale set.
        getSetGlobalLocale(name);


        return locales[name];
    } else {
        // useful for testing
        delete locales[name];
        return null;
    }
}

function updateLocale(name, config) {
    if (config != null) {
        var locale, parentConfig = baseConfig;
        // MERGE
        if (locales[name] != null) {
            parentConfig = locales[name]._config;
        }
        config = mergeConfigs(parentConfig, config);
        locale = new Locale(config);
        locale.parentLocale = locales[name];
        locales[name] = locale;

        // backwards compat for now: also set the locale
        getSetGlobalLocale(name);
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
function getLocale (key) {
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

function listLocales() {
    return keys$1(locales);
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
var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

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

// RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
var basicRfcRegex = /^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d?\d\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(?:\d\d)?\d\d\s)(\d\d:\d\d)(\:\d\d)?(\s(?:UT|GMT|[ECMP][SD]T|[A-IK-Za-ik-z]|[+-]\d{4}))$/;

// date and time from ref 2822 format
function configFromRFC2822(config) {
    var string, match, dayFormat,
        dateFormat, timeFormat, tzFormat;
    var timezones = {
        ' GMT': ' +0000',
        ' EDT': ' -0400',
        ' EST': ' -0500',
        ' CDT': ' -0500',
        ' CST': ' -0600',
        ' MDT': ' -0600',
        ' MST': ' -0700',
        ' PDT': ' -0700',
        ' PST': ' -0800'
    };
    var military = 'YXWVUTSRQPONZABCDEFGHIKLM';
    var timezone, timezoneIndex;

    string = config._i
        .replace(/\([^\)]*\)|[\n\t]/g, ' ') // Remove comments and folding whitespace
        .replace(/(\s\s+)/g, ' ') // Replace multiple-spaces with a single space
        .replace(/^\s|\s$/g, ''); // Remove leading and trailing spaces
    match = basicRfcRegex.exec(string);

    if (match) {
        dayFormat = match[1] ? 'ddd' + ((match[1].length === 5) ? ', ' : ' ') : '';
        dateFormat = 'D MMM ' + ((match[2].length > 10) ? 'YYYY ' : 'YY ');
        timeFormat = 'HH:mm' + (match[4] ? ':ss' : '');

        // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
        if (match[1]) { // day of week given
            var momentDate = new Date(match[2]);
            var momentDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][momentDate.getDay()];

            if (match[1].substr(0,3) !== momentDay) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return;
            }
        }

        switch (match[5].length) {
            case 2: // military
                if (timezoneIndex === 0) {
                    timezone = ' +0000';
                } else {
                    timezoneIndex = military.indexOf(match[5][1].toUpperCase()) - 12;
                    timezone = ((timezoneIndex < 0) ? ' -' : ' +') +
                        (('' + timezoneIndex).replace(/^-?/, '0')).match(/..$/)[0] + '00';
                }
                break;
            case 4: // Zone
                timezone = timezones[match[5]];
                break;
            default: // UT or +/-9999
                timezone = timezones[' GMT'];
        }
        match[5] = timezone;
        config._i = match.splice(1).join('');
        tzFormat = ' ZZ';
        config._f = dayFormat + dateFormat + timeFormat + tzFormat;
        configFromStringAndFormat(config);
        getParsingFlags(config).rfc2822 = true;
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
    } else {
        return;
    }

    configFromRFC2822(config);
    if (config._isValid === false) {
        delete config._isValid;
    } else {
        return;
    }

    // Final attempt, use Input Fallback
    hooks.createFromInputFallback(config);
}

hooks.createFromInputFallback = deprecate(
    'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
    'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
    'discouraged and will be removed in an upcoming major release. Please refer to ' +
    'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
    function (config) {
        config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
    }
);

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
    var nowValue = new Date(hooks.now());
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
    if (config._dayOfYear != null) {
        yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

        if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
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
        weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
        week = defaults(w.W, 1);
        weekday = defaults(w.E, 1);
        if (weekday < 1 || weekday > 7) {
            weekdayOverflow = true;
        }
    } else {
        dow = config._locale._week.dow;
        doy = config._locale._week.doy;

        var curWeek = weekOfYear(createLocal(), dow, doy);

        weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

        // Default to current week.
        week = defaults(w.w, curWeek.week);

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
hooks.ISO_8601 = function () {};

// constant that refers to the RFC 2822 form
hooks.RFC_2822 = function () {};

// date from string and format string
function configFromStringAndFormat(config) {
    // TODO: Move this to another part of the creation flow to prevent circular deps
    if (config._f === hooks.ISO_8601) {
        configFromISO(config);
        return;
    }
    if (config._f === hooks.RFC_2822) {
        configFromRFC2822(config);
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
    if (config._a[HOUR] <= 12 &&
        getParsingFlags(config).bigHour === true &&
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

        if (!isValid(tempConfig)) {
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

    config._locale = config._locale || getLocale(config._l);

    if (input === null || (format === undefined && input === '')) {
        return createInvalid({nullInput: true});
    }

    if (typeof input === 'string') {
        config._i = input = config._locale.preparse(input);
    }

    if (isMoment(input)) {
        return new Moment(checkOverflow(input));
    } else if (isDate(input)) {
        config._d = input;
    } else if (isArray(format)) {
        configFromStringAndArray(config);
    } else if (format) {
        configFromStringAndFormat(config);
    }  else {
        configFromInput(config);
    }

    if (!isValid(config)) {
        config._d = null;
    }

    return config;
}

function configFromInput(config) {
    var input = config._i;
    if (isUndefined(input)) {
        config._d = new Date(hooks.now());
    } else if (isDate(input)) {
        config._d = new Date(input.valueOf());
    } else if (typeof input === 'string') {
        configFromString(config);
    } else if (isArray(input)) {
        config._a = map(input.slice(0), function (obj) {
            return parseInt(obj, 10);
        });
        configFromArray(config);
    } else if (isObject(input)) {
        configFromObject(config);
    } else if (isNumber(input)) {
        // from milliseconds
        config._d = new Date(input);
    } else {
        hooks.createFromInputFallback(config);
    }
}

function createLocalOrUTC (input, format, locale, strict, isUTC) {
    var c = {};

    if (locale === true || locale === false) {
        strict = locale;
        locale = undefined;
    }

    if ((isObject(input) && isObjectEmpty(input)) ||
            (isArray(input) && input.length === 0)) {
        input = undefined;
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

function createLocal (input, format, locale, strict) {
    return createLocalOrUTC(input, format, locale, strict, false);
}

var prototypeMin = deprecate(
    'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other < this ? this : other;
        } else {
            return createInvalid();
        }
    }
);

var prototypeMax = deprecate(
    'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other > this ? this : other;
        } else {
            return createInvalid();
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
        return createLocal();
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

var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

function isDurationValid(m) {
    for (var key in m) {
        if (!(ordering.indexOf(key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
            return false;
        }
    }

    var unitHasDecimal = false;
    for (var i = 0; i < ordering.length; ++i) {
        if (m[ordering[i]]) {
            if (unitHasDecimal) {
                return false; // only allow non-integers for smallest unit
            }
            if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                unitHasDecimal = true;
            }
        }
    }

    return true;
}

function isValid$1() {
    return this._isValid;
}

function createInvalid$1() {
    return createDuration(NaN);
}

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

    this._isValid = isDurationValid(normalizedInput);

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

    this._locale = getLocale();

    this._bubble();
}

function isDuration (obj) {
    return obj instanceof Duration;
}

function absRound (number) {
    if (number < 0) {
        return Math.round(-1 * number) * -1;
    } else {
        return Math.round(number);
    }
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
    var matches = (string || '').match(matcher);

    if (matches === null) {
        return null;
    }

    var chunk   = matches[matches.length - 1] || [];
    var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
    var minutes = +(parts[1] * 60) + toInt(parts[2]);

    return minutes === 0 ?
      0 :
      parts[0] === '+' ? minutes : -minutes;
}

// Return a moment from input, that is local/utc/zone equivalent to model.
function cloneWithOffset(input, model) {
    var res, diff;
    if (model._isUTC) {
        res = model.clone();
        diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
        // Use low-level api, because this fn is low-level api.
        res._d.setTime(res._d.valueOf() + diff);
        hooks.updateOffset(res, false);
        return res;
    } else {
        return createLocal(input).local();
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
hooks.updateOffset = function () {};

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
function getSetOffset (input, keepLocalTime, keepMinutes) {
    var offset = this._offset || 0,
        localAdjust;
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    if (input != null) {
        if (typeof input === 'string') {
            input = offsetFromString(matchShortOffset, input);
            if (input === null) {
                return this;
            }
        } else if (Math.abs(input) < 16 && !keepMinutes) {
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
                addSubtract(this, createDuration(input - offset, 'm'), 1, false);
            } else if (!this._changeInProgress) {
                this._changeInProgress = true;
                hooks.updateOffset(this, true);
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
    if (this._tzm != null) {
        this.utcOffset(this._tzm, false, true);
    } else if (typeof this._i === 'string') {
        var tZone = offsetFromString(matchOffset, this._i);
        if (tZone != null) {
            this.utcOffset(tZone);
        }
        else {
            this.utcOffset(0, true);
        }
    }
    return this;
}

function hasAlignedHourOffset (input) {
    if (!this.isValid()) {
        return false;
    }
    input = input ? createLocal(input).utcOffset() : 0;

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
        var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
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
var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

// from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
// somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
// and further modified to allow for strings containing both week and day
var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

function createDuration (input, key) {
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
    } else if (isNumber(input)) {
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
            d  : toInt(match[DATE])                         * sign,
            h  : toInt(match[HOUR])                         * sign,
            m  : toInt(match[MINUTE])                       * sign,
            s  : toInt(match[SECOND])                       * sign,
            ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
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
        diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

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

createDuration.fn = Duration.prototype;
createDuration.invalid = createInvalid$1;

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

// TODO: remove 'name' arg after deprecation is removed
function createAdder(direction, name) {
    return function (val, period) {
        var dur, tmp;
        //invert the arguments, but complain about it
        if (period !== null && !isNaN(+period)) {
            deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
            'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
            tmp = val; val = period; period = tmp;
        }

        val = typeof val === 'string' ? +val : val;
        dur = createDuration(val, period);
        addSubtract(this, dur, direction);
        return this;
    };
}

function addSubtract (mom, duration, isAdding, updateOffset) {
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
        set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
    }
    if (months) {
        setMonth(mom, get(mom, 'Month') + months * isAdding);
    }
    if (updateOffset) {
        hooks.updateOffset(mom, days || months);
    }
}

var add      = createAdder(1, 'add');
var subtract = createAdder(-1, 'subtract');

function getCalendarFormat(myMoment, now) {
    var diff = myMoment.diff(now, 'days', true);
    return diff < -6 ? 'sameElse' :
            diff < -1 ? 'lastWeek' :
            diff < 0 ? 'lastDay' :
            diff < 1 ? 'sameDay' :
            diff < 2 ? 'nextDay' :
            diff < 7 ? 'nextWeek' : 'sameElse';
}

function calendar$1 (time, formats) {
    // We want to compare the start of today, vs this.
    // Getting start-of-today depends on whether we're local/utc/offset or not.
    var now = time || createLocal(),
        sod = cloneWithOffset(now, this).startOf('day'),
        format = hooks.calendarFormat(this, sod) || 'sameElse';

    var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

    return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
}

function clone () {
    return new Moment(this);
}

function isAfter (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input);
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
    var localInput = isMoment(input) ? input : createLocal(input);
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
    var localInput = isMoment(input) ? input : createLocal(input),
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

hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

function toString () {
    return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
}

function toISOString() {
    if (!this.isValid()) {
        return null;
    }
    var m = this.clone().utc();
    if (m.year() < 0 || m.year() > 9999) {
        return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    }
    if (isFunction(Date.prototype.toISOString)) {
        // native implementation is ~50x faster, use it when we can
        return this.toDate().toISOString();
    }
    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
}

/**
 * Return a human readable representation of a moment that can
 * also be evaluated to get a new moment which is the same
 *
 * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
 */
function inspect () {
    if (!this.isValid()) {
        return 'moment.invalid(/* ' + this._i + ' */)';
    }
    var func = 'moment';
    var zone = '';
    if (!this.isLocal()) {
        func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
        zone = 'Z';
    }
    var prefix = '[' + func + '("]';
    var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
    var datetime = '-MM-DD[T]HH:mm:ss.SSS';
    var suffix = zone + '[")]';

    return this.format(prefix + year + datetime + suffix);
}

function format (inputString) {
    if (!inputString) {
        inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
    }
    var output = formatMoment(this, inputString);
    return this.localeData().postformat(output);
}

function from (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function fromNow (withoutSuffix) {
    return this.from(createLocal(), withoutSuffix);
}

function to (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function toNow (withoutSuffix) {
    return this.to(createLocal(), withoutSuffix);
}

// If passed a locale key, it will set the locale for this
// instance.  Otherwise, it will return the locale configuration
// variables for this instance.
function locale (key) {
    var newLocaleData;

    if (key === undefined) {
        return this._locale._abbr;
    } else {
        newLocaleData = getLocale(key);
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

function valueOf () {
    return this._d.valueOf() - ((this._offset || 0) * 60000);
}

function unix () {
    return Math.floor(this.valueOf() / 1000);
}

function toDate () {
    return new Date(this.valueOf());
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

function isValid$2 () {
    return isValid(this);
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

// PRIORITY

addUnitPriority('weekYear', 1);
addUnitPriority('isoWeekYear', 1);


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
    week[token] = hooks.parseTwoDigitYear(input);
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

// PRIORITY

addUnitPriority('quarter', 7);

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

addFormatToken('D', ['DD', 2], 'Do', 'date');

// ALIASES

addUnitAlias('date', 'D');

// PRIOROITY
addUnitPriority('date', 9);

// PARSING

addRegexToken('D',  match1to2);
addRegexToken('DD', match1to2, match2);
addRegexToken('Do', function (isStrict, locale) {
    // TODO: Remove "ordinalParse" fallback in next major release.
    return isStrict ?
      (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
      locale._dayOfMonthOrdinalParseLenient;
});

addParseToken(['D', 'DD'], DATE);
addParseToken('Do', function (input, array) {
    array[DATE] = toInt(input.match(match1to2)[0], 10);
});

// MOMENTS

var getSetDayOfMonth = makeGetSet('Date', true);

// FORMATTING

addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

// ALIASES

addUnitAlias('dayOfYear', 'DDD');

// PRIORITY
addUnitPriority('dayOfYear', 4);

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

addFormatToken('m', ['mm', 2], 0, 'minute');

// ALIASES

addUnitAlias('minute', 'm');

// PRIORITY

addUnitPriority('minute', 14);

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

// PRIORITY

addUnitPriority('second', 15);

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

// PRIORITY

addUnitPriority('millisecond', 16);

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

var proto = Moment.prototype;

proto.add               = add;
proto.calendar          = calendar$1;
proto.clone             = clone;
proto.diff              = diff;
proto.endOf             = endOf;
proto.format            = format;
proto.from              = from;
proto.fromNow           = fromNow;
proto.to                = to;
proto.toNow             = toNow;
proto.get               = stringGet;
proto.invalidAt         = invalidAt;
proto.isAfter           = isAfter;
proto.isBefore          = isBefore;
proto.isBetween         = isBetween;
proto.isSame            = isSame;
proto.isSameOrAfter     = isSameOrAfter;
proto.isSameOrBefore    = isSameOrBefore;
proto.isValid           = isValid$2;
proto.lang              = lang;
proto.locale            = locale;
proto.localeData        = localeData;
proto.max               = prototypeMax;
proto.min               = prototypeMin;
proto.parsingFlags      = parsingFlags;
proto.set               = stringSet;
proto.startOf           = startOf;
proto.subtract          = subtract;
proto.toArray           = toArray;
proto.toObject          = toObject;
proto.toDate            = toDate;
proto.toISOString       = toISOString;
proto.inspect           = inspect;
proto.toJSON            = toJSON;
proto.toString          = toString;
proto.unix              = unix;
proto.valueOf           = valueOf;
proto.creationData      = creationData;

// Year
proto.year       = getSetYear;
proto.isLeapYear = getIsLeapYear;

// Week Year
proto.weekYear    = getSetWeekYear;
proto.isoWeekYear = getSetISOWeekYear;

// Quarter
proto.quarter = proto.quarters = getSetQuarter;

// Month
proto.month       = getSetMonth;
proto.daysInMonth = getDaysInMonth;

// Week
proto.week           = proto.weeks        = getSetWeek;
proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
proto.weeksInYear    = getWeeksInYear;
proto.isoWeeksInYear = getISOWeeksInYear;

// Day
proto.date       = getSetDayOfMonth;
proto.day        = proto.days             = getSetDayOfWeek;
proto.weekday    = getSetLocaleDayOfWeek;
proto.isoWeekday = getSetISODayOfWeek;
proto.dayOfYear  = getSetDayOfYear;

// Hour
proto.hour = proto.hours = getSetHour;

// Minute
proto.minute = proto.minutes = getSetMinute;

// Second
proto.second = proto.seconds = getSetSecond;

// Millisecond
proto.millisecond = proto.milliseconds = getSetMillisecond;

// Offset
proto.utcOffset            = getSetOffset;
proto.utc                  = setOffsetToUTC;
proto.local                = setOffsetToLocal;
proto.parseZone            = setOffsetToParsedOffset;
proto.hasAlignedHourOffset = hasAlignedHourOffset;
proto.isDST                = isDaylightSavingTime;
proto.isLocal              = isLocal;
proto.isUtcOffset          = isUtcOffset;
proto.isUtc                = isUtc;
proto.isUTC                = isUtc;

// Timezone
proto.zoneAbbr = getZoneAbbr;
proto.zoneName = getZoneName;

// Deprecations
proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

function createUnix (input) {
    return createLocal(input * 1000);
}

function createInZone () {
    return createLocal.apply(null, arguments).parseZone();
}

function preParsePostFormat (string) {
    return string;
}

var proto$1 = Locale.prototype;

proto$1.calendar        = calendar;
proto$1.longDateFormat  = longDateFormat;
proto$1.invalidDate     = invalidDate;
proto$1.ordinal         = ordinal;
proto$1.preparse        = preParsePostFormat;
proto$1.postformat      = preParsePostFormat;
proto$1.relativeTime    = relativeTime;
proto$1.pastFuture      = pastFuture;
proto$1.set             = set;

// Month
proto$1.months            =        localeMonths;
proto$1.monthsShort       =        localeMonthsShort;
proto$1.monthsParse       =        localeMonthsParse;
proto$1.monthsRegex       = monthsRegex;
proto$1.monthsShortRegex  = monthsShortRegex;

// Week
proto$1.week = localeWeek;
proto$1.firstDayOfYear = localeFirstDayOfYear;
proto$1.firstDayOfWeek = localeFirstDayOfWeek;

// Day of Week
proto$1.weekdays       =        localeWeekdays;
proto$1.weekdaysMin    =        localeWeekdaysMin;
proto$1.weekdaysShort  =        localeWeekdaysShort;
proto$1.weekdaysParse  =        localeWeekdaysParse;

proto$1.weekdaysRegex       =        weekdaysRegex;
proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

// Hours
proto$1.isPM = localeIsPM;
proto$1.meridiem = localeMeridiem;

function get$1 (format, index, field, setter) {
    var locale = getLocale();
    var utc = createUTC().set(setter, index);
    return locale[field](utc, format);
}

function listMonthsImpl (format, index, field) {
    if (isNumber(format)) {
        index = format;
        format = undefined;
    }

    format = format || '';

    if (index != null) {
        return get$1(format, index, field, 'month');
    }

    var i;
    var out = [];
    for (i = 0; i < 12; i++) {
        out[i] = get$1(format, i, field, 'month');
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
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    } else {
        format = localeSorted;
        index = format;
        localeSorted = false;

        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    }

    var locale = getLocale(),
        shift = localeSorted ? locale._week.dow : 0;

    if (index != null) {
        return get$1(format, (index + shift) % 7, field, 'day');
    }

    var i;
    var out = [];
    for (i = 0; i < 7; i++) {
        out[i] = get$1(format, (i + shift) % 7, field, 'day');
    }
    return out;
}

function listMonths (format, index) {
    return listMonthsImpl(format, index, 'months');
}

function listMonthsShort (format, index) {
    return listMonthsImpl(format, index, 'monthsShort');
}

function listWeekdays (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
}

function listWeekdaysShort (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
}

function listWeekdaysMin (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
}

getSetGlobalLocale('en', {
    dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
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
hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

var mathAbs = Math.abs;

function abs () {
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

function addSubtract$1 (duration, input, value, direction) {
    var other = createDuration(input, value);

    duration._milliseconds += direction * other._milliseconds;
    duration._days         += direction * other._days;
    duration._months       += direction * other._months;

    return duration._bubble();
}

// supports only 2.0-style add(1, 's') or add(duration)
function add$1 (input, value) {
    return addSubtract$1(this, input, value, 1);
}

// supports only 2.0-style subtract(1, 's') or subtract(duration)
function subtract$1 (input, value) {
    return addSubtract$1(this, input, value, -1);
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
    if (!this.isValid()) {
        return NaN;
    }
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
function valueOf$1 () {
    if (!this.isValid()) {
        return NaN;
    }
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

function get$2 (units) {
    units = normalizeUnits(units);
    return this.isValid() ? this[units + 's']() : NaN;
}

function makeGetter(name) {
    return function () {
        return this.isValid() ? this._data[name] : NaN;
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
    ss: 44,         // a few seconds to seconds
    s : 45,         // seconds to minute
    m : 45,         // minutes to hour
    h : 22,         // hours to day
    d : 26,         // days to month
    M : 11          // months to year
};

// helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
    return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
}

function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
    var duration = createDuration(posNegDuration).abs();
    var seconds  = round(duration.as('s'));
    var minutes  = round(duration.as('m'));
    var hours    = round(duration.as('h'));
    var days     = round(duration.as('d'));
    var months   = round(duration.as('M'));
    var years    = round(duration.as('y'));

    var a = seconds <= thresholds.ss && ['s', seconds]  ||
            seconds < thresholds.s   && ['ss', seconds] ||
            minutes <= 1             && ['m']           ||
            minutes < thresholds.m   && ['mm', minutes] ||
            hours   <= 1             && ['h']           ||
            hours   < thresholds.h   && ['hh', hours]   ||
            days    <= 1             && ['d']           ||
            days    < thresholds.d   && ['dd', days]    ||
            months  <= 1             && ['M']           ||
            months  < thresholds.M   && ['MM', months]  ||
            years   <= 1             && ['y']           || ['yy', years];

    a[2] = withoutSuffix;
    a[3] = +posNegDuration > 0;
    a[4] = locale;
    return substituteTimeAgo.apply(null, a);
}

// This function allows you to set the rounding function for relative time strings
function getSetRelativeTimeRounding (roundingFunction) {
    if (roundingFunction === undefined) {
        return round;
    }
    if (typeof(roundingFunction) === 'function') {
        round = roundingFunction;
        return true;
    }
    return false;
}

// This function allows you to set a threshold for relative time strings
function getSetRelativeTimeThreshold (threshold, limit) {
    if (thresholds[threshold] === undefined) {
        return false;
    }
    if (limit === undefined) {
        return thresholds[threshold];
    }
    thresholds[threshold] = limit;
    if (threshold === 's') {
        thresholds.ss = limit - 1;
    }
    return true;
}

function humanize (withSuffix) {
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var locale = this.localeData();
    var output = relativeTime$1(this, !withSuffix, locale);

    if (withSuffix) {
        output = locale.pastFuture(+this, output);
    }

    return locale.postformat(output);
}

var abs$1 = Math.abs;

function toISOString$1() {
    // for ISO strings we do not use the normal bubbling rules:
    //  * milliseconds bubble up until they become hours
    //  * days do not bubble at all
    //  * months bubble up until they become years
    // This is because there is no context-free conversion between hours and days
    // (think of clock changes)
    // and also not between days and months (28-31 days per month)
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var seconds = abs$1(this._milliseconds) / 1000;
    var days         = abs$1(this._days);
    var months       = abs$1(this._months);
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

var proto$2 = Duration.prototype;

proto$2.isValid        = isValid$1;
proto$2.abs            = abs;
proto$2.add            = add$1;
proto$2.subtract       = subtract$1;
proto$2.as             = as;
proto$2.asMilliseconds = asMilliseconds;
proto$2.asSeconds      = asSeconds;
proto$2.asMinutes      = asMinutes;
proto$2.asHours        = asHours;
proto$2.asDays         = asDays;
proto$2.asWeeks        = asWeeks;
proto$2.asMonths       = asMonths;
proto$2.asYears        = asYears;
proto$2.valueOf        = valueOf$1;
proto$2._bubble        = bubble;
proto$2.get            = get$2;
proto$2.milliseconds   = milliseconds;
proto$2.seconds        = seconds;
proto$2.minutes        = minutes;
proto$2.hours          = hours;
proto$2.days           = days;
proto$2.weeks          = weeks;
proto$2.months         = months;
proto$2.years          = years;
proto$2.humanize       = humanize;
proto$2.toISOString    = toISOString$1;
proto$2.toString       = toISOString$1;
proto$2.toJSON         = toISOString$1;
proto$2.locale         = locale;
proto$2.localeData     = localeData;

// Deprecations
proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
proto$2.lang = lang;

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


hooks.version = '2.18.0';

setHookCallback(createLocal);

hooks.fn                    = proto;
hooks.min                   = min;
hooks.max                   = max;
hooks.now                   = now;
hooks.utc                   = createUTC;
hooks.unix                  = createUnix;
hooks.months                = listMonths;
hooks.isDate                = isDate;
hooks.locale                = getSetGlobalLocale;
hooks.invalid               = createInvalid;
hooks.duration              = createDuration;
hooks.isMoment              = isMoment;
hooks.weekdays              = listWeekdays;
hooks.parseZone             = createInZone;
hooks.localeData            = getLocale;
hooks.isDuration            = isDuration;
hooks.monthsShort           = listMonthsShort;
hooks.weekdaysMin           = listWeekdaysMin;
hooks.defineLocale          = defineLocale;
hooks.updateLocale          = updateLocale;
hooks.locales               = listLocales;
hooks.weekdaysShort         = listWeekdaysShort;
hooks.normalizeUnits        = normalizeUnits;
hooks.relativeTimeRounding = getSetRelativeTimeRounding;
hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
hooks.calendarFormat        = getCalendarFormat;
hooks.prototype             = proto;

return hooks;

})));

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
      options.environment = 'production';
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
    if (this.channelId == null) {
      this.channelId = options.channelId;
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
    if (options.environment == null) {
      options.environment = 'production';
    }
    this.options = options;
    this.channelChannelUrl = this.options.endPoint + "/api/subscribe/channel/" + this.options.channelId + "/" + this.options.environment;
    this.appChannelUrl = this.options.endPoint + "/api/subscribe/app/" + this.options.appId + "/" + this.options.environment;
    this.subscribersUrl = this.options.endPoint + "/api/subscribers/" + this.options.channelId + "/" + this.options.environment;
    this.notificationsUrl = this.options.endPoint + "/api/subscribe/ntf/" + this.options.accountId;
    this.signalUrl = this.options.endPoint + "/api/events/" + this.options.channelId;
    this.recentsUrl = this.options.endPoint + "/api/events/" + this.options.channelId + "/{environment}/recents";
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
      request.url = this.channelChannelUrl;
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
    request.onOpen = (function(_this) {
      return function(response) {
        if (_this.options.onOpen != null) {
          _this.options.onOpen(response);
        }
        return console.log("Binnacle connected using " + response.transport);
      };
    })(this);
    request.onError = (function(_this) {
      return function(response) {
        if (_this.options.onError != null) {
          _this.options.onError(response);
        }
        return console.log("Sorry, but there's some problem with your socket or the Binnacle server is down");
      };
    })(this);
    request.onMessage = (function(_this) {
      return function(response) {
        var e, error, i, json, len, message, messageAsString, messages, payload;
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
        } catch (error) {
          e = error;
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

var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.PushSubscription = (function() {
  function PushSubscription(options) {
    if (options.subscriptionType == null) {
      options.subscriptionType = 'firebase';
    }
    if (options.kvm == null) {
      options.kvm = {};
    }
    if (this.channelId == null) {
      this.channelId = options.channelId;
    }
    if (this.subscriptionType == null) {
      this.subscriptionType = options.subscriptionType;
    }
    if (this.userIdentifier == null) {
      this.userIdentifier = options.userIdentifier;
    }
    if (this.ipAddress == null) {
      this.ipAddress = options.ipAddress;
    }
    if (this.token == null) {
      this.token = options.token;
    }
    if (this.kvm == null) {
      this.kvm = options.kvm;
    }
  }

  return PushSubscription;

})();

Binnacle.WebPushClient = (function() {
  var isTokenSentToServer, setTokenSentToServer;

  function WebPushClient(options) {
    var base, base1, base2, base3, base4, base5, base6, base7, base8;
    this.options = options;
    if ((base = this.options).onMessage == null) {
      base.onMessage = function(payload) {};
    }
    if ((base1 = this.options).onTokenRefresh == null) {
      base1.onTokenRefresh = function() {};
    }
    if ((base2 = this.options).onBeforePermissionRequest == null) {
      base2.onBeforePermissionRequest = function() {};
    }
    if ((base3 = this.options).onPermissionGranted == null) {
      base3.onPermissionGranted = function() {};
    }
    if ((base4 = this.options).onPermissionFailed == null) {
      base4.onPermissionFailed = function() {};
    }
    if ((base5 = this.options).onTokenDeleted == null) {
      base5.onTokenDeleted = function() {};
    }
    if ((base6 = this.options).onErrorDeletingToken == null) {
      base6.onErrorDeletingToken = function() {};
    }
    if ((base7 = this.options).onErrorRetrievingToken == null) {
      base7.onErrorRetrievingToken = function() {};
    }
    if ((base8 = this.options).onErrorRetrievingRefreshedToken == null) {
      base8.onErrorRetrievingRefreshedToken = function() {};
    }
    this.webPushTokenRegistrationUrl = this.options.endPoint + "/api/push-subscriptions/" + this.options.channelId;
  }

  WebPushClient.prototype.subscribe = function() {
    if (!this.messaging) {
      this.initialize();
    }
    return this.getTokenAndSubscribe();
  };

  WebPushClient.prototype.initialize = function() {
    var config;
    config = {
      apiKey: this.options.firebaseApiKey,
      messagingSenderId: this.options.firebaseMessagingSenderId
    };
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    this.messaging = firebase.messaging();
    this.messaging.onMessage((function(_this) {
      return function(payload) {
        console.log('Message received. ', payload);
        return _this.options.onMessage(payload);
      };
    })(this));
    return this.messaging.onTokenRefresh((function(_this) {
      return function() {
        return messaging.getToken().then(function(refreshedToken) {
          setTokenSentToServer(false);
          sendTokenToServer(refreshedToken);
          return _this.options.onTokenRefresh();
        })["catch"](function(err) {
          console.log('Unable to retrieve refreshed token ', err);
          return this.options.onErrorRetrievingRefreshedToken();
        });
      };
    })(this));
  };

  WebPushClient.prototype.getToken = function() {
    return this.messaging.getToken();
  };

  WebPushClient.prototype.getTokenAndSubscribe = function() {
    return this.messaging.getToken().then((function(_this) {
      return function(currentToken) {
        if (currentToken) {
          return _this.sendTokenToServer(currentToken);
        } else {
          _this.options.onBeforePermissionRequest();
          _this.messaging.requestPermission().then(function() {
            _this.options.onPermissionGranted();
            return _this.getToken();
          })["catch"](function(err) {
            console.log('Unable to get permission to notify.', err);
            return _this.options.onPermissionFailed();
          });
          return setTokenSentToServer(false);
        }
      };
    })(this))["catch"](function(err) {
      console.log('An error occurred while retrieving token. ', err);
      return setTokenSentToServer(false);
    });
  };

  WebPushClient.prototype.sendTokenToServer = function(currentToken) {
    var http, pushSubscription;
    if (!isTokenSentToServer()) {
      pushSubscription = new Binnacle.PushSubscription({
        channelId: this.options.channelId,
        subscriptionType: 'firebase',
        userIdentifier: this.options.userIdentifier,
        token: currentToken,
        ipAddress: '',
        kvm: {
          token: currentToken
        }
      });
      http = new Binnacle.Http({
        url: this.webPushTokenRegistrationUrl,
        method: 'POST',
        json: true,
        auth: true,
        user: this.options.apiKey,
        password: this.options.apiSecret,
        data: pushSubscription
      });
      http.execute();
      return setTokenSentToServer(true);
    }
  };

  WebPushClient.prototype.deleteToken = function() {
    return this.messaging.getToken().then(function(currentToken) {
      return this.messaging.deleteToken(currentToken).then(function() {
        setTokenSentToServer(false);
        return this.options.onTokenDeleted();
      })["catch"](function(err) {
        console.log('Unable to delete token. ', err);
        return this.options.onErrorDeletingToken();
      });
    })["catch"](function(err) {
      console.log('Error retrieving Instance ID token. ', err);
      return this.options.onErrorRetrievingToken();
    });
  };

  isTokenSentToServer = function() {
    if (window.localStorage.getItem('sentToServer') === 1) {
      return true;
    } else {
      return false;
    }
  };

  setTokenSentToServer = function(sent) {
    return window.localStorage.setItem('sentToServer', sent ? 1 : 0);
  };

  return WebPushClient;

})();
