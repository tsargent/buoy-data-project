/**
 * Map management module for initializing and managing the Leaflet map
 */

import L from "leaflet";
import { MAP_CONFIG } from "../config.js";

/**
 * Initialize the Leaflet map with OpenStreetMap tiles
 *
 * @param containerId - ID of the HTML element to contain the map
 * @returns Leaflet Map instance
 */
export function initMap(containerId: string): L.Map {
  // Create map instance centered on US coasts
  const map = L.map(containerId, {
    center: [MAP_CONFIG.defaultCenter.lat, MAP_CONFIG.defaultCenter.lng],
    zoom: MAP_CONFIG.defaultZoom,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    zoomControl: true, // Show zoom controls (+/-)
    scrollWheelZoom: true, // Allow zoom with mouse wheel
    doubleClickZoom: true, // Allow zoom on double click
    dragging: true, // Allow panning by dragging
  });

  // Add OpenStreetMap tile layer as primary
  const osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 3,
    }
  );

  // Add CARTO as fallback tile provider
  const cartoLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      minZoom: 3,
    }
  );

  // Add OSM as default layer
  osmLayer.addTo(map);

  // Add layer control to switch between map styles
  const baseMaps = {
    OpenStreetMap: osmLayer,
    "CARTO Voyager": cartoLayer,
  };

  L.control.layers(baseMaps).addTo(map);

  // Log map initialization
  console.log(
    `Map initialized at [${MAP_CONFIG.defaultCenter.lat}, ${MAP_CONFIG.defaultCenter.lng}], zoom: ${MAP_CONFIG.defaultZoom}`
  );

  // Handle tile loading errors
  osmLayer.on("tileerror", (error) => {
    console.warn("OSM tile failed to load, fallback available:", error);
  });

  cartoLayer.on("tileerror", (error) => {
    console.warn("CARTO tile failed to load:", error);
  });

  return map;
}
