import { getStations, getStation } from "./api/stations.js";
import { getLatestObservation } from "./api/observations.js";
import { API_BASE_URL } from "./config.js";
import { initMap } from "./map/map-manager.js";
import { addStationMarkers } from "./map/marker-manager.js";
import { showLoading, hideLoading } from "./ui/loading.js";
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
      alert(
        "No stations available. Please check that the database has been seeded."
      );
      return;
    }

    // Add markers to map
    addStationMarkers(map, response.data);

    hideLoading();
    console.log("Stations loaded successfully");
  } catch (error) {
    hideLoading();
    console.error("Failed to load stations:", error);
    alert(
      "Failed to load station data. Please ensure the API server is running at " +
        API_BASE_URL
    );
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
      alert(
        "Failed to initialize the map application. Please check the console for details."
      );
    }
  })();
});
