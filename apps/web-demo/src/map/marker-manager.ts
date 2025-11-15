/**
 * Marker management module for creating and managing station markers on the map
 */

import L from "leaflet";
import type { Station } from "../types.js";
import { buildStationPopup } from "./popup-builder.js";

// Store marker references and station data for later updates
const markerMap = new Map<string, { marker: L.Marker; station: Station }>();

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

  // Validate and add markers for each station
  stations.forEach((station) => {
    // Validate coordinates
    if (!isValidCoordinate(station.lat, station.lon)) {
      console.warn(
        `Invalid coordinates for station ${station.id}: [${station.lat}, ${station.lon}]`
      );
      return;
    }

    // Create marker at station location
    const marker = L.marker([station.lat, station.lon], {
      title: station.name,
    });

    // Bind popup with station information
    const popupContent = buildStationPopup(station);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      minWidth: 250,
    });

    // Add marker to map
    marker.addTo(map);

    // Store marker reference with station data
    markerMap.set(station.id, { marker, station });
  });

  console.log(`Successfully added ${markerMap.size} markers to map`);
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
