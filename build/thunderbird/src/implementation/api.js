/**
 * Native Thunderbird Preference Bridge API Worker
 */
//this.ConfigBridge = class extends globalThis.ExtensionAPI {
var ConfigBridge = class extends globalThis.ExtensionAPI {
  getAPI(context) {
    return {
      ConfigBridge: {
        /**
         * Pulls the custom ceiling constraint integer directly out of active preferences
         */
        async getMaxZoomPercent() {
          try {
            const PREF_NAME = "zoom.maxPercent";
            // Native preference checking via core internal layout parameters handles
            if (globalThis.Services.prefs.getPrefType(PREF_NAME) === globalThis.Services.prefs.PREF_INT) {
              return globalThis.Services.prefs.getIntPref(PREF_NAME);
            }
          } catch (e) {
            // Suppress isolated logs loops inside the engine sandboxes room windows
          }
          return 500; // Safe baseline max fallback metric
        },

        /**
         * Pulls the custom floor constraint integer directly out of active preferences
         */
        async getMinZoomPercent() {
          try {
            const PREF_NAME = "zoom.minPercent";
            // Native preference checking via core internal layout parameters handles
            if (globalThis.Services.prefs.getPrefType(PREF_NAME) === globalThis.Services.prefs.PREF_INT) {
              return globalThis.Services.prefs.getIntPref(PREF_NAME);
            }
          } catch (e) {
            // Suppress isolated logs loops inside the engine sandboxes room windows
          }
          return 30; // Safe baseline min fallback metric
        }
      }
    };
  }
};
