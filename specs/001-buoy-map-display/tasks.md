# Implementation Tasks: Buoy Map Display Web Application

**Feature Branch**: `001-buoy-map-display`  
**Created**: 2025-11-15  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Task List

### Phase 1: Project Setup and Infrastructure

#### Task 1.1: Initialize web-demo package

**Priority**: P0 (Blocker)  
**Estimate**: 1 hour  
**Dependencies**: None

**Description**:
Set up the web-demo application package with Vite, TypeScript, and initial project structure.

**Steps**:
- [ ] Create `apps/web-demo/package.json` with dependencies:
  - `vite: ^5.0.0`
  - `typescript: ^5.9.3`
  - `leaflet: ^1.9.4`
  - `@types/leaflet: ^1.9.8`
- [ ] Create `apps/web-demo/tsconfig.json` extending `../../tsconfig.base.json`
- [ ] Create `apps/web-demo/vite.config.ts` with dev server configuration
- [ ] Create `apps/web-demo/index.html` as entry point
- [ ] Create `apps/web-demo/src/main.ts` with basic console.log
- [ ] Add `"web-demo": "pnpm --filter web-demo dev"` script to root `package.json`
- [ ] Run `pnpm install` from workspace root
- [ ] Test dev server starts: `pnpm web-demo`

**Acceptance Criteria**:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm web-demo` starts Vite dev server at http://localhost:5173
- [ ] Browser shows basic HTML page with no console errors
- [ ] TypeScript compilation works without errors

**Related Requirements**: Foundation for FR-001 through FR-013

---

#### Task 1.2: Configure API client and types

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 1.1

**Description**:
Create TypeScript types matching the API responses and build a reusable HTTP client for making API requests.

**Steps**:
- [ ] Create `apps/web-demo/src/config.ts` with:
  - `API_BASE_URL` from environment or default to `http://localhost:3000`
  - Map configuration (default center, zoom)
- [ ] Create `apps/web-demo/src/types.ts` with interfaces:
  - `Station` matching `/stations` response
  - `Observation` matching `/observations/by-station/:id` response
  - `PaginatedResponse<T>` for API wrapper
  - `ApiError` for error responses
- [ ] Create `apps/web-demo/src/api/client.ts` with:
  - `fetchApi<T>()` wrapper around fetch with error handling
  - Request timeout handling
  - JSON parsing with type safety
- [ ] Create `apps/web-demo/src/api/stations.ts` with:
  - `getStations(page?: number, limit?: number): Promise<PaginatedResponse<Station>>`
  - `getStation(id: string): Promise<Station>`
- [ ] Create `apps/web-demo/src/api/observations.ts` with:
  - `getLatestObservation(stationId: string): Promise<Observation | null>`
- [ ] Add basic error logging to console

**Acceptance Criteria**:
- [ ] TypeScript compiles without type errors
- [ ] Can fetch stations list in browser console: `getStations()`
- [ ] API errors are caught and typed correctly
- [ ] Timeout errors are handled gracefully

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
- [ ] Add Leaflet CSS import to `index.html`
- [ ] Create `apps/web-demo/src/map/map-manager.ts` with:
  - `initMap(containerId: string): L.Map` function
  - OpenStreetMap tile layer configuration
  - Initial view centered on US coasts (lat: 37.8, lng: -96, zoom: 4)
  - Zoom control configuration
  - Pan settings
- [ ] Update `index.html` with map container div (`<div id="map"></div>`)
- [ ] Add CSS for full-screen map layout
- [ ] Update `src/main.ts` to call `initMap('map')` on DOMContentLoaded
- [ ] Add layer control for map type selection (if multiple tile providers)

**Acceptance Criteria**:
- [ ] Map displays with OpenStreetMap tiles
- [ ] User can zoom in/out with mouse wheel or +/- controls
- [ ] User can pan by clicking and dragging
- [ ] Map fills the viewport and is responsive
- [ ] No console errors or tile loading issues

**Related Requirements**: FR-002, FR-008

---

#### Task 2.2: Fetch and display station markers

**Priority**: P0 (Blocker)  
**Estimate**: 2.5 hours  
**Dependencies**: Task 1.2, Task 2.1

**Description**:
Fetch active stations from the API and display them as markers on the map.

**Steps**:
- [ ] Create `apps/web-demo/src/map/marker-manager.ts` with:
  - `addStationMarkers(map: L.Map, stations: Station[]): void`
  - Function to create marker at lat/lng
  - Store marker references for later updates
