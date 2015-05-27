'use strict';

var peer = require('./peer.js')();

require('./messageform.js')(
  peer,
  document.querySelector('#message'),
  document.querySelector('#messageForm')
);

document.addEventListener('deviceready', function () {
  var username,
    iOS = cordova.platformId && cordova.platformId === 'ios';
  while (!username) {
    username = window.prompt('Please enter your name');
  }
  peer.init({
    username: username,
    host: 'adam.local',
    RTCPeerConnection: iOS ? cordova.plugins.iosrtc.RTCPeerConnection : window.webkitRTCPeerConnection,
    RTCSessionDescription: iOS ? cordova.plugins.iosrtc.RTCSessionDescription : window.RTCSessionDescription,
    RTCIceCandidate: iOS ? cordova.plugins.iosrtc.RTCIceCandidate : window.RTCIceCandidate
  });
}, false);
