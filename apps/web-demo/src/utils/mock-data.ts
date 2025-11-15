/**
 * Mock data generator for testing with many stations
 */

import type { Station } from "../types.js";

/**
 * Generate mock stations for performance testing
 *
 * @param count - Number of stations to generate
 * @returns Array of mock stations with varied timestamps
 */
export function generateMockStations(count: number): Station[] {
  const stations: Station[] = [];
  const now = Date.now();

  // US coastal coordinate ranges
  const coastalRegions = [
    // East Coast (Atlantic)
    { latMin: 25, latMax: 45, lonMin: -81, lonMax: -65, name: "Atlantic" },
    // West Coast (Pacific)
    { latMin: 32, latMax: 48, lonMin: -125, lonMax: -117, name: "Pacific" },
    // Gulf Coast
    { latMin: 24, latMax: 30, lonMin: -98, lonMax: -80, name: "Gulf" },
    // Alaska
    { latMin: 55, latMax: 60, lonMin: -165, lonMax: -130, name: "Alaska" },
  ];

  for (let i = 0; i < count; i++) {
    // Randomly select a coastal region
    const region =
      coastalRegions[Math.floor(Math.random() * coastalRegions.length)];

    // Generate random coordinates within the region
    const lat = region.latMin + Math.random() * (region.latMax - region.latMin);
    const lon = region.lonMin + Math.random() * (region.lonMax - region.lonMin);

    // Generate varied timestamps for color testing
    // 60% fresh (<6hr), 30% aging (6-24hr), 10% stale (>24hr)
    let ageHours: number;
    const rand = Math.random();
    if (rand < 0.6) {
      // Fresh: 0-6 hours old
      ageHours = Math.random() * 6;
    } else if (rand < 0.9) {
      // Aging: 6-24 hours old
      ageHours = 6 + Math.random() * 18;
    } else {
      // Stale: 24-48 hours old (will be filtered out)
      ageHours = 24 + Math.random() * 24;
    }

    const lastObservationAt = new Date(
      now - ageHours * 60 * 60 * 1000
    ).toISOString();

    // Create mock station
    const station: Station = {
      id: `MOCK${i.toString().padStart(5, "0")}`,
      name: `${region.name} Buoy ${i + 1}`,
      lat: Math.round(lat * 1000) / 1000, // 3 decimal places
      lon: Math.round(lon * 1000) / 1000,
      source: "MOCK",
      isActive: true,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      lastObservationAt,
    };

    stations.push(station);
  }

  console.log(`Generated ${count} mock stations for testing`);
  return stations;
}

/**
 * Mix mock stations with real stations
 *
 * @param realStations - Real stations from API
 * @param mockCount - Number of mock stations to add
 * @returns Combined array of real and mock stations
 */
export function mixMockStations(
  realStations: Station[],
  mockCount: number
): Station[] {
  const mockStations = generateMockStations(mockCount);
  return [...realStations, ...mockStations];
}