- [ ] Create `apps/web-demo/src/ui/loading.ts` with:
  - `showLoading(message: string): void`
  - `hideLoading(): void`
  - Simple spinner/overlay implementation
- [ ] Update `src/main.ts` to:
  - Show loading indicator
  - Call `getStations()` with high limit (e.g., 1000)
  - Pass stations to `addStationMarkers()`
  - Hide loading indicator
  - Handle errors with `alert()` (temporary)
- [ ] Add basic marker styling (default blue pins for now)
- [ ] Test with existing 5 stations in database

**Acceptance Criteria**:
- [ ] All active stations appear as markers on map
- [ ] Markers are positioned at correct lat/lng coordinates
- [ ] Loading indicator shows while fetching stations
- [ ] Error message displays if API request fails
- [ ] Page loads within 3 seconds (SC-001)

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
- [ ] Create `apps/web-demo/src/map/popup-builder.ts` with:
  - `buildStationPopup(station: Station): string` returning HTML
  - Basic HTML template with station ID and name
  - Loading placeholder for observation data
- [ ] Update `marker-manager.ts` to:
  - Add click event listener to each marker
  - Bind popup with station info on click
  - Store station reference with each marker
- [ ] Add CSS styling for popup:
  - Readable font size
  - Proper spacing
  - Max width for mobile
- [ ] Test popup opens on marker click
- [ ] Ensure only one popup is open at a time (Leaflet default)

**Acceptance Criteria**:
- [ ] Clicking a marker opens a popup
- [ ] Popup shows station ID and name clearly
- [ ] Popup is styled and readable
- [ ] Only one popup is open at a time
- [ ] Popup closes when clicking another marker or the map

**Related Requirements**: FR-003

---

#### Task 3.2: Fetch and display latest observation data

**Priority**: P1 (High)  
**Estimate**: 3 hours  
**Dependencies**: Task 3.1

**Description**:
When a marker is clicked, fetch the latest observation data and display it in the popup with proper formatting.

**Steps**:
- [ ] Create `apps/web-demo/src/utils/date-formatter.ts` with:
  - `formatTimestamp(isoString: string): string` 
  - Human-readable format: "Nov 15, 2025 10:30 AM"
- [ ] Create `apps/web-demo/src/utils/data-helpers.ts` with:
  - `formatValue(value: number | null, unit: string): string`
  - Returns "Not Available" for null values
  - Formats numbers with proper precision and units
- [ ] Update `popup-builder.ts` to:
  - Accept optional observation parameter
  - Add loading state HTML
  - Add observation data HTML with all sensor readings:
    - Wave Height (m)
    - Wind Speed (m/s)
    - Wind Direction (degrees)
    - Water Temperature (°C)
    - Air Pressure (hPa)
  - Use `formatValue()` for each sensor reading
  - Display formatted timestamp
- [ ] Update marker click handler to:
  - Show popup with station info + loading state
  - Fetch latest observation: `getLatestObservation(stationId)`
  - Update popup with observation data
  - Handle case where no observations exist
- [ ] Add error handling for observation fetch failures

**Acceptance Criteria**:
- [ ] Latest observation data appears in popup after clicking marker
- [ ] All available sensor readings display with correct units
- [ ] Missing/null sensor readings show "Not Available"
- [ ] Timestamp is formatted: "Nov 15, 2025 10:30 AM"
- [ ] Loading indicator shows while fetching observation
- [ ] Observation loads within 2 seconds (SC-002)

**Related Requirements**: FR-004, FR-005, FR-006, FR-007, SC-002, SC-007

---

### Phase 4: Data Freshness Indicators

#### Task 4.1: Implement color-coded markers

**Priority**: P1 (High)  
**Estimate**: 2.5 hours  
**Dependencies**: Task 3.2

**Description**:
Color-code markers based on data freshness: green (<6hr), yellow (6-24hr), gray (error/old).

**Steps**:
- [ ] Update `marker-manager.ts` with:
  - Function to calculate data age from observation timestamp
  - `getMarkerColor(lastObservationTime: Date | null): 'green' | 'yellow' | 'gray'`
  - Custom Leaflet icon creation for each color
  - Filter out stations with no observations in last 24 hours
- [ ] Modify station fetching to also get latest observation timestamp
  - Option A: Fetch latest observation for each station during initial load
  - Option B: Add `lastObservationAt` field to station API response
  - Choose Option A for now (no API changes needed)
