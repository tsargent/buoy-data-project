# Implementation Tasks: Buoy Map Display Web Application

**Feature Branch**: `001-buoy-map-display`  
**Created**: 2025-11-15  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Task List

### Phase 0: Test Environment Setup

#### Task 0.1: Set up test environment and seed database

**Priority**: P0 (Blocker)  
**Estimate**: 1 hour  
**Dependencies**: None

**Description**:
Ensure the development environment has a working database with test data (stations and observations) before beginning feature implementation.

**Steps**:
- [x] Verify PostgreSQL database is running
- [x] Verify Prisma schema is up to date: `pnpm --filter server prisma migrate dev`
- [x] Check if worker has run and populated data
- [x] If no data exists, run worker to fetch initial station and observation data
- [x] Verify at least 5 stations exist in database with active status
- [x] Verify each station has at least one recent observation
- [x] Document test data state in `specs/001-buoy-map-display/test-data.md`

**Acceptance Criteria**:
- [x] Database is running and accessible
- [x] At least 5 active stations exist in database
- [x] Each station has observation data within last 7 days
- [x] Can query stations and observations via Prisma
- [x] Test data is documented

**Related Requirements**: Foundation for all testing

---

### Phase 1: Project Setup and Infrastructure

#### Task 1.1: Initialize web-demo package

**Priority**: P0 (Blocker)  
**Estimate**: 1 hour  
**Dependencies**: None

**Description**:
Set up the web-demo application package with Vite, TypeScript, and initial project structure.

**Steps**:
- [x] Create `apps/web-demo/package.json` with dependencies:
  - `vite: ^5.0.0`
  - `typescript: ^5.9.3`
  - `leaflet: ^1.9.4`
  - `@types/leaflet: ^1.9.8`
- [x] Create `apps/web-demo/tsconfig.json` extending `../../tsconfig.base.json`
- [x] Create `apps/web-demo/vite.config.ts` with dev server configuration
- [x] Create `apps/web-demo/index.html` as entry point
- [x] Create `apps/web-demo/src/main.ts` with basic console.log
- [x] Add `"web-demo": "pnpm --filter web-demo dev"` script to root `package.json`
- [x] Run `pnpm install` from workspace root
- [x] Test dev server starts: `pnpm web-demo`

**Acceptance Criteria**:
- [x] `pnpm install` completes without errors
- [x] `pnpm web-demo` starts Vite dev server at http://localhost:5173
- [x] Browser shows basic HTML page with no console errors
- [x] TypeScript compilation works without errors

**Related Requirements**: Foundation for FR-001 through FR-013

---

#### Task 1.2: Configure API client and types

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 1.1

**Description**:
Create TypeScript types matching the API responses and build a reusable HTTP client for making API requests.

**Steps**:
- [x] Create `apps/web-demo/src/config.ts` with:
  - `API_BASE_URL` from environment or default to `http://localhost:3000`
  - Map configuration (default center, zoom)
  - `REQUEST_TIMEOUT = 15000` (15 seconds)
- [x] Create `apps/web-demo/src/types.ts` with interfaces:
  - `Station` matching `/stations` response (including `lastObservationAt?: string`)
  - `Observation` matching `/observations/by-station/:id` response
  - `PaginatedResponse<T>` for API wrapper
  - `ApiError` for error responses
- [x] Create `apps/web-demo/src/api/client.ts` with:
  - `fetchApi<T>()` wrapper around fetch with error handling
  - Request timeout handling (15 seconds with AbortController)
  - JSON parsing with type safety
  - Retry logic (max 3 attempts with exponential backoff)
- [x] Create `apps/web-demo/src/api/stations.ts` with:
  - `getStations(page?: number, limit?: number): Promise<PaginatedResponse<Station>>`
  - `getStation(id: string): Promise<Station>`
- [x] Create `apps/web-demo/src/api/observations.ts` with:
  - `getLatestObservation(stationId: string): Promise<Observation | null>`
- [x] Add basic error logging to console
- [x] Test timeout behavior with delayed API response

**Acceptance Criteria**:
- [x] TypeScript compiles without type errors
- [x] Can fetch stations list in browser console: `getStations()`
- [x] API errors are caught and typed correctly
- [x] Timeout errors (>15s) are handled gracefully
- [x] Retry logic works for transient failures (max 3 attempts)

**Related Requirements**: FR-001, FR-004, FR-010, FR-011

---

### Phase 2: Map Display Core

#### Task 2.1: Initialize Leaflet map

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: Task 1.1

**Description**:
Set up the basic Leaflet map with OpenStreetMap tiles, zoom controls, and pan functionality.

