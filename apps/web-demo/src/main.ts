import { getStations, getStation } from "./api/stations.js";
import { getLatestObservation } from "./api/observations.js";
import { ApiRequestError } from "./api/client.js";
import { API_BASE_URL } from "./config.js";
import { initMap } from "./map/map-manager.js";
import { addStationMarkers } from "./map/marker-manager.js";
import { showLoading, hideLoading } from "./ui/loading.js";
import { showError, hideError, resetRetryCount } from "./ui/error-display.js";
import type L from "leaflet";

console.log("Buoy Station Map - Web Demo Application");
console.log(`API Base URL: ${API_BASE_URL}`);

// Expose API functions to window for testing in browser console
declare global {
  interface Window {
    api: {
      getStations: typeof getStations;
      getStation: typeof getStation;
      getLatestObservation: typeof getLatestObservation;
    };
    map?: L.Map;
  }
}

window.api = {
  getStations,
  getStation,
  getLatestObservation,
};

console.log("API functions available via window.api");
console.log("Try: await window.api.getStations()");

/**
 * Load and display station markers on the map
 */
async function loadStations(map: L.Map): Promise<void> {
  showLoading("Loading buoy stations...");

  try {
    // Fetch all stations (high limit to get all active stations)
    const response = await getStations(1, 1000);

    console.log(`Fetched ${response.data.length} stations`);

    // Check if any stations were returned
    if (response.data.length === 0) {
      hideLoading();
      showError(
        "No stations available. Please check that the database has been seeded.",
        false
      );
      return;
    }

    // Add markers to map
    addStationMarkers(map, response.data);

    hideLoading();
    hideError(); // Clear any previous errors
    resetRetryCount(); // Reset retry counter on success
    console.log("Stations loaded successfully");
  } catch (error) {
    hideLoading();
    console.error("Failed to load stations:", error);

    // Get user-friendly error message
    const errorMessage =
      error instanceof ApiRequestError
        ? error.getUserMessage()
        : "Failed to load station data. Please try again.";

    // Show error with retry button
    showError(errorMessage, true, () => {
      void loadStations(map);
    });
  }
}

// Initialize map when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");

  // Wrap async logic in immediately invoked function
  void (async () => {
    try {
      // Initialize the Leaflet map
      const map = initMap("map");
      console.log("Map initialized successfully");

      // Store map reference globally for debugging
      window.map = map;
      console.log("Map instance available at window.map");

      // Load and display stations
      await loadStations(map);
    } catch (error) {
      console.error("Failed to initialize application:", error);
      hideLoading();

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize the map application. Please refresh the page.";

      showError(errorMessage, true, () => {
        window.location.reload();
      });
    }
  })();
});