- [ ] Create marker icons:
  - Use Leaflet's `L.divIcon` with colored circles
  - Or use `L.icon` with custom SVG pins
- [ ] Add map legend:
  - Create legend overlay in bottom-right corner
  - Show color meanings: Green (Fresh <6hr), Yellow (Aging 6-24hr), Gray (Stale >24hr)
  - Style legend with CSS
- [ ] Update marker creation to use colored icons
- [ ] Test with various timestamps to verify color logic

**Acceptance Criteria**:
- [ ] Markers are color-coded based on data freshness
- [ ] Green markers: observations < 6 hours old
- [ ] Yellow markers: observations 6-24 hours old
- [ ] Gray markers: no recent observations or API errors
- [ ] Stations with no observations in 24 hours don't appear on map
- [ ] Legend is visible and explains color coding
- [ ] Colors update correctly when data is refreshed

**Related Requirements**: FR-013

---

### Phase 5: Error Handling and Edge Cases

#### Task 5.1: Implement comprehensive error handling

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 2.2

**Description**:
Add robust error handling for network issues, API failures, and invalid data.

**Steps**:
- [ ] Create `apps/web-demo/src/ui/error-display.ts` with:
  - `showError(message: string, allowRetry?: boolean): void`
  - Error overlay/banner with user-friendly messages
  - Optional retry button
  - `hideError(): void` function
- [ ] Update `api/client.ts` to handle:
  - Network offline errors → "Unable to connect to the server"
  - Timeout errors → "Request timed out, please try again"
  - 4xx errors → "Invalid request"
  - 5xx errors → "Server error, please try again later"
  - JSON parse errors → "Invalid response from server"
- [ ] Update station loading error handling:
  - Show error banner instead of alert()
  - Add retry button that refetches stations
  - Log technical details to console for debugging
- [ ] Add validation for station coordinates:
  - Check latitude is between -90 and 90
  - Check longitude is between -180 and 180
  - Log warning for invalid coordinates but don't crash
  - Skip markers with invalid coordinates
- [ ] Test error scenarios:
  - Stop server and try to load page
  - Use network throttling to simulate slow connection
  - Manually trigger API errors

**Acceptance Criteria**:
- [ ] Offline state shows "Unable to connect" message
- [ ] API errors show user-friendly messages (no technical jargon)
- [ ] Stations with invalid coordinates are logged but don't break the app
- [ ] User can retry failed requests via UI button
- [ ] All error messages follow SC-006 (meaningful to non-technical users)

**Related Requirements**: FR-010, FR-011, SC-006

---

#### Task 5.2: Implement client-side input validation

**Priority**: P2 (Medium)  
**Estimate**: 1 hour  
**Dependencies**: Task 5.1

**Description**:
Add input validation to prevent malformed API requests.

**Steps**:
- [ ] Create `apps/web-demo/src/utils/validators.ts` with:
  - `isValidStationId(id: string): boolean`
  - `isValidLatitude(lat: number): boolean`
  - `isValidLongitude(lng: number): boolean`
  - `isValidPagination(page: number, limit: number): boolean`
- [ ] Update `api/stations.ts` to:
  - Validate pagination parameters before making request
  - Throw validation error for invalid params
- [ ] Update `api/observations.ts` to:
  - Validate station ID format
  - Check for empty/null station ID
- [ ] Add TypeScript type guards where appropriate
- [ ] Test with invalid inputs (negative page numbers, empty IDs, etc.)

**Acceptance Criteria**:
- [ ] Invalid inputs are caught before making API requests
- [ ] Validation errors show helpful messages
- [ ] No malformed requests are sent to API
- [ ] TypeScript catches type errors at compile time

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
- [ ] Install `leaflet.markercluster` package and types
- [ ] Update `marker-manager.ts` to:
  - Create marker cluster group
  - Add markers to cluster group instead of directly to map
  - Configure cluster options (max zoom, radius)
  - Keep color coding within clusters
- [ ] Create mock data generator for testing:
  - Generate 100+ fake stations with random coordinates
  - Use for performance testing
- [ ] Test performance:
  - Load map with 100 stations
  - Verify smooth zoom/pan operations
  - Check memory usage in browser dev tools
- [ ] Add conditional clustering (only if >50 stations)
- [ ] Optimize marker icon creation (reuse icons instead of creating new ones)

