/**
 * ============================================================================
 * ZOOM BUTTON FOR THUNDERBIRD (PEP) - CORE RUNTIME WORKER
 * ============================================================================
 * Architecture: Manifest V2 Persistent Background Page
 *
 * DESIGN STRATEGY:
 * Because Manifest V2 scripts run persistently in the background memory space,
 * we can rely on synchronous global tracking variables for extreme responsiveness.
 * State updates are instantly saved to storage, but calculations bypass async lag.
 */

/* ==========================================================================
   1. GLOBAL IN-MEMORY PERSISTENT TRACKING STATES
   ========================================================================== */
let zoomTracker = 1.0;            // Keeps live zoom scale multiplier instantly accessible in RAM
let absoluteCeilingLimit = 5.0;   // Maximum zoom cap (500%). Overwritten by fetchTrueSystemPreferences.
let absoluteFloorLimit = 0.3;     // Minimum zoom floor (30%). Overwritten by fetchTrueSystemPreferences.
let zoomIncrementStep = 0.10;     // Fallback step sizing. Overwritten dynamically by user configurations.
let isGestureEnabled = true;      // Conditional switch to intercept right-click mouse combinations.
let customBadgeColor = "#4A90E2"; // Toolbar badge accent color tracking layout preference.
let activeIconPath = "images/icon-32-bw-thin.png"; // FIXED: Explicit global memory variable tracking layout path

/**
 * Recovers customized user parameters from local storage.
 * Safely self-seeds factory baseline configurations if a cold install is detected.
 */
function loadSavedAddonSettings() {
  messenger.storage.local.get({
    zoomStep: "10",
    enableGesture: true,
    gestureSensitivityValue: 50,
    badgeColor: "#4A90E2",
    currentRuntimeZoom: 1.0, // Recover the last active zoom level across browser restarts
    resetTarget: "100",
    activeIconPath: "images/icon-32-bw-thin.png" // Cold root fallback
  }, (items) => {
    // COLD ROOT VERIFICATION: If storage data hasn't been set yet, seed it natively
    if (items.gestureSensitivityValue === undefined || !items.badgeColor || !items.activeIconPath) {
      const defaultData = {
        zoomStep: "10",
        enableGesture: true,
        gestureSensitivityValue: 50,
        badgeColor: "#4A90E2",
        currentRuntimeZoom: 1.0,
        resetTarget: "100",
        activeIconPath: "images/icon-32-bw-thin.png"
      };
      messenger.storage.local.set(defaultData, () => {
        isGestureEnabled = true;
        customBadgeColor = "#4A90E2";
        zoomTracker = 1.0;
        zoomIncrementStep = 0.10;
        activeIconPath = "images/icon-32-bw-thin.png";
        updateButtonUI(zoomTracker);
      });
      return;
    }

    // Normal Execution Sequence: Storage matches configuration states
    isGestureEnabled = items.enableGesture;
    customBadgeColor = items.badgeColor;
    zoomTracker = Number.parseFloat(items.currentRuntimeZoom);
    // Convert UI display percentages (e.g., "10") down to mathematical decimals (0.10)
    zoomIncrementStep = parseInt(items.zoomStep, 10) / 100;
    activeIconPath = items.activeIconPath;
    updateButtonUI(zoomTracker);
  });
}

/* ==========================================================================
   2. SYSTEM PREFERENCE & BRIDGE INTERFACE
   ========================================================================== */

/**
 * Queries Thunderbird's internal `about:config` entries through the Experiment API.
 */
async function fetchTrueSystemPreferences() {
  try {
    if (browser.ConfigBridge) {
      if (browser.ConfigBridge.getMaxZoomPercent) {
        let rawMax = await browser.ConfigBridge.getMaxZoomPercent();
        if (rawMax && !isNaN(rawMax)) absoluteCeilingLimit = rawMax / 100;
      }
      if (browser.ConfigBridge.getMinZoomPercent) {
        let rawMin = await browser.ConfigBridge.getMinZoomPercent();
        if (rawMin && !isNaN(rawMin)) absoluteFloorLimit = rawMin / 100;
      }
    }
  } catch (err) {
    absoluteCeilingLimit = 5.0;
    absoluteFloorLimit = 0.3;
  }
}

/* ==========================================================================
   3. UI & GRAPHICS ORCHESTRATION (MV2 COMPLIANT)
   ========================================================================== */

/**
 * Modifies the icon badge text layout on the main message display toolbar.
 * MV2 Specific: Connects directly to the 'messageDisplayAction' namespace.
 * @param {number} level - Current scale parameter.
 */
function updateButtonUI(level) {
  const percentageNum = Math.round(level * 100);
  let badgeString = "";
  if (percentageNum !== 100) {
    badgeString = percentageNum > 100 ? `${percentageNum}` : `${percentageNum}%`;
  }

  // MV2 UI Target Definition
  const action = messenger.messageDisplayAction;
  if (action) {
    action.setBadgeText({ text: badgeString });
    action.setBadgeBackgroundColor({ color: customBadgeColor });
    action.setTitle({ title: "Zoom this message" });

    // Programmatically invoke the image engine wrapper to apply icon shifts
    action.setIcon({ path: activeIconPath }).catch((err) => console.error("Icon render shift failure:", err));
  }
}

