'use strict';

// Creates a websocket server and establishes a PeerConnection for every client that connects.
// Going through the usual offer, answer ice candidate process.

var ws = require('ws');
var webrtc = require('wrtc');
var dataChannels = require('./datachannels')();

module.exports = function (host, socketPort) {
  var wss = new ws.Server({
    'port': socketPort
  });

  wss.on('connection', function(socket) {
    console.log('socket connected');

    var pc = null;
    var offer = null;
    var remoteReceived = false;
    var pendingCandidates = [];

    function createAnswer() {
      remoteReceived = true;

      pendingCandidates.forEach(function(candidate) {
        if (candidate.sdp) {
          pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate.sdp));
        }
      });

      pc.createAnswer(
        setLocalDesc,
        function(err) {
          throw err;
        }
      );
    }

    function setLocalDesc(desc) {
      logData('setLocalDesc', desc);

      pc.setLocalDescription(
        desc,
        function() {
          socket.send(JSON.stringify(desc));
          console.log('awaiting data channels');
        },
        function(err) {
          throw err;
        }
      );
    }

    function setRemoteDesc() {
      logData('setRemoteDesc', offer);

      pc.setRemoteDescription(
        offer,
        createAnswer,
        function(err) {
          throw err;
        }
      );
    }

    function logData(note, data) {
      data = JSON.parse(JSON.stringify(data));

      if (typeof data.sdp === 'string') {
        data.sdp = data.sdp.split('\r\n');
      }

      console.log(note, data);
    }

    socket.on('message', function(data) {
      data = JSON.parse(data);

      logData('message', data);

      if (data.type === 'ice') {
        if (remoteReceived) {
          if (data.sdp.candidate) {
            pc.addIceCandidate(new webrtc.RTCIceCandidate(data.sdp.candidate));
          }
        } else {
          pendingCandidates.push(data);
        }
      } else if (data.type === 'offer') {
        offer = new webrtc.RTCSessionDescription(data);
        remoteReceived = false;

        pc = new webrtc.RTCPeerConnection(
          {
            iceServers: [{
              url: 'stun:stun.l.google.com:19302'
            }]
          },
          {
            'optional': [{
              DtlsSrtpKeyAgreement: false
            }]
          }
        );

        [
          'signalingStateChange',
          'iceConnectionStateChange',
          'iceGatheringStateChange',
          'iceCandidate'
        ].forEach(function(evtName) {
          pc.addEventListener(evtName, function(state) {
            logData(evtName, state);
          });
        });

        pc.addEventListener('iceCandidate', function(candidate) {
          socket.send(JSON.stringify({
            type: 'ice',
            sdp: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            }
          }));
        });

        dataChannels.add(pc);
        setRemoteDesc();
      } else {
        throw new Error('Unexpected data.type: ' + data.type);
      }
    });
  });
};
