import { getStations, getStation } from "./api/stations.js";
import { getLatestObservation } from "./api/observations.js";
import { API_BASE_URL } from "./config.js";
import { initMap } from "./map/map-manager.js";
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

// Initialize map when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");

  try {
    // Initialize the Leaflet map
    const map = initMap("map");
    console.log("Map initialized successfully");

    // Store map reference globally for debugging
    window.map = map;
    console.log("Map instance available at window.map");
  } catch (error) {
    console.error("Failed to initialize map:", error);
  }
});
