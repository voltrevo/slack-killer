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
    var pc = null,
      offer = null,
      answer = null,
      remoteReceived = false,
      pendingCandidates = [];

    console.info('socket connected');

    function handleError(error) {
      throw error;
    }

    function createAnswer() {
      remoteReceived = true;
      pendingCandidates.forEach(function(candidate) {
        if (candidate.sdp) {
          pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate.sdp));
        }
      });
      pc.createAnswer(
        setLocalDesc,
        handleError
      );
    }

    function setLocalDesc(desc) {
      answer = desc;
      console.info(desc);
      pc.setLocalDescription(
        desc,
        sendAnswer,
        handleError
      );
    }

    function sendAnswer() {
      socket.send(JSON.stringify(answer));
      console.log('awaiting data channels');
    }

    function setRemoteDesc() {
      console.info(offer);
      pc.setRemoteDescription(
        offer,
        createAnswer,
        handleError
      );
    }

    socket.on('message', function(data) {
      data = JSON.parse(data);
      if (data.type === 'offer') {
        offer = new webrtc.RTCSessionDescription(data);
        answer = null;
        remoteReceived = false;

        pc = new webrtc.RTCPeerConnection({
          iceServers: [{
            url: 'stun:stun.l.google.com:19302'
          }]
        }, {
          'optional': [{
            DtlsSrtpKeyAgreement: false
          }]
        });
        pc.onsignalingstatechange = function(state) {
          console.info('signaling state change:', state);
        };
        pc.oniceconnectionstatechange = function(state) {
          console.info('ice connection state change:', state);
        };
        pc.onicegatheringstatechange = function(state) {
          console.info('ice gathering state change:', state);
        };
        pc.onicecandidate = function(candidate) {
          socket.send(JSON.stringify({
            type: 'ice',
            sdp: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            }
          }));
        };

        dataChannels.add(pc);
        setRemoteDesc();
      } else if (data.type === 'ice') {
        if (remoteReceived) {
          if (data.sdp.candidate) {
            pc.addIceCandidate(new webrtc.RTCIceCandidate(data.sdp.candidate));
          }
        } else {
          pendingCandidates.push(data);
        }
      }
    });
  });
};
