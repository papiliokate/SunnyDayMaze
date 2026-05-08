// waiting-room.js
// Lightweight SDK for Oops-Games Waiting Room

let __oopsGamesBaseUrl = 'https://oops-games.com/sunny-day-maze/';
try {
  if (document.currentScript && document.currentScript.src && document.currentScript.src.includes('waiting-room.js')) {
    const scriptUrl = new URL(document.currentScript.src);
    __oopsGamesBaseUrl = scriptUrl.origin + scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/') + 1);
  }
} catch (e) {
  console.warn('OopsGames: Could not resolve script URL, falling back to production URL.');
}

const OopsGames = {
  startWaitingRoom: function(config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error('OopsGames: Container not found');
      return;
    }

    const clientId = config.clientId || 'unknown';
    const iframe = document.createElement('iframe');
    
    // Automatically point to the index.html located next to this script
    const targetUrl = __oopsGamesBaseUrl.endsWith('/') ? __oopsGamesBaseUrl : __oopsGamesBaseUrl + '/';
    
    iframe.src = `${targetUrl}?mode=waiting-room&clientId=${encodeURIComponent(clientId)}`;
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