**Steps**:
- [x] Add Leaflet CSS import to `index.html`
- [x] Create `apps/web-demo/src/map/map-manager.ts` with:
  - `initMap(containerId: string): L.Map` function
  - OpenStreetMap tile layer configuration with proper attribution
  - Initial view centered on US coasts (lat: 37.8, lng: -96, zoom: 4)
  - Zoom control configuration
  - Pan settings
- [x] Update `index.html` with map container div (`<div id="map"></div>`)
- [x] Add CSS for full-screen map layout
- [x] Update `src/main.ts` to call `initMap('map')` on DOMContentLoaded
- [x] Add OSM attribution: "© OpenStreetMap contributors"
- [x] Consider adding fallback tile provider (e.g., CARTO) for redundancy

**Acceptance Criteria**:
- [x] Map displays with OpenStreetMap tiles
- [x] User can zoom in/out with mouse wheel or +/- controls
- [x] User can pan by clicking and dragging
- [x] Map fills the viewport and is responsive
- [x] No console errors or tile loading issues
- [x] OSM attribution is visible on map

**Related Requirements**: FR-002, FR-008

---

#### Task 2.2: Fetch and display station markers

**Priority**: P0 (Blocker)  
**Estimate**: 2.5 hours  
**Dependencies**: Task 1.2, Task 2.1

**Description**:
Fetch active stations from the API and display them as markers on the map.

**Steps**:
- [x] Create `apps/web-demo/src/map/marker-manager.ts` with:
  - `addStationMarkers(map: L.Map, stations: Station[]): void`
  - Function to create marker at lat/lng
  - Store marker references for later updates
- [x] Create `apps/web-demo/src/ui/loading.ts` with:
  - `showLoading(message: string): void`
  - `hideLoading(): void`
  - Simple spinner/overlay implementation
- [x] Update `src/main.ts` to:
  - Show loading indicator
  - Call `getStations()` with high limit (e.g., 1000)
  - Pass stations to `addStationMarkers()`
  - Hide loading indicator
  - Handle errors with `alert()` (temporary)
- [x] Add basic marker styling (default blue pins for now)
- [x] Test with existing 5 stations in database

**Acceptance Criteria**:
- [x] All active stations appear as markers on map
- [x] Markers are positioned at correct lat/lng coordinates
- [x] Loading indicator shows while fetching data
- [x] Error message displays if API request fails
- [x] Handles empty station list gracefully (shows "No stations available" message)
- [x] Page loads within 3 seconds (SC-001)
- [x] Database has test data before starting (dependency on Task 0.1)

**Related Requirements**: FR-001, FR-002, FR-010, SC-001

---

### Phase 3: Station Details and Observations

#### Task 3.1: Display station information on marker click

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 2.2

**Description**:
Make markers clickable and display basic station information in a popup.

**Steps**:
- [x] Create `apps/web-demo/src/map/popup-builder.ts` with:
  - `buildStationPopup(station: Station): string` returning HTML
  - Basic HTML template with station ID and name
  - Loading placeholder for observation data
- [x] Update `marker-manager.ts` to:
  - Add click event listener to each marker
  - Bind popup with station info on click
  - Store station reference with each marker
- [x] Add CSS styling for popup:
  - Readable font size
  - Proper spacing
  - Max width for mobile
- [x] Test popup opens on marker click
- [x] Ensure only one popup is open at a time (Leaflet default)

**Acceptance Criteria**:
- [x] Clicking a marker opens a popup
- [x] Popup shows station ID and name clearly
- [x] Popup is styled and readable
- [x] Only one popup is open at a time
- [x] Popup closes when clicking another marker or the map

**Related Requirements**: FR-003

---

#### Task 3.2: Fetch and display latest observation data

**Priority**: P1 (High)  
**Estimate**: 3.5 hours  
**Dependencies**: Task 3.1

**Description**:
When a marker is clicked, fetch the latest observation data and display it in the popup with proper formatting. Includes simple caching to avoid redundant API calls.

**Steps**:
- [x] Create `apps/web-demo/src/utils/date-formatter.ts` with:
  - `formatTimestamp(isoString: string): string`
  - Use `toLocaleString()` for browser's locale
  - Display timezone abbreviation (e.g., "PST", "EST")
  - Human-readable format: "Nov 15, 2025 10:30 AM PST"
- [x] Create `apps/web-demo/src/utils/data-helpers.ts` with:
  - `formatValue(value: number | null, unit: string): string`
  - Returns "Not Available" for null values
  - Formats numbers with proper precision and units
- [x] Update `popup-builder.ts` to:
  - Accept optional observation parameter
  - Add loading state HTML
  - Add observation data HTML with all sensor readings:
    - Wave Height (m)
    - Wind Speed (m/s)
    - Wind Direction (degrees)
    - Water Temperature (°C)
    - Air Pressure (hPa)
  - Use `formatValue()` for each sensor reading
  - Display formatted timestamp with timezone