**Acceptance Criteria**:
- [ ] Map remains responsive with 50+ markers
- [ ] Zoom/pan operations are smooth (no lag)
- [ ] Marker clusters work correctly at different zoom levels
- [ ] Clusters show count of contained markers
- [ ] Individual markers visible when zoomed in
- [ ] Meets SC-003 (responsive with 50+ markers)

**Related Requirements**: FR-009, SC-003

---

#### Task 6.2: Mobile responsiveness

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 3.2

**Description**:
Ensure the map application works well on mobile devices with touch gestures.

**Steps**:
- [ ] Add viewport meta tag to `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  ```
- [ ] Add CSS media queries for mobile:
  - Adjust popup width for small screens (max 90vw)
  - Increase tap target size for controls (minimum 44x44px)
  - Adjust legend position and size
  - Full-screen map on mobile (no margins)
- [ ] Test on various viewport sizes:
  - 320px (iPhone SE)
  - 375px (iPhone standard)
  - 768px (iPad)
- [ ] Configure Leaflet touch settings:
  - Enable tap tolerance
  - Configure double-tap zoom
  - Test pinch-to-zoom
- [ ] Test popup behavior on mobile:
  - Ensure popup doesn't overflow screen
  - Test tap to open/close
  - Verify popup scrolling if content is long
- [ ] Add touch-friendly close button to popups

**Acceptance Criteria**:
- [ ] Map works on mobile browsers (Safari iOS, Chrome Android)
- [ ] Touch gestures work: pan, pinch-to-zoom, tap
- [ ] UI is readable on small screens (320px+)
- [ ] No horizontal scrolling required
- [ ] Popups fit on mobile screens
- [ ] Controls are easy to tap (44x44px minimum)
- [ ] Meets SC-005 (works on mobile devices)

**Related Requirements**: FR-012, SC-005

---

#### Task 6.3: Loading states and UI polish

**Priority**: P2 (Medium)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 5.1

**Description**:
Polish the user interface with proper loading states, transitions, and branding.

**Steps**:
- [ ] Enhance `ui/loading.ts`:
  - Create CSS spinner animation
  - Add semi-transparent overlay
  - Center spinner vertically and horizontally
  - Add loading message text
- [ ] Add loading states:
  - Show spinner during initial station fetch
  - Show inline spinner in popup during observation fetch
  - Fade-in animation for markers appearing
- [ ] Add smooth transitions:
  - Popup open/close animation
  - Marker appearance animation
  - Error banner slide-in/out
- [ ] Add branding:
  - Create or add favicon.ico to `public/`
  - Set page title to "Buoy Station Map"
  - Add simple header or logo (optional)
- [ ] Add keyboard accessibility:
  - Tab navigation for controls
  - Enter key to activate buttons
  - Escape key to close popups
- [ ] Test all transitions:
  - Verify animations are smooth (60fps)
  - No janky scrolling or layout shifts
  - Loading states appear immediately

**Acceptance Criteria**:
- [ ] Loading indicators appear during all async operations
- [ ] UI transitions are smooth (no jank)
- [ ] Page has proper title: "Buoy Station Map"
- [ ] Favicon appears in browser tab
- [ ] Keyboard navigation works
- [ ] Helps users identify buoys within 5 seconds (SC-008)

**Related Requirements**: FR-010, SC-008

---

### Phase 7: Server Integration

#### Task 7.1: Add static file serving to Fastify server

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 1.1, Task 2.2

**Description**:
Configure the existing Fastify server to serve the web-demo static files.

**Steps**:
- [ ] Add `@fastify/static` to `apps/server/package.json`
- [ ] Run `pnpm install` from server directory
- [ ] Update `apps/server/src/app.ts`:
  - Import `@fastify/static`
  - Register static file plugin
  - Configure root to serve from `../web-demo/dist`
  - Set prefix to `/` for root path
  - Enable `index.html` fallback for SPA routing
- [ ] Test serving static files:
  - Build web-demo: `pnpm --filter web-demo build`
  - Start server: `pnpm --filter server dev`
  - Visit http://localhost:3000
  - Verify web app loads
- [ ] Configure MIME types for correct content-type headers
- [ ] Test API calls work from served web app (same origin, no CORS needed)

**Acceptance Criteria**:
- [ ] Running server serves web app at http://localhost:3000
- [ ] Static assets (JS, CSS, images) load correctly
- [ ] index.html is served for root path
- [ ] Web app can make API calls to same origin
- [ ] No CORS errors in browser console

**Related Requirements**: Infrastructure for all FRs

---

#### Task 7.2: Production build configuration

