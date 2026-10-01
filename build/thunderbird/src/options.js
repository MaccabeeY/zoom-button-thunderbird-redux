const zoomStepSelect = document.getElementById('zoom-step');
const gestureToggle = document.getElementById('gesture-toggle');
const gestureSensitivity = document.getElementById('gesture-sensitivity');
const sensitivityRow = document.getElementById('sensitivity-row');
const badgeColorInput = document.getElementById('badge-color');
const resetBehaviorSelect = document.getElementById('reset-behavior');
const resetDefaultsBtn = document.getElementById('reset-defaults');
const statusDiv = document.getElementById('status');
const iconRadioGroup = document.getElementsByName('icon-choice');

function showStatusMessage(text) {
  statusDiv.textContent = text;
  setTimeout(() => { statusDiv.textContent = ""; }, 1500);
}

/**
 * Extracts preferences out of local storage and applies them to form controls
 */
function loadSettingsFromStorage() {
  messenger.storage.local.get({
    zoomStep: "10",
    enableGesture: true,
    gestureSensitivityValue: 50,
    badgeColor: "#4A90E2",
    resetTarget: "100",
    activeIconPath: "images/icon-32-bw-thin.png" // Cold root fallback
  }, (items) => {
    zoomStepSelect.value = items.zoomStep;
    gestureToggle.checked = items.enableGesture;
    gestureSensitivity.value = items.gestureSensitivityValue.toString();
    badgeColorInput.value = items.badgeColor;
    resetBehaviorSelect.value = items.resetTarget;
    sensitivityRow.style.display = items.enableGesture ? "flex" : "none";

    // Match storage strings directly to target radio buttons
    for (let radio of iconRadioGroup) {
      if (radio.value === items.activeIconPath) {
        radio.checked = true;
        break;
      }
    }
  });
}

// Initial draw sequence execution
loadSettingsFromStorage();

/* ==========================================================================
   STATE REGISTRATION EVENT DRIVERS
   ========================================================================== */

// Completely handles resetting our new sensitivity dropdown on click events
resetDefaultsBtn.addEventListener('click', () => {
  messenger.storage.local.clear(() => {
    showStatusMessage("Defaults restored completely!");

    // Repopulate UI form select structures back to factory fallback baselines instantly
    loadSettingsFromStorage();

    // Alert background thread worker to refresh settings parameters instantly
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

/**
 * Real-time changes input listeners committing values to memory and signaling background.js
 */
zoomStepSelect.addEventListener('change', () => {
  messenger.storage.local.set({ zoomStep: zoomStepSelect.value }, () => {
    showStatusMessage("Zoom sensitivity step updated!");
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

gestureToggle.addEventListener('change', () => {
  messenger.storage.local.set({ enableGesture: gestureToggle.checked }, () => {
    showStatusMessage("Gesture configuration updated!");
    sensitivityRow.style.display = gestureToggle.checked ? "flex" : "none";
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

// Listens to clean select dropdown value shifts
gestureSensitivity.addEventListener('change', () => {
  const numericVal = parseInt(gestureSensitivity.value, 10);
  messenger.storage.local.set({ gestureSensitivityValue: numericVal }, () => {
    showStatusMessage("Gesture sensitivity calibration applied!");
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

// OPTIMIZATION ACTION: Shift from volatile "input" loops straight over to a
// single "change" execution block to halt heavy I/O overhead loops on disk arrays.
badgeColorInput.addEventListener('change', () => {
  messenger.storage.local.set({ badgeColor: badgeColorInput.value }, () => {
    showStatusMessage("Badge style committed!");
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

resetBehaviorSelect.addEventListener('change', () => {
  messenger.storage.local.set({ resetTarget: resetBehaviorSelect.value }, () => {
    showStatusMessage("Reset behavior modified!");
    messenger.runtime.sendMessage({ action: "refresh-options" });
  });
});

// Iterates over each radio node in the group list array
iconRadioGroup.forEach((radio) => {
  radio.addEventListener('change', (event) => {
    const selectedIconPath = event.target.value;
    messenger.storage.local.set({ activeIconPath: selectedIconPath }, () => {
      showStatusMessage("Toolbar layout interface updated!");
      messenger.runtime.sendMessage({ action: "refresh-options" });
    });
  });
});