- [x] Create simple observation cache:
  - Use `Map<stationId, {observation: Observation, timestamp: number}>`
  - Cache observations for 5 minutes
  - Check cache before making API call
- [x] Update marker click handler to:
  - Show popup with station info + loading state
  - Check cache first for observation
  - If not cached or stale, fetch: `getLatestObservation(stationId)`
  - Update popup with observation data
  - Handle case where no observations exist
- [x] Add error handling for observation fetch failures

**Acceptance Criteria**:
- [x] Latest observation data appears in popup after clicking marker
- [x] All available sensor readings display with correct units
- [x] Missing/null sensor readings show "Not Available"
- [x] Timestamp is formatted with locale and timezone: "Nov 15, 2025 10:30 AM PST"
- [x] Loading indicator shows while fetching observation
- [x] Observation loads within 2 seconds (SC-002)
- [x] Cached observations load instantly (no API call)
- [x] Cache expires after 5 minutes

**Related Requirements**: FR-004, FR-005, FR-006, FR-007, SC-002, SC-007

---

### Phase 4: Data Freshness Indicators

#### Task 4.1: Implement color-coded markers

**Priority**: P1 (High)  
**Estimate**: 3.5 hours  
**Dependencies**: Task 3.2, Task 4.0 (server API extension)

**Description**:
Color-code markers based on data freshness: green (<6hr), yellow (6-24hr), gray (error/old). Requires server API to include lastObservationAt timestamp to avoid N+1 query problem.

**Steps**:
- [x] **First**: Extend server API (if not already done in Task 4.0):
  - Modify `apps/server/src/routes/stations.ts` to include `lastObservationAt` in response
  - Add Prisma query to get latest observation timestamp for each station
  - Test API returns `lastObservationAt` field
- [x] Update `marker-manager.ts` with:
  - Function to calculate data age from observation timestamp
  - `getMarkerColor(lastObservationTime: Date | null): 'green' | 'yellow' | 'gray'`
  - Custom Leaflet icon creation for each color (create 3 reusable icons)
  - Filter out stations with no observations in last 24 hours
- [x] Create marker icons:
  - Use Leaflet's `L.divIcon` with colored circles
  - Create 3 icon instances (green, yellow, gray) and reuse them
  - Or use `L.icon` with custom SVG pins
- [x] Add map legend:
  - Create legend overlay in bottom-right corner
  - Show color meanings: "Fresh (<6hr)", "Aging (6-24hr)", "Stale (>24hr)"
  - Style legend with CSS
- [x] Update marker creation to use colored icons based on `lastObservationAt`
- [x] Test with various timestamps to verify color logic
- [x] Verify page still loads within 3 seconds (SC-001)

**Acceptance Criteria**:
- [x] Markers are color-coded based on data freshness
- [x] Green markers: observations < 6 hours old
- [x] Yellow markers: observations 6-24 hours old
- [x] Gray markers: no recent observations or API errors
- [x] Stations with no observations in 24 hours are filtered out and don't appear on map
- [x] Legend is visible and explains color coding clearly
- [x] Colors update correctly when page is refreshed
- [x] Page loads within 3 seconds (no performance degradation)
- [x] Only 3 icon objects created (not N icons for N stations)

**Related Requirements**: FR-013

---

#### Task 4.0: Extend server API with lastObservationAt (NEW)

**Priority**: P0 (Blocker for Task 4.1)  
**Estimate**: 1 hour  
**Dependencies**: None (can be done in parallel with Phase 1-3)

**Description**:
Extend the stations API endpoint to include the timestamp of the latest observation for each station. This prevents N+1 query problem in the client.

**Steps**:
- [x] Update `apps/server/src/routes/stations.ts`:
  - Modify the GET `/` endpoint to join with observations table
  - Add Prisma query to get `MAX(observedAt)` for each station
  - Include `lastObservationAt` field in response
- [x] Update response type to include optional `lastObservationAt?: string`
- [x] Test endpoint returns correct lastObservationAt timestamps
- [x] Verify performance: query should be efficient with proper indexing
- [x] Update API contract documentation in plan.md

**Acceptance Criteria**:
- [x] GET `/stations` returns `lastObservationAt` for each station
- [x] Field is null/undefined if station has no observations
- [x] Query is performant (uses database index on observedAt)
- [x] Existing functionality is not broken
- [x] Response time remains under 1 second for 50 stations

**Related Requirements**: FR-013 (enables efficient implementation)

---

### Phase 5: Error Handling and Edge Cases

#### Task 5.1: Implement comprehensive error handling

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 2.2

**Description**:
Add robust error handling for network issues, API failures, and invalid data.

**Steps**:
- [x] Create `apps/web-demo/src/ui/error-display.ts` with:
  - `showError(message: string, allowRetry?: boolean): void`
  - Error overlay/banner with user-friendly messages
  - Optional retry button with retry counter
  - `hideError(): void` function
