/**
 * Application configuration
 */

// API Configuration
// Use environment variable if available, otherwise default to localhost
const envApiUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL;
export const API_BASE_URL = envApiUrl || "http://localhost:3000";

// Request timeout in milliseconds (15 seconds)
export const REQUEST_TIMEOUT = 15000;

// Map Configuration
export const MAP_CONFIG = {
  // Default center on US coasts to show typical buoy coverage
  defaultCenter: { lat: 37.8, lng: -96 } as const,
  defaultZoom: 4,
  minZoom: 3,
  maxZoom: 18,
};

// Cache Configuration
export const CACHE_CONFIG = {
  // Cache observations for 5 minutes
  observationCacheDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
};
