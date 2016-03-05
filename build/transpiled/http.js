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
