// waiting-room.js
// Lightweight SDK for Oops-Games Waiting Room

const OopsGames = {
  startWaitingRoom: function(config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error('OopsGames: Container not found');
      return;
    }

    const clientId = config.clientId || 'unknown';
    const iframe = document.createElement('iframe');
    
    // In production this would point to the live domain, but for testing we can use a relative path if needed
    // However, the test page uses a relative path to index.html anyway.
    // For the SDK, let's use the local path if window.location.hostname is localhost
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? './index.html' : 'https://oops-games.com/sunny-day-maze/';
    
    iframe.src = `${baseUrl}?mode=waiting-room&clientId=${encodeURIComponent(clientId)}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.id = 'oops-waiting-room-frame';

    container.appendChild(iframe);

    // Listen for proceed event from game
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PROCEED_TO_APP') {
        if (config.onProceed) {
          config.onProceed();
        }
      }
    });
  },

  notifyTaskComplete: function() {
    const iframe = document.getElementById('oops-waiting-room-frame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'TASK_COMPLETED' }, '*');
    } else {
      console.warn('OopsGames: iframe not found to notify.');
    }
  }
};

window.OopsGames = OopsGames;
