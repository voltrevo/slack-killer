'use strict';

module.exports = function() {
  var dataChannel;
  var dataChannelConnected;
  var bufferedMessages = [];
  var username;

  var api = {};

  api.init = function(opts) {
    username = opts.username;

    var host = opts.host || window.location.host.split(':')[0];
    var bridge = host + ':9001';
    var RTCPeerConnection = opts.RTCPeerConnection;
    var RTCSessionDescription = opts.RTCSessionDescription;
    var RTCIceCandidate = opts.RTCIceCandidate;
    var pendingCandidates = [];
    var ws;
    var pc;
    var $messages = document.querySelector('#messages');

    function createPeerConnection() {
      pc = new RTCPeerConnection({
        iceServers: [{
          url: 'stun:stun.l.google.com:19302'
        }]
      });

      [
        'signalingstatechange',
        'iceconnectionstatechange',
        'icegatheringstatechange',
        'icecandidate'
      ].forEach(function(evtName) {
        pc.addEventListener(evtName, function(event) {
          console.log(evtName, event);
        });
      });

      pc.addEventListener('icecandidate', function(event) {
        var candidate = event.candidate;

        if (!candidate) {
          return;
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ice',
            sdp: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            }
          }));
        } else {
          pendingCandidates.push(candidate);
        }
      });

      createDataChannels();
    }

    createPeerConnection();

    function createDataChannels() {
      dataChannel = pc.createDataChannel('reliable', {
        ordered: true,
        maxRetransmits: 10
      });

      dataChannel.binaryType = 'arraybuffer';

      dataChannel.addEventListener('open', function() {
        console.log('complete');
        ws.close();
        dataChannelConnected = true;
        bufferedMessages.forEach(function(message) {
          dataChannel.send(message);
        });
        bufferedMessages = [];
      });

      dataChannel.addEventListener('message', function(event) {
        if (typeof event.data === 'string') {
          var msg = JSON.parse(event.data);
          var msgEl = document.createElement('li');

          msgEl.innerHTML = '<strong>' + msg.name + '</strong>: ';

          if (msg.type === 'image') {
            console.log('onimage');
            var img = document.createElement('img');
            img.src = msg.text;
            msgEl.appendChild(img);
          } else {
            console.log('onmessage:', msg.text);
            msgEl.innerHTML += msg.text;
          }

          $messages.appendChild(msgEl);
        } else {
          console.log('onmessage:', new Uint8Array(event.data));
        }
      });

      dataChannel.addEventListener('close', function() {
        console.info('onclose');
      });

      dataChannel.addEventListener('error', function(err) {
        throw err;
      });

      createOffer();
    }

    function createOffer() {
      pc.createOffer(
        setLocalDesc,
        function(err) {
          throw err;
        }
      );
    }

    function setLocalDesc(desc) {
      pc.setLocalDescription(
        new RTCSessionDescription(desc),
        sendOffer.bind(undefined, desc),
        function(err) {
          throw err;
        }
      );
    }

    function sendOffer(offer) {
      ws = new WebSocket('ws://' + bridge);

      ws.addEventListener('open', function() {
        pendingCandidates.forEach(function(candidate) {
          ws.send(JSON.stringify({
            type: 'ice',
            sdp: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            }
          }));
        });

        ws.send(JSON.stringify({
          type: offer.type,
          sdp: offer.sdp
        }));
      });

      ws.addEventListener('message', function(event) {
        var data = JSON.parse(event.data);

        if (data.type === 'answer') {
          setRemoteDesc(data);
        } else if (data.type === 'ice') {
          if (data.sdp.candidate) {
            var candidate = new RTCIceCandidate(data.sdp.candidate);
            pc.addIceCandidate(candidate);
          }
        }
      });
    }

    function setRemoteDesc(desc) {
      pc.setRemoteDescription(
        new RTCSessionDescription(desc),
        function() {
          console.log('awaiting data channels');
        },
        function(err) {
          throw err;
        }
      );
    }
  };

  api.send = function(text, img) {
    var msg = JSON.stringify({
      name: username,
      type: img ? 'image' : 'text',
      text: text
    });

    if (!dataChannelConnected) {
      bufferedMessages.push(msg);
    } else {
      dataChannel.send(msg);
    }
  };

  return api;
};