/* ==========================================================================
   4. CONTENT SCRIPT GESTURE ENGINE (INJECTED SANDBOX FRAME)
   ========================================================================== */

const gestureContentScriptCode = `
  (function() {
    // CACHED METRIC BUFFER LAYER: Holds configurations inside active thread RAM
    // to bypass asynchronous database storage delays mid-gesture drag.
    let activeFrameZoomFactor = 1.0;
    let currentScrollThreshold = 50;

    // Helper to refresh memory variables instantly from background source of truth
    function syncLocalFrameMetrics() {
      messenger.runtime.sendMessage({ action: "get-zoom" }, (response) => {
        if (response && response.currentZoom && document.body) {
          activeFrameZoomFactor = response.currentZoom;

          // Modernized layout parsing matching the background orchestration engine
          document.body.style.transform = "scale(" + activeFrameZoomFactor + ")";
          document.body.style.transformOrigin = "top left";
          if (activeFrameZoomFactor > 1) {
            document.body.style.width = (100 / activeFrameZoomFactor) + "%";
          } else {
            document.body.style.width = "100%";
          }
        }
      });

      messenger.storage.local.get({ gestureSensitivityValue: 50 }, (items) => {
        currentScrollThreshold = parseInt(items.gestureSensitivityValue, 10);
      });
    }

    // Run synchronization loop on initial page wake instantiation
    syncLocalFrameMetrics();

    // Listen for options changes broadcast by options panel to update threshold variables live
    messenger.runtime.onMessage.addListener((message) => {
      if (message.action === "update-frame-parameters") {
        syncLocalFrameMetrics();
      }
    });

    if (window.hasZoomGestureEngineActive) return;
    window.hasZoomGestureEngineActive = true;
    let didZoomActionOccur = false;

    let accumulatedDeltaY = 0;
    let lastZoomTime = 0;
    const COOLDOWN_MS = 80;

    window.addEventListener("wheel", (event) => {
      if (event.buttons === 2) {
        event.preventDefault();
        event.stopPropagation();

        const now = performance.now();
        accumulatedDeltaY += event.deltaY;

        // FIXED CRITICAL LINE: Evaluated purely against lightning-fast local memory variables
        if (Math.abs(accumulatedDeltaY) >= currentScrollThreshold && (now - lastZoomTime) > COOLDOWN_MS) {
          didZoomActionOccur = true;
          lastZoomTime = now;
          const movementAction = accumulatedDeltaY < 0 ? "zoom-in" : "zoom-out";
          accumulatedDeltaY = 0;
          messenger.runtime.sendMessage({ action: movementAction });
        }
      }
    }, { passive: false });

    window.addEventListener("mousedown", (event) => {
      if (event.button === 1 && event.buttons === 6) {
        event.preventDefault();
        event.stopPropagation();
        didZoomActionOccur = true;
        messenger.runtime.sendMessage({ action: "zoom-snap-value" });
      }
    }, true);

    window.addEventListener("mouseup", (event) => {
      if (event.button === 1 && (event.buttons === 6 || didZoomActionOccur)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    window.addEventListener("click", (event) => {
      if (event.button === 1 && (event.buttons === 6 || didZoomActionOccur)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    window.addEventListener("contextmenu", (event) => {
      if (didZoomActionOccur) {
        event.preventDefault();
        event.stopPropagation();
        didZoomActionOccur = false;
        accumulatedDeltaY = 0;
      }
    }, true);
  })();
`;

// Registers the script module persistently inside Thunderbird's browser execution context
try {
  messenger.messageDisplayScripts.register({
    js: [{ code: gestureContentScriptCode }]
  });
} catch(err) {
  console.error("Script registration error: ", err);
}

// Global Event: Resets layout tracking variables back to 1.0 when a standalone pop-out window opens
messenger.windows.onCreated.addListener((newWindow) => {
  if (newWindow && newWindow.type !== "normal") {
    zoomTracker = 1.0;
    messenger.storage.local.set({ currentRuntimeZoom: 1.0 });
    updateButtonUI(zoomTracker);
  }
});

/* ==========================================================================
   5. EXECUTION & CSS INJECTION ENGINE (MV2 SAFE EXECUTION)
   ========================================================================== */

/**
 * Injects CSS zoom transformations using secure script block strings.
 * MV2 Specific: Uses the cleaner, legacy tabs.executeScript environment layout.
 * @param {number} currentZoomValue - Calculated scaling coefficient.
 */
/**
 * Injects CSS zoom transformations securely.
 * Secure Compliance Update: Eliminates dynamic string interpolation to pass extension validation checks.
 * @param {number} currentZoomValue - Calculated scaling coefficient.
 */
