/**
 * Dynamic Toolbar Dropdown UI Controller Frame
 */
const resetButton = document.getElementById('zoom-reset');

/**
 * Updates the text value drawing inside the center button footprint node
 */
function refreshPopupUI(level) {
  // CRITICAL COLD INTENT SAFETY GUARD: Fallback gracefully to standard 100%
  // if values are undefined or evaluated as blank during a cold boot sequence.
  if (!level || isNaN(level)) {
    resetButton.textContent = "100%";
    return;
  }
  resetButton.textContent = `${Math.round(level * 100)}%`;
}

// Intercept current settings from the active background.js execution thread worker on window open event
messenger.runtime.sendMessage({ action: "get-zoom" }, (response) => {
  if (response && response.currentZoom) {
    refreshPopupUI(response.currentZoom);
  } else {
    // If the background script hasn't fully booted yet, draw a safe visual baseline
    refreshPopupUI(1.0);
  }
});

/* ==========================================================================
   BUTTON CLICK ROUTERS
   ========================================================================== */

document.getElementById('zoom-in').addEventListener('click', () => {
  messenger.runtime.sendMessage({ action: "zoom-in" }, (response) => {
    if (response && response.currentZoom) refreshPopupUI(response.currentZoom);
  });
});

document.getElementById('zoom-out').addEventListener('click', () => {
  messenger.runtime.sendMessage({ action: "zoom-out" }, (response) => {
    if (response && response.currentZoom) refreshPopupUI(response.currentZoom);
  });
});

resetButton.addEventListener('click', () => {
  messenger.runtime.sendMessage({ action: "zoom-reset" }, (response) => {
    if (response && response.currentZoom) refreshPopupUI(response.currentZoom);
  });
});

/* ==========================================================================
   DROPDOWN MOUSE INTERACTION INTERCEPTORS
   ========================================================================== */

window.addEventListener('wheel', (event) => {
  event.preventDefault();
  const actionType = event.deltaY < 0 ? "zoom-in" : "zoom-out";
  messenger.runtime.sendMessage({ action: actionType }, (response) => {
    if (response && response.currentZoom) refreshPopupUI(response.currentZoom);
  });
}, { passive: false });

/* ==========================================================================
   WRENCH BUTTON UTILITY SYSTEM
   ========================================================================== */

document.getElementById('open-options').addEventListener('click', () => {
  // Instructs Thunderbird to programmatically deploy the assigned options page modal/tab
  if (messenger.runtime.openOptionsPage) {
    messenger.runtime.openOptionsPage();
  } else {
    // Fallback security safety route for legacy Gecko environments
    browser.runtime.openOptionsPage();
  }
});