**Priority**: P1 (High)  
**Estimate**: 1 hour  
**Dependencies**: Task 7.1

**Description**:
Configure Vite for optimized production builds with proper asset handling.

**Steps**:
- [ ] Update `apps/web-demo/vite.config.ts`:
  - Set `build.outDir` to `dist`
  - Configure `build.rollupOptions` for code splitting
  - Enable minification
  - Configure asset file naming
  - Set `base: '/'` for correct asset paths
- [ ] Add build script to `apps/web-demo/package.json`:
  - `"build": "vite build"`
  - `"preview": "vite preview"`
- [ ] Add pre-server script to root `package.json`:
  - `"prebuild": "pnpm --filter web-demo build"`
- [ ] Test production build:
  - Run `pnpm --filter web-demo build`
  - Check `dist/` folder created
  - Verify files are minified
  - Check total bundle size
- [ ] Test production build with server:
  - Build web-demo
  - Start server
  - Verify everything works in production mode
- [ ] Add `.gitignore` entry for `apps/web-demo/dist/`

**Acceptance Criteria**:
- [ ] `pnpm --filter web-demo build` creates optimized bundle
- [ ] Built assets are minified and < 500KB total (gzipped)
- [ ] Production build works correctly when served by server
- [ ] Asset paths are correct (no 404s)
- [ ] Source maps are generated for debugging

**Related Requirements**: Infrastructure for deployment

---

### Phase 8: Testing and Documentation

#### Task 8.1: Manual testing against success criteria

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: All previous tasks

**Description**:
Systematically test all success criteria and document results.

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

**Related Requirements**: All success criteria

---

#### Task 8.2: Write user documentation

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 7.2

**Description**:
Create comprehensive README documentation for the web-demo application.

**Steps**:
- [ ] Create `apps/web-demo/README.md` with sections:
  - Project overview and purpose
  - Prerequisites (Node.js version, pnpm)
  - Development setup:
    - Install dependencies
    - Start dev server
    - Environment variables
  - Building for production:
    - Build command
    - Output directory
    - Serving with Fastify server
  - Using the application:
    - How to view buoy locations
    - How to see station details
    - Understanding marker colors
    - Legend explanation
  - Architecture overview:
    - Tech stack (Vite, TypeScript, Leaflet)
    - Project structure
    - API integration
  - Known limitations:
    - Browser compatibility
    - Performance considerations
    - Required server availability
  - Troubleshooting:
    - Common issues and solutions
    - How to check if server is running
    - Clearing browser cache
- [ ] Add code examples where helpful
- [ ] Include screenshots (optional but nice)
- [ ] Review README with fresh eyes

**Acceptance Criteria**:
- [ ] README is complete and accurate
- [ ] Another developer can run the app using only README
- [ ] All commands are tested and work
- [ ] Known limitations are documented
- [ ] Troubleshooting section covers common issues

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

**Total Tasks**: 17  
**Estimated Time**: ~28 hours

### By Priority:
- **P0 (Blocker)**: 7 tasks (~13.5 hours)
- **P1 (High)**: 8 tasks (~13 hours)
- **P2 (Medium)**: 2 tasks (~3 hours)

### By Phase:
- **Phase 1**: 2 tasks (2.5 hours)
- **Phase 2**: 2 tasks (4.5 hours)
- **Phase 3**: 2 tasks (4.5 hours)
- **Phase 4**: 1 task (2.5 hours)
- **Phase 5**: 2 tasks (3 hours)
- **Phase 6**: 3 tasks (5.5 hours)
- **Phase 7**: 2 tasks (2.5 hours)
- **Phase 8**: 3 tasks (5.5 hours)

### Critical Path:
1. Task 1.1 → Task 1.2 → Task 2.2 → Task 3.1 → Task 3.2 → Task 4.1 → Task 8.1

### Parallel Work Opportunities:
- Task 2.1 can be done in parallel with Task 1.2
- Task 5.1 and 5.2 can be done while waiting for Phase 3
- Task 6.1, 6.2, 6.3 can be done in any order after Phase 3
- Task 7.1 can start as soon as Task 1.1 is complete

## Notes

- All tasks include detailed acceptance criteria for verification
- Tasks map directly to functional requirements (FR-XXX) and success criteria (SC-XXX)
- Estimates assume familiarity with TypeScript and Leaflet
- Some tasks can be split into smaller subtasks if needed
- Testing should be performed continuously, not just in Phase 8
