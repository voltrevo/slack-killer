'use strict';

var peer = require('./peer.js')();

require('./messageform.js')(
  peer,
  document.querySelector('#message'),
  document.querySelector('#messageForm')
);

var imagedropper = require('./imagedropper.js');

var username;
while (!username) {
  username = window.prompt('Please enter your name');
}

var getMaybePrefixedProperty = function(obj, prop) {
  return obj[prop] || obj['moz' + prop] || obj['webkit' + prop];
};

peer.init({
  username: username,
  RTCPeerConnection: getMaybePrefixedProperty(global, 'RTCPeerConnection'),
  RTCSessionDescription: getMaybePrefixedProperty(global, 'RTCSessionDescription'),
  RTCIceCandidate: getMaybePrefixedProperty(global, 'RTCIceCandidate')
});

imagedropper.init(document.querySelector('#message'), function (imgData) {
  peer.send(imgData, true);
});
