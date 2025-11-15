import { getStations, getStation } from "./api/stations.js";
import { getLatestObservation } from "./api/observations.js";
import { API_BASE_URL } from "./config.js";

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
  }
}

window.api = {
  getStations,
  getStation,
  getLatestObservation,
};

console.log("API functions available via window.api");
console.log("Try: await window.api.getStations()");

// Basic initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");
  const app = document.getElementById("app");
  if (app) {
    console.log("App container found");
  }
});
