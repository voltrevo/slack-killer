'use strict';

module.exports = function(peer, $messageInput, $messageForm) {
  $messageForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var msg = $messageInput.value;
    $messageInput.value = '';
    peer.send(msg);
  });
};
