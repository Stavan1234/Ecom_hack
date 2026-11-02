// Lab 5 helper. Wraps alert() so that a harmless proof-of-execution payload is
// also recorded in this application's own event log. It only talks to this origin.
(function () {
  var original = window.alert;
  window.alert = function (message) {
    try {
      fetch('/api/lab/xss-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, message: String(message) }),
        keepalive: true,
      });
    } catch (e) { /* The alert still shows if logging fails. */ }
    return original.call(window, message);
  };
})();