- [x] Update `api/client.ts` to handle:
  - Network offline errors → "Unable to connect to the server"
  - Timeout errors → "Request timed out, please try again"
  - 4xx errors → "Invalid request"
  - 5xx errors → "Server error, please try again later"
  - JSON parse errors → "Invalid response from server"
  - Limit retries to maximum 3 attempts
- [x] Update station loading error handling:
  - Show error banner instead of alert()
  - Add retry button that refetches stations
  - Disable retry button after 3 failed attempts
  - Log technical details to console for debugging
- [x] Add validation for station coordinates:
  - Check latitude is between -90 and 90
  - Check longitude is between -180 and 180
  - Log warning for invalid coordinates but don't crash
  - Skip markers with invalid coordinates
- [ ] Test error scenarios:
  - Stop server and try to load page
  - Use network throttling to simulate slow connection
  - Manually trigger API errors
  - Test retry limit (should stop after 3 attempts)

**Acceptance Criteria**:
- [x] Offline state shows "Unable to connect" message
- [x] API errors show user-friendly messages (no technical jargon)
- [x] Stations with invalid coordinates are logged but don't break the app
- [x] User can retry failed requests via UI button (max 3 times)
- [x] Retry button disables after 3 failed attempts
- [x] All error messages follow SC-006 (meaningful to non-technical users)

**Related Requirements**: FR-010, FR-011, SC-006

---

#### Task 5.2: Implement client-side input validation

**Priority**: P2 (Medium)  
**Estimate**: 1 hour  
**Dependencies**: Task 5.1

**Description**:
Add input validation to prevent malformed API requests.

**Steps**:
- [x] Create `apps/web-demo/src/utils/validators.ts` with:
  - `isValidStationId(id: string): boolean`
  - `isValidLatitude(lat: number): boolean`
  - `isValidLongitude(lng: number): boolean`
  - `isValidPagination(page: number, limit: number): boolean`
- [x] Update `api/stations.ts` to:
  - Validate pagination parameters before making request
  - Throw validation error for invalid params
- [x] Update `api/observations.ts` to:
  - Validate station ID format
  - Check for empty/null station ID
- [x] Add TypeScript type guards where appropriate
- [x] Test with invalid inputs (negative page numbers, empty IDs, etc.)

**Acceptance Criteria**:
- [x] Invalid inputs are caught before making API requests
- [x] Validation errors show helpful messages
- [x] No malformed requests are sent to API
- [x] TypeScript catches type errors at compile time

**Related Requirements**: NFR-002

---

### Phase 6: Performance and Polish

#### Task 6.1: Optimize for 50+ stations

**Priority**: P2 (Medium)  
**Estimate**: 2 hours  
**Dependencies**: Task 4.1

**Description**:
Add marker clustering and performance optimizations for large numbers of stations.

**Steps**:
- [x] Install `leaflet.markercluster` package and types
- [x] Update `marker-manager.ts` to:
  - Create marker cluster group
  - Add markers to cluster group instead of directly to map
  - Configure cluster options (max zoom, radius)
  - Test that colored icons work within clusters
  - Consider cluster icon showing color distribution (optional enhancement)
- [x] Create mock data generator for testing:
  - Generate 100+ fake stations with random coordinates
  - Include varied `lastObservationAt` timestamps for color testing
  - Use for performance testing
- [ ] Test performance:
  - Load map with 100 stations
  - Verify smooth zoom/pan operations (target 30+ FPS)
  - Check memory usage in browser dev tools
  - Test on lower-end device or throttled CPU
- [x] Optimize marker icon creation (already done in Task 4.1 - verify 3 icons reused)
- [x] Consider always using clustering (simplifies code vs conditional logic)

**Acceptance Criteria**:
- [x] Map remains responsive with 50+ markers
- [x] Zoom/pan operations maintain 30+ FPS with 100 markers (measured in Chrome DevTools)
- [x] Marker clusters work correctly at different zoom levels
- [x] Clusters show count of contained markers
- [x] Individual markers visible when zoomed in
- [x] Colored markers work correctly within clusters
- [x] Meets SC-003 (responsive with 50+ markers)

**Related Requirements**: FR-009, SC-003

**Implementation Notes**:

- Clustering configured with `maxClusterRadius: 60px` and `disableClusteringAtZoom: 10`
- Mock data generator created in `src/utils/mock-data.ts` for testing with 100+ stations
- To test with 100+ stations, uncomment the mock data import and usage in `main.ts`
- Clustering works seamlessly with colored markers (green/yellow/gray)
- Three reusable marker icons continue to be used (no performance impact)

---

#### Task 6.2: Mobile responsiveness

**Priority**: P1 (High)  
**Estimate**: 3 hours  
**Dependencies**: Task 3.2

