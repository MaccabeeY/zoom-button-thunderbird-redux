(function() {
  // Local frame caches to hold states inside the active document thread for zero latency
  let activeFrameZoomFactor = 1.0;
  let currentScrollThreshold = 50;

  /**
   * Synchronizes the active document window scale metrics with the background source of truth
   */
  function syncLocalFrameMetrics() {
    messenger.runtime.sendMessage({ action: "get-zoom" }, (response) => {
      if (response && response.currentZoom && document.body) {
        activeFrameZoomFactor = response.currentZoom;

        // Applies the mathematical scale transform matrix to the active view body
        document.body.style.transform = "scale(" + activeFrameZoomFactor + ")";
        document.body.style.transformOrigin = "top left";

        // Dynamically adjusts viewport clipping boundaries to match the transform factor
        if (activeFrameZoomFactor > 1) {
          document.body.style.width = (100 / activeFrameZoomFactor) + "%";
        } else {
          document.body.style.width = "100%";
        }
      }
    });

    // Fetches the latest user threshold preference for pixel step scroll tracking
    messenger.storage.local.get({ gestureSensitivityValue: 50 }, (items) => {
      currentScrollThreshold = parseInt(items.gestureSensitivityValue, 10);
    });
  }

  // Execute initial sync sequence to size the view accurately on engine startup
  syncLocalFrameMetrics();

  // Listen for broadcast options updates to update sensitivity and tracking metrics live
  messenger.runtime.onMessage.addListener((message) => {
    if (message.action === "update-frame-parameters") {
      syncLocalFrameMetrics();
    }
  });

  // Guard clause to prevent duplicate event listener tracking systems from compounding
  if (window.hasZoomGestureEngineActive) return;
  window.hasZoomGestureEngineActive = true;

  // Internal state machines managing hardware interaction overrides
  let didZoomActionOccur = false;
  let accumulatedDeltaY = 0;
  let lastZoomTime = 0;
  const COOLDOWN_MS = 80; // Operational throttle window in milliseconds to manage heavy scroll inputs

  /**
   * Listens for mouse wheel rotations combined with right-click constraints
   */
  window.addEventListener("wheel", (event) => {
    if (event.buttons === 2) { // 2 tracks active hold state on the Right Mouse Button
      event.preventDefault();
      event.stopPropagation();

      const now = performance.now();
      accumulatedDeltaY += event.deltaY;

      // Fires message signals to the task worker when tracking constraints cross threshold boundaries
      if (Math.abs(accumulatedDeltaY) >= currentScrollThreshold && (now - lastZoomTime) > COOLDOWN_MS) {
        didZoomActionOccur = true;
        lastZoomTime = now;
        const movementAction = accumulatedDeltaY < 0 ? "zoom-in" : "zoom-out";
        accumulatedDeltaY = 0;
        messenger.runtime.sendMessage({ action: movementAction });
      }
    }
  }, { passive: false });

  /**
   * Catches right-click + middle-click (Middle Button Click) combinations to trigger instant snap routines
   */
  window.addEventListener("mousedown", (event) => {
    if (event.button === 1 && event.buttons === 6) { // 1 is middle-click; 6 indicates both right + middle buttons down
      event.preventDefault();
      event.stopPropagation();
      didZoomActionOccur = true;
      messenger.runtime.sendMessage({ action: "zoom-snap-value" });
    }
  }, true);

  /**
   * Block and suppress default pointer release actions if an active chord sequence took place
   */
  window.addEventListener("mouseup", (event) => {
    if (event.button === 1 && (event.buttons === 6 || didZoomActionOccur)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  /**
   * Halts click registration signals to prevent breaking link targets under active manipulation
   */
  window.addEventListener("click", (event) => {
    if (event.button === 1 && (event.buttons === 6 || didZoomActionOccur)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  /**
   * Intercepts and drops the native OS context menu window if a gesture operations sequence occurred
   */
  window.addEventListener("contextmenu", (event) => {
    if (didZoomActionOccur) {
      event.preventDefault();
      event.stopPropagation();
      didZoomActionOccur = false;
      accumulatedDeltaY = 0;
    }
  }, true);
})();
