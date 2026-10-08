/**
 * ============================================================================
 * ZOOM BUTTON FOR THUNDERBIRD (REDUX+) - CORE RUNTIME WORKER
 * ============================================================================
 * Architecture: Manifest V2 Persistent Background Page
 */

// Persistent in-memory variables tracking application state across active execution threads
let zoomTracker = 1.0;            // Live scale factor cache (e.g., 1.0 = 100%, 1.2 = 120%) to prevent async storage lookups
let absoluteCeilingLimit = 5.0;   // The maximum allowable magnification ceiling, bounded dynamically by system configs
let absoluteFloorLimit = 0.3;     // The minimum allowable scaling floor, preventing text elements from shrinking to zero
let zoomIncrementStep = 0.10;     // Fractional delta value added to or subtracted from zoomTracker during shift increments
let isGestureEnabled = true;      // Master logic gate toggling tracking for right-click + wheel chord inputs
let customBadgeColor = "#4A90E2"; // HEX color parameter passed to messageDisplayAction tracking badge background design
let activeIconPath = "images/icon-32-bw-thin.png"; // Live string path tracking the active style variations of your extension icon

/**
 * Orchestrates preference loading from local disk arrays.
 * Seeds factory fallback configurations if a cold initialization is identified.
 */
function loadSavedAddonSettings() {
  messenger.storage.local.get({
    zoomStep: "10",
    enableGesture: true,
    gestureSensitivityValue: 50,
    badgeColor: "#4A90E2",
    currentRuntimeZoom: 1.0,
    resetTarget: "100",
    activeIconPath: "images/icon-32-bw-thin.png"
  }, (items) => {
    // Evaluates cold initialization conditions; populates baseline values if storage data points are missing
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

    // Normal Execution Pathway: Synchronizes retrieved parameters directly to global execution variables
    isGestureEnabled = items.enableGesture;
    customBadgeColor = items.badgeColor;
    zoomTracker = Number.parseFloat(items.currentRuntimeZoom);
    zoomIncrementStep = parseInt(items.zoomStep, 10) / 100;
    activeIconPath = items.activeIconPath;
    updateButtonUI(zoomTracker);
  });
}

/**
 * Normalizes system configuration profiles down to floating-point mathematical boundaries.
 */
async function fetchTrueSystemPreferences() {
  let rawMax = 500;
  let rawMin = 30;
  absoluteCeilingLimit = rawMax / 100;
  absoluteFloorLimit = rawMin / 100;
}

/**
 * Direct UI state synchronizer. Manages toolbar badges, tooltips, and file assets.
 * @param {number} level - Floating-point scalar representing active viewport scale factor.
 */
function updateButtonUI(level) {
  const percentageNum = Math.round(level * 100);
  let badgeString = "";
  if (percentageNum !== 100) {
    badgeString = percentageNum > 100 ? `${percentageNum}` : `${percentageNum}%`;
  }

  const action = messenger.messageDisplayAction;
  if (action) {
    action.setBadgeText({ text: badgeString });
    action.setBadgeBackgroundColor({ color: customBadgeColor });
    action.setTitle({ title: "Zoom this message" });
    action.setIcon({ path: activeIconPath }).catch((err) => console.error("Icon render shift failure:", err));
  }
}

// Deprecated injection string payload preserved strictly to retain fallback operational pathways
const gestureContentScriptCode = `
  (function() {
    let activeFrameZoomFactor = 1.0;
    let currentScrollThreshold = 50;

    function syncLocalFrameMetrics() {
      messenger.runtime.sendMessage({ action: "get-zoom" }, (response) => {
        if (response && response.currentZoom && document.body) {
          activeFrameZoomFactor = response.currentZoom;
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

    syncLocalFrameMetrics();

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

// Registers our dedicated gesture file early in the lifecycle of email presentation windows
try {
  messenger.scripting.messageDisplay.registerScripts([
    {
      id: "zoom-mouse-wheel-logic",
      js: ["gesture.js"],       // References the external tracking module containing hardware event listeners
      runAt: "document_start"   // Enforces early payload deployment before window frames establish layouts
    }
  ]);
} catch(err) {
  console.error("Script registration error: ", err);
}

// Resets execution runtime tracking states to neutral baselines when pop-out reader views deploy
messenger.windows.onCreated.addListener((newWindow) => {
  if (newWindow && newWindow.type !== "normal") {
    zoomTracker = 1.0;
    messenger.storage.local.set({ currentRuntimeZoom: 1.0 });
    updateButtonUI(zoomTracker);
  }
});

/**
 * Executes a functional programmatic matrix calculation inside target view layouts.
 * @param {number} currentZoomValue - The floating point multiplier intended for execution.
 */
async function applyZoomToContext(currentZoomValue) {
  let tabs = await messenger.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const safeZoomValue = Number.parseFloat(Number.parseFloat(currentZoomValue).toFixed(2));
    if (isNaN(safeZoomValue)) return;

    await messenger.tabs.executeScript(tabs.id, {
      code: `(function(scaleValue) {
        if (document.body) {
          document.body.style.transform = "scale(" + scaleValue + ")";
          document.body.style.transformOrigin = "top left";
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

/**
 * Central state logic router. Captures navigation instructions and executes variable arithmetic.
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
    let tabs = await messenger.tabs.query({});
    for (let tab of tabs) {
      messenger.tabs.sendMessage(tab.id, { action: "update-frame-parameters" }).catch(() => {});
    }
    if (sendResponse) sendResponse({ currentZoom: zoomTracker });
    return;
  }

  messenger.storage.local.set({ currentRuntimeZoom: zoomTracker });
  updateButtonUI(zoomTracker);
  await applyZoomToContext(zoomTracker);

  if (sendResponse) sendResponse({ currentZoom: zoomTracker });
}

/**
 * Pipelined storage command queue ensuring database mutations execute sequentially.
 */
class StorageTaskQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

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

const storageQueue = new StorageTaskQueue();

// Primary interface router capturing and dispersing incoming inter-process network signals
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

// Registers installation lifecycle triggers to seed storage partitions on initial deployments
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