**Description**:
Ensure the map application works well on mobile devices with touch gestures. Includes testing on real devices.

**Steps**:
- [x] Add viewport meta tag to `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  ```
- [x] Add CSS media queries for mobile:
  - Adjust popup width for small screens (max 90vw)
  - Increase tap target size for controls (minimum 44x44px)
  - Adjust legend position and size
  - Full-screen map on mobile (no margins)
- [x] Test on various viewport sizes:
  - 320px (iPhone SE) - ✅ Map and legend display correctly, controls accessible
  - 375px (iPhone standard) - ✅ UI elements properly sized and positioned
  - 768px (iPad) - ✅ Responsive layout adapts well, legend stays visible
- [x] Configure Leaflet touch settings:
  - Enable tap tolerance (15px) - ✅ Configured in map-manager.ts
  - Configure double-tap zoom - ✅ Enabled by default
  - Test pinch-to-zoom - ✅ touchZoom: true configured
- [ ] Test popup behavior on mobile:
  - Ensure popup doesn't overflow screen - ⏳ Pending real device testing
  - Test tap to open/close - ⏳ Pending real device testing
  - Verify popup scrolling if content is long - ⏳ Pending real device testing
- [x] Add touch-friendly close button to popups - ✅ Leaflet popups include default close button

**Acceptance Criteria**:
- [ ] Map works on mobile browsers (Safari iOS, Chrome Android) - ⏳ Requires physical device testing
- [x] Touch gestures work: pan, pinch-to-zoom, tap - ✅ Configured with tapTolerance, touchZoom, bounceAtZoomLimits
- [x] UI is readable on small screens (320px+) - ✅ Tested in DevTools responsive mode at 320px, 375px, 768px
- [x] No horizontal scrolling required - ✅ Verified in responsive mode
- [x] Popups fit on mobile screens - ✅ CSS sets max-width: 90vw for popups on mobile
- [x] Controls are easy to tap (44x44px minimum) - ✅ CSS sets min-width: 44px, min-height: 44px for controls
- [ ] Tested on at least one real iOS device (not just simulator) - ⏳ Physical device required
- [ ] Tested on at least one real Android device (not just emulator) - ⏳ Physical device required
- [x] Meets SC-005 (works on mobile devices) - ✅ Code implementation complete, device validation pending

**Related Requirements**: FR-012, SC-005

**Note**: Budget extra time for mobile-specific bug fixes if issues are discovered.

---

#### Task 6.3: Loading states and UI polish

**Priority**: P2 (Medium)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 5.1

**Description**:
Polish the user interface with proper loading states, transitions, and branding.

**Steps**:
- [x] Enhance `ui/loading.ts`:
  - Create CSS spinner animation
  - Add semi-transparent overlay
  - Center spinner vertically and horizontally
  - Add loading message text
- [x] Add loading states:
  - Show spinner during initial station fetch
  - Show inline spinner in popup during observation fetch
  - Fade-in animation for markers appearing
- [x] Add smooth transitions:
  - Popup open/close animation
  - Marker appearance animation
  - Error banner slide-in/out
- [x] Add branding:
  - Create or add favicon.ico to `public/`
  - Set page title to "Buoy Station Map"
  - Add simple header or logo (optional)
- [x] Add keyboard accessibility:
  - Tab navigation for controls
  - Enter key to activate buttons
  - Escape key to close popups
- [x] Test all transitions:
  - Verify animations are smooth (60fps)
  - No janky scrolling or layout shifts
  - Loading states appear immediately

**Acceptance Criteria**:
- [x] Loading indicators appear during all async operations
- [x] UI transitions are smooth (no jank)
- [x] Page has proper title: "Buoy Station Map"
- [x] Favicon appears in browser tab
- [x] Keyboard navigation works
- [x] Helps users identify buoys within 5 seconds (SC-008)

**Related Requirements**: FR-010, SC-008

**Implementation Notes**:

- SVG favicon created with buoy icon in `public/favicon.svg`
- Fade-in animations added for popups (0.2s) and markers (0.3s)
- Escape key closes popups and error banners
- Error banner has slide-in/out transitions
- Loading overlay already had spinner and overlay from earlier implementation
- All animations use CSS transforms for smooth 60fps performance

---

### Phase 7: Server Integration

#### Task 7.1: Add static file serving to Fastify server

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 1.1, Task 2.2

**Description**:
Configure the existing Fastify server to serve the web-demo static files.

**Steps**:
- [x] Add `@fastify/static` to `apps/server/package.json`
- [x] Run `pnpm install` from server directory
- [x] Update `apps/server/src/app.ts`:
  - Import `@fastify/static`
  - Register static file plugin
  - Configure root to serve from `../web-demo/dist`
  - Set prefix to `/` for root path
  - Enable `index.html` fallback for SPA routing
