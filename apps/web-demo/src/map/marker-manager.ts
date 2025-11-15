/**
 * Marker management module for creating and managing station markers on the map
 */

import L from "leaflet";
import type { Station, Observation } from "../types.js";
import { DataFreshness, FRESHNESS_COLORS } from "../types.js";
import { buildStationPopup, buildObservationError } from "./popup-builder.js";
import { getLatestObservation } from "../api/observations.js";
import { CACHE_CONFIG } from "../config.js";

// Store marker references and station data for later updates
const markerMap = new Map<string, { marker: L.Marker; station: Station }>();

// Observation cache: stationId -> {observation, timestamp}
const observationCache = new Map<
  string,
  { observation: Observation | null; timestamp: number }
>();

// Create reusable colored marker icons (one per color)
const markerIcons = {
  green: createColoredIcon(FRESHNESS_COLORS[DataFreshness.FRESH]),
  yellow: createColoredIcon(FRESHNESS_COLORS[DataFreshness.AGING]),
  gray: createColoredIcon(FRESHNESS_COLORS[DataFreshness.STALE]),
};

/**
 * Create a colored marker icon using Leaflet's divIcon
 *
 * @param color - Color for the marker (green, yellow, gray)
 * @returns Leaflet DivIcon instance
 */
function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "custom-marker",
    html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
}

/**
 * Calculate data age in hours from a timestamp
 *
 * @param timestamp - ISO timestamp string or null
 * @returns Age in hours, or Infinity if null
 */
function calculateDataAge(timestamp: string | null | undefined): number {
  if (!timestamp) {
    return Infinity;
  }

  const observedAt = new Date(timestamp);
  const now = new Date();
  const ageMs = now.getTime() - observedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours;
}

/**
 * Determine marker color based on data freshness
 *
 * @param lastObservationTime - Last observation timestamp or null
 * @returns Color category: 'green', 'yellow', or 'gray'
 */
function getMarkerColor(
  lastObservationTime: string | null | undefined
): "green" | "yellow" | "gray" {
  const ageHours = calculateDataAge(lastObservationTime);

  if (ageHours < 6) {
    return "green"; // Fresh data < 6 hours
  } else if (ageHours < 24) {
    return "yellow"; // Aging data 6-24 hours
  } else {
    return "gray"; // Stale data > 24 hours or no data
  }
}

/**
 * Add station markers to the map
 *
 * @param map - Leaflet Map instance
 * @param stations - Array of station data
 */
export function addStationMarkers(map: L.Map, stations: Station[]): void {
  console.log(`Adding ${stations.length} station markers to map`);

  // Clear existing markers
  clearMarkers();

  let filteredCount = 0;

  // Validate and add markers for each station
  stations.forEach((station) => {
    // Validate coordinates
    if (!isValidCoordinate(station.lat, station.lon)) {
      console.warn(
        `Invalid coordinates for station ${station.id}: [${station.lat}, ${station.lon}]`
      );
      return;
    }

    // Filter out stations with no observations in last 24 hours
    const ageHours = calculateDataAge(station.lastObservationAt);
    if (ageHours >= 24) {
      console.log(
        `Filtering out station ${station.id} with data age ${ageHours.toFixed(1)} hours`
      );
      filteredCount++;
      return;
    }

    // Determine marker color based on data freshness
    const color = getMarkerColor(station.lastObservationAt);
    const icon = markerIcons[color];

    // Create marker at station location with colored icon
    const marker = L.marker([station.lat, station.lon], {
      title: station.name,
      icon,
    });

    // Bind popup with station information
    const popupContent = buildStationPopup(station);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      minWidth: 250,
    });

    // Add event listener for popup open to fetch observation data
    marker.on("popupopen", () => {
      void fetchAndUpdateObservation(station.id, marker);
    });

    // Add marker to map
    marker.addTo(map);

    // Store marker reference with station data
    markerMap.set(station.id, { marker, station });
  });

  console.log(
    `Successfully added ${markerMap.size} markers to map (filtered ${filteredCount} stale stations)`
  );
}

/**
 * Validate latitude and longitude coordinates
 *
 * @param lat - Latitude value
 * @param lon - Longitude value
 * @returns True if coordinates are valid
 */
function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Clear all markers from the map
 */
export function clearMarkers(): void {
  markerMap.forEach(({ marker }) => {
    marker.remove();
  });
  markerMap.clear();
}

/**
 * Get marker by station ID
 *
 * @param stationId - Station ID
 * @returns Marker instance or undefined
 */
export function getMarker(stationId: string): L.Marker | undefined {
  return markerMap.get(stationId)?.marker;
}

/**
 * Get station data by station ID
 *
 * @param stationId - Station ID
 * @returns Station data or undefined
 */
export function getStation(stationId: string): Station | undefined {
  return markerMap.get(stationId)?.station;
}

/**
 * Get all markers
 *
 * @returns Map of station IDs to marker/station pairs
 */
export function getAllMarkers(): Map<
  string,
  { marker: L.Marker; station: Station }
> {
  return markerMap;
}

/**
 * Fetch observation data and update popup
 *
 * @param stationId - Station ID
 * @param marker - Marker instance
 */
async function fetchAndUpdateObservation(
  stationId: string,
  marker: L.Marker
): Promise<void> {
  const station = markerMap.get(stationId)?.station;
  if (!station) {
    return;
  }

  // Check cache first
  const cached = observationCache.get(stationId);
  const now = Date.now();

  if (
    cached &&
    now - cached.timestamp < CACHE_CONFIG.observationCacheDuration
  ) {
    // Use cached observation
    console.log(`Using cached observation for station ${stationId}`);
    updatePopupContent(marker, station, cached.observation);
    return;
  }

  // Fetch new observation data
  try {
    console.log(`Fetching observation for station ${stationId}`);
    const observation = await getLatestObservation(stationId);

    // Cache the result
    observationCache.set(stationId, {
      observation,
      timestamp: now,
    });

    // Update popup content
    updatePopupContent(marker, station, observation);
  } catch (error) {
    console.error(
      `Failed to fetch observation for station ${stationId}:`,
      error
    );
    // Update popup with error state
    const popup = marker.getPopup();
    if (popup) {
      popup.setContent(
        buildStationPopup(station, null) + buildObservationError()
      );
    }
  }
}

/**
 * Update popup content with observation data
 *
 * @param marker - Marker instance
 * @param station - Station data
 * @param observation - Observation data or null
 */
function updatePopupContent(
  marker: L.Marker,
  station: Station,
  observation: Observation | null
): void {
  const popup = marker.getPopup();
  if (popup) {
    popup.setContent(buildStationPopup(station, observation));
  }
}