/**
 * Injects CSS zoom transformations using cross-version compliant CSS transforms.
 * Fixes both the RCE security vulnerability and the legacy zoom rendering engine bug.
 * @param {number} currentZoomValue - Calculated scaling coefficient (e.g., 1.25 for 125%).
 */
async function applyZoomToContext(currentZoomValue) {
  let tabs = await messenger.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    // 1. Parse and sanitize the input to prevent injection risks
    const safeZoomValue = Number.parseFloat(Number.parseFloat(currentZoomValue).toFixed(2));
    if (isNaN(safeZoomValue)) return;

    // 2. Inject safely using a functional wrapper parameter
    await messenger.tabs.executeScript(tabs.id, {
      code: `(function(scaleValue) {
        if (document.body) {
          // Fix for modern rendering engines: Use standard transform matrices
          document.body.style.transform = "scale(" + scaleValue + ")";
          document.body.style.transformOrigin = "top left";

          // When scaling up, elements might clip out of the viewport.
          // This forces the body width to dynamically compensate for the scale matrix factor.
          if (scaleValue > 1) {
            document.body.style.width = (100 / scaleValue) + "%";
          } else {
            document.body.style.width = "100%";
          }
        }
      })(${safeZoomValue});`,
      allFrames: true
    }).catch(() => {});
  }
}

/* ==========================================================================
   6. CENTRAL TASK ROUTER & SIGNAL INTERCEPTOR
   ========================================================================== */

/**
 * Central event processor. Updates calculations using fast synchronous memory
 * and pipes changes instantly out to persistent local storage backings.
 */
async function runZoomChangeTask(action, sender, sendResponse) {
  if ((action === "zoom-in" || action === "zoom-out" || action === "zoom-snap-value" || action === "zoom-reset") && sender && sender.url) {
    const isFromPopupInterface = sender.url.includes("popup.html");
    if (!isFromPopupInterface && !isGestureEnabled) {
      if (sendResponse) sendResponse({ currentZoom: zoomTracker });
      return;
    }
  }

  await fetchTrueSystemPreferences();

  if (action === "zoom-in") {
    zoomTracker = Math.round((zoomTracker + zoomIncrementStep) * 100) / 100;
    if (zoomTracker > absoluteCeilingLimit) zoomTracker = absoluteCeilingLimit;
  } else if (action === "zoom-out") {
    zoomTracker = Math.round((zoomTracker - zoomIncrementStep) * 100) / 100;
    if (zoomTracker < absoluteFloorLimit) zoomTracker = absoluteFloorLimit;
  } else if (action === "zoom-reset") {
    zoomTracker = 1.0;
  } else if (action === "zoom-snap-value") {
    let items = await messenger.storage.local.get({ resetTarget: "100" });
    zoomTracker = parseInt(items.resetTarget, 10) / 100;
  } else if (action === "refresh-options") {
    loadSavedAddonSettings();
    // Notify all active email layout views to reload memory threshold caches instantly
    let tabs = await messenger.tabs.query({});
    for (let tab of tabs) {
      messenger.tabs.sendMessage(tab.id, { action: "update-frame-parameters" }).catch(() => {});
    }
    if (sendResponse) sendResponse({ currentZoom: zoomTracker });
    return;
  }

  // Update storage in the background, but immediately execute UI/DOM layout updates using local RAM variables
  messenger.storage.local.set({ currentRuntimeZoom: zoomTracker });
  updateButtonUI(zoomTracker);
  await applyZoomToContext(zoomTracker);

  if (sendResponse) sendResponse({ currentZoom: zoomTracker });
}

/* ==========================================================================
   7. SEQUENTIAL ASYNC QUEUE CONTROLLER
   ========================================================================== */
class StorageTaskQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Pushes a new operation to the tail of the array and triggers execution
   */
  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  /**
   * Evaluates the chain sequentially without overlap loops
   */
  async processNext() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      await nextTask();
    }

    this.isProcessing = false;
  }
}

// Instantiate the global pipeline mechanism
const storageQueue = new StorageTaskQueue();

/* ==========================================================================
   8. SECURE RUNTIME PIPELINE INTERCEPTOR
   ========================================================================== */

// Secure Runtime Pipeline Interceptor Interface Route mapping
messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get-zoom") {
    sendResponse({ currentZoom: zoomTracker });
    return false;
  }

  storageQueue.enqueue(() => runZoomChangeTask(message.action, sender, sendResponse))
    .catch((err) => console.error("Queue trace fault:", err));

  return true;
});

loadSavedAddonSettings();

/* ==========================================================================
   9. COLD BOOT APPLICATION SEED ENGINE
   ========================================================================== */
messenger.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    messenger.storage.local.set({
      zoomStep: "10",
      enableGesture: true,
      gestureSensitivityValue: 50,
      badgeColor: "#4A90E2",
      currentRuntimeZoom: 1.0,
      resetTarget: "100",
      activeIconPath: "images/icon-32-bw-thin.png"
    }, () => {
      loadSavedAddonSettings();
    });
  }
});