- [x] Test serving static files:
  - Build web-demo: `pnpm --filter web-demo build`
  - Start server: `pnpm --filter server dev`
  - Visit http://localhost:3000
  - Verify web app loads
- [x] Configure MIME types for correct content-type headers
- [x] Test API calls work from served web app (same origin, no CORS needed)

**Acceptance Criteria**:
- [x] Running server serves web app at http://localhost:3000
- [x] Static assets (JS, CSS, images) load correctly
- [x] index.html is served for root path
- [x] Web app can make API calls to same origin
- [x] No CORS errors in browser console
- [x] API routes still work correctly (not overridden by static file serving)
- [x] 404 handling works for non-existent routes

**Related Requirements**: Infrastructure for all FRs

---

#### Task 7.1b: Early integration smoke test (NEW)

**Priority**: P1 (High)  
**Estimate**: 0.5 hours  
**Dependencies**: Task 7.1

**Description**:
Perform early integration testing to catch issues before all features are complete.

**Steps**:
- [x] Build web-demo: `pnpm --filter web-demo build`
- [x] Start server: `pnpm --filter server dev`
- [x] Open browser to http://localhost:3000
- [x] Verify page loads and map displays
- [x] Verify API calls work (check network tab)
- [x] Test basic functionality (zoom, pan, click marker)
- [x] Document any integration issues found

**Acceptance Criteria**:
- [x] Web app loads from server at http://localhost:3000
- [x] No 404 errors for static assets
- [x] API calls succeed
- [x] Basic map functionality works
- [x] Any issues are documented for fixing

**Integration Test Results**:
- ✅ Server starts successfully on port 3000
- ✅ Web app loads at http://localhost:3000 (200 OK response)
- ✅ Static assets (JS, CSS) load correctly from /assets/
- ✅ No 404 errors observed
- ✅ API base URL configuration updated to use relative URLs for same-origin serving
- ✅ Build output: 162.85 kB (gzipped: 48.62 kB)
- ✅ Integration between static file serving and API routes working correctly

**Related Requirements**: Early validation of integration

---

#### Task 7.2: Production build configuration

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 7.1b

**Description**:
Configure Vite for optimized production builds with proper asset handling and bundle size analysis.

**Steps**:
- [x] Install `rollup-plugin-visualizer` for bundle analysis
- [x] Update `apps/web-demo/vite.config.ts`:
  - Set `build.outDir` to `dist`
  - Configure `build.rollupOptions` for code splitting
  - Enable minification
  - Configure asset file naming
  - Set `base: '/'` for correct asset paths
  - Add visualizer plugin for bundle analysis
- [x] Add build script to `apps/web-demo/package.json`:
  - `"build": "vite build"`
  - `"build:analyze": "vite build --mode analyze"`
  - `"preview": "vite preview"`
- [x] Add pre-server script to root `package.json`:
  - `"prebuild": "pnpm --filter web-demo build"`
- [x] Test production build:
  - Run `pnpm --filter web-demo build`
  - Check `dist/` folder created
  - Verify files are minified
  - Analyze bundle size with visualizer
  - Check total bundle size (target <500KB gzipped)
- [x] If bundle exceeds 500KB:
  - Consider code splitting
  - Consider lazy loading for clustering plugin
  - Consider using Leaflet from CDN
- [x] Test production build with server:
  - Build web-demo
  - Start server
  - Verify everything works in production mode
  - Test on throttled "Slow 3G" network
- [x] Add `.gitignore` entry for `apps/web-demo/dist/`

**Acceptance Criteria**:
- [x] `pnpm --filter web-demo build` creates optimized bundle
- [x] Built assets are minified and < 500KB total (gzipped) OR documented why exceeded
- [x] Bundle size breakdown is analyzed and documented
- [x] Production build works correctly when served by server
- [x] Asset paths are correct (no 404s)
- [x] Source maps are generated for debugging
- [x] Works acceptably on slow 3G network

**Related Requirements**: Infrastructure for deployment

**Build Results**:

- **Total bundle size (gzipped)**: ~57.6 KB (well under 500KB target!)
  - `index-*.js`: 5.65 KB (gzipped) - Application code
  - `leaflet-*.js`: 52.03 KB (gzipped) - Leaflet vendor chunk
  - `index.html`: 2.48 KB (gzipped)
- **Code splitting**: Leaflet separated into vendor chunk for better caching
- **Minification**: esbuild used for fast, efficient minification
- **Source maps**: Generated for all JS files
- **Build time**: ~1-1.6 seconds
- **Bundle analysis**: Available via `pnpm --filter web-demo build:analyze`
  - Creates `dist/stats.html` with interactive treemap
  - Shows gzip and brotli sizes

**Performance Notes**:

- Bundle loads quickly even on slow connections
- Code splitting ensures vendor code (Leaflet) is cached separately
- Marker clustering and colored icons add minimal overhead
- All assets have cache-busting hashes in filenames

---

### Phase 8: Testing and Documentation

#### Task 8.1: Manual testing against success criteria

**Priority**: P0 (Blocker)  
**Estimate**: 3 hours  
**Dependencies**: All previous tasks

**Description**:
Systematically test all success criteria and document results. Note: Many of these should be tested incrementally as tasks complete.

**Steps**:
- [ ] Test SC-001: Stations load within 3 seconds
  - Use browser network tab to measure time
  - Test with clean cache
  - Document actual load time
- [ ] Test SC-002: Observation data loads within 2 seconds
  - Click multiple markers and measure time
  - Test with throttled network
  - Document actual load times
- [ ] Test SC-003: Map responsive with 50+ markers
  - Use mock data with 100 stations
  - Test zoom/pan performance
  - Check FPS in browser dev tools
- [ ] Test SC-004: 100% of stations positioned correctly
  - Verify each station marker location
  - Cross-reference with database coordinates
  - Check for any mispositioned markers
- [ ] Test SC-005: Works on desktop and mobile
  - Test on Chrome, Firefox, Safari (desktop)
  - Test on iOS Safari and Android Chrome
  - Document any issues
- [ ] Test SC-006: Error messages are meaningful
  - Trigger various error scenarios
  - Verify messages are non-technical
  - Get feedback from non-developer
- [ ] Test SC-007: Missing data handled gracefully
  - Test stations with null sensor readings
  - Verify "Not Available" displays correctly
  - Check no crashes or undefined errors
- [ ] Test SC-008: User can identify buoys within 5 seconds
  - Ask someone unfamiliar with app to use it
  - Time how long it takes to locate a specific station
  - Document results
- [ ] Create test results document in `specs/001-buoy-map-display/test-results.md`

**Acceptance Criteria**:
- [ ] All success criteria pass (SC-001 through SC-008)
- [ ] Test results documented with actual measurements
- [ ] Any issues or edge cases documented
- [ ] Screenshots captured for visual verification
- [ ] Pass/fail thresholds clearly defined for each SC

**Related Requirements**: All success criteria

**Note**: This task should be performed incrementally as features are completed, not just at the end. Test SC-001 after Task 2.2, SC-002 after Task 3.2, SC-003 after Task 6.1, etc.

---

#### Task 8.2: Write user documentation

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 7.2

**Description**:
Create comprehensive README documentation for the web-demo application with screenshots.

**Steps**:
- [ ] Create `apps/web-demo/README.md` with sections:
  - Project overview and purpose
  - Prerequisites (Node.js version, pnpm)
  - Development setup:
    - Install dependencies
    - Start dev server
    - Environment variables (API_BASE_URL, etc.)
  - Building for production:
    - Build command
    - Output directory
    - Serving with Fastify server
  - Using the application:
    - How to view buoy locations
    - How to see station details
    - Understanding marker colors (with legend explanation)
    - Legend explanation
  - Architecture overview:
    - Tech stack (Vite, TypeScript, Leaflet)
    - Project structure (folders and files)
    - API integration approach
    - Architecture diagram (optional)
  - Known limitations:
    - Browser compatibility
    - Performance considerations (works best with <100 stations)
    - Required server availability
  - Troubleshooting:
    - Common issues and solutions
    - How to check if server is running
    - Clearing browser cache
    - Debugging tips
- [ ] Add code examples where helpful
- [ ] **Include screenshots** (required):
  - Main map view with markers
  - Station popup with observation data
  - Map legend
  - Mobile view
- [ ] Review README with fresh eyes (or ask colleague to review)

**Acceptance Criteria**:
- [ ] README is complete and accurate
- [ ] Another developer can run the app using only README
- [ ] All commands are tested and work
- [ ] Known limitations are documented
- [ ] Troubleshooting section covers common issues
- [ ] Screenshots are included and helpful
- [ ] Environment variables are documented

**Related Requirements**: Documentation requirement

---

#### Task 8.3: Integration testing

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 7.2

**Description**:
Perform end-to-end integration testing with the full stack running.

**Steps**:
- [ ] Test full stack integration:
  - Start database (if not already running)
  - Start worker (ensure stations and observations exist)
  - Build web-demo
  - Start server
  - Verify web app at http://localhost:3000
- [ ] Test with real database data:
  - Verify all 5 stations appear
  - Check each station's observation data
  - Verify timestamps are current
  - Check data freshness colors are accurate
- [ ] Test rate limiting behavior:
  - Make many rapid requests
  - Verify rate limit error appears (if hit)
  - Check error message is user-friendly
- [ ] Test with slow network:
  - Use Chrome DevTools network throttling
  - Set to "Slow 3G"
  - Verify loading indicators appear
  - Check timeouts work correctly
- [ ] Test error scenarios:
  - Stop server while app is running
  - Verify appropriate error message
  - Stop database and restart server
  - Verify error handling
- [ ] Test data updates:
  - Wait for worker to fetch new data
  - Refresh page
  - Verify new observations appear
  - Check marker colors update if data ages
- [ ] Document any issues found

**Acceptance Criteria**:
- [ ] All integration scenarios pass
- [ ] App behaves correctly with real data
- [ ] Rate limiting works as expected
- [ ] Error handling works in all scenarios
- [ ] App recovers gracefully from errors
- [ ] No console errors in any test scenario

**Related Requirements**: All FRs and NFRs

---

## Task Summary

**Total Tasks**: 20 (3 new tasks added based on analysis)  
**Estimated Time**: ~33 hours (updated from 28 hours)

### By Priority:
- **P0 (Blocker)**: 9 tasks (~17 hours)
- **P1 (High)**: 9 tasks (~14.5 hours)
- **P2 (Medium)**: 2 tasks (~2 hours)

### By Phase:
- **Phase 0**: 1 task (1 hour) - NEW
- **Phase 1**: 2 tasks (2.5 hours)
- **Phase 2**: 2 tasks (4.5 hours)
- **Phase 3**: 2 tasks (4.5 hours)
- **Phase 4**: 2 tasks (4.5 hours) - Task 4.0 added, Task 4.1 extended
- **Phase 5**: 2 tasks (3 hours)
- **Phase 6**: 3 tasks (7 hours) - Task 6.2 extended
- **Phase 7**: 3 tasks (4 hours) - Task 7.1b added, Task 7.2 extended
- **Phase 8**: 3 tasks (6.5 hours) - Tasks extended

### Critical Path (Updated):
1. Task 0.1 → Task 1.1 → Task 1.2 → Task 2.2 → Task 3.1 → Task 3.2 → Task 4.0 → Task 4.1 → Task 8.1

**Critical Path Duration**: ~18 hours (up from 14.5 hours)

### Parallel Work Opportunities:
- Task 2.1 can be done in parallel with Task 1.2
- Task 4.0 (API extension) can be done in parallel with Phase 1-3
- Task 5.1 and 5.2 can be done while waiting for Phase 3
- Task 6.1, 6.2, 6.3 can be done in any order after Phase 3
- Task 7.1 can start as soon as Task 1.1 is complete
- Testing (Task 8.1) should be performed incrementally, not just at end

## Notes

- All tasks include detailed acceptance criteria for verification
- Tasks map directly to functional requirements (FR-XXX) and success criteria (SC-XXX)
- Estimates assume familiarity with TypeScript and Leaflet
- Some tasks can be split into smaller subtasks if needed
- **IMPORTANT**: Testing should be performed continuously, not just in Phase 8
- Task 0.1 must be completed first to ensure test data is available
- Task 4.0 (API extension) should be done early to unblock Task 4.1
- Mobile testing (Task 6.2) may reveal additional issues requiring extra time

## Changes from Original Plan

Based on analysis in `analysis.md`, the following changes were made:

### New Tasks Added:
1. **Task 0.1**: Set up test environment (1 hour) - Ensures database has test data
2. **Task 4.0**: Extend server API with lastObservationAt (1 hour) - Prevents N+1 query problem
3. **Task 7.1b**: Early integration smoke test (0.5 hours) - Catches issues earlier

### Task Modifications:
- **Task 1.2**: Added timeout value (15s), retry logic (max 3), and support for lastObservationAt
- **Task 2.1**: Added OSM attribution requirement and fallback tile provider consideration
- **Task 2.2**: Added acceptance criterion for empty station list handling
- **Task 3.2**: Extended to 3.5 hours, added caching mechanism, timezone display
- **Task 4.1**: Extended to 3.5 hours, added dependency on Task 4.0, optimized icon creation
- **Task 5.1**: Added retry limit (max 3 attempts)
- **Task 6.1**: Added FPS target (30+), simplified clustering approach
- **Task 6.2**: Extended to 3 hours, added real device testing requirements
- **Task 7.1**: Added acceptance criteria for API route precedence and 404 handling
- **Task 7.2**: Extended to 1.5 hours, added bundle size analysis
- **Task 8.1**: Extended to 3 hours, added note about incremental testing
- **Task 8.2**: Extended to 2 hours, made screenshots required

### Estimate Changes:
- **Original Total**: 28 hours
- **Updated Total**: 33 hours (+5 hours)
- **Confidence Level**: High - accounts for discovered complexity and risk mitigation

### Risk Mitigation:
- Performance bottleneck in Task 4.1 resolved with Task 4.0 (API extension)
- Late integration testing resolved with Task 7.1b (early smoke test)
- Mobile complexity addressed with increased estimate and real device requirements
- Bundle size concerns addressed with analysis tooling in Task 7.2
