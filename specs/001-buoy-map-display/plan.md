# Work Plan: Buoy Map Display Web Application

**Feature Branch**: `001-buoy-map-display`  
**Created**: 2025-11-15  
**Spec**: [spec.md](spec.md)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Client                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Map Display │  │   Station    │  │   Observation    │  │
│  │  (Leaflet)   │  │   Markers    │  │     Popup        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│           │                │                    │            │
│           └────────────────┴────────────────────┘            │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┼─────────────────────────────────┐
│                   Existing Server (Fastify)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Static File Serving (new)                          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  GET /stations (existing)                           │    │
│  │  GET /observations/by-station/:id (existing)        │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Rate Limiting (existing)                           │    │
│  │  Input Validation (existing)                        │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework**: Vanilla TypeScript (no framework overhead)
- **Build Tool**: Vite (fast dev server, optimized production builds)
- **Mapping Library**: Leaflet.js with OpenStreetMap tiles
- **HTTP Client**: Fetch API (native browser support)
- **Type Safety**: TypeScript with shared types from packages/shared
- **Styling**: CSS Modules or plain CSS
- **Testing**: Vitest (already in workspace)

### Application Structure

```
apps/web-demo/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── favicon.ico
└── src/
    ├── main.ts              # Entry point, app initialization
    ├── config.ts            # Configuration (API base URL, map settings)
    ├── types.ts             # TypeScript interfaces for API responses
    ├── api/
    │   ├── client.ts        # HTTP client wrapper
    │   ├── stations.ts      # Station API calls
    │   └── observations.ts  # Observation API calls
    ├── map/
    │   ├── map-manager.ts   # Leaflet map initialization and management
    │   ├── marker-manager.ts # Marker creation and color coding
    │   └── popup-builder.ts # Build popup HTML for station details
    ├── ui/
    │   ├── loading.ts       # Loading indicators
    │   └── error-display.ts # Error message handling
    └── utils/
        ├── date-formatter.ts # Format timestamps
        └── data-helpers.ts   # Handle null/missing data
```

## Implementation Tasks

### Phase 1: Project Setup and Infrastructure

**Task 1.1: Initialize web-demo package**
- Create `apps/web-demo/package.json` with Vite, TypeScript, and dependencies
- Create `apps/web-demo/tsconfig.json` extending workspace config
- Create `apps/web-demo/vite.config.ts` with dev server and build settings
- Create `apps/web-demo/index.html` as entry point
- Add scripts to root `package.json` for building/running web-demo
- Install dependencies: `leaflet`, `@types/leaflet`

**Acceptance**: 
- `pnpm install` completes successfully
- `pnpm --filter web-demo dev` starts Vite dev server
- Browser shows basic HTML page at http://localhost:5173

**Task 1.2: Configure API client and types**
- Create `src/config.ts` with API base URL (from env or default to localhost:3000)
- Create `src/types.ts` with Station and Observation interfaces matching API responses
- Create `src/api/client.ts` with fetch wrapper and error handling
- Create `src/api/stations.ts` with `getStations()` and `getStation(id)` functions
- Create `src/api/observations.ts` with `getLatestObservation(stationId)` function

**Acceptance**:
- TypeScript compiles without errors
- API client can fetch stations list (manual test in browser console)
- Error responses from API are properly caught and typed

### Phase 2: Map Display Core (FR-001, FR-002, FR-008)

**Task 2.1: Initialize Leaflet map**
- Create `src/map/map-manager.ts` with `initMap()` function
- Configure OpenStreetMap tile layer
- Set initial view to show typical buoy coverage area (e.g., center on US coasts)
- Add zoom controls, pan functionality
- Add layer control for map type selection (street/satellite)
- Update `src/main.ts` to initialize map on page load

**Acceptance**:
- Map displays with OpenStreetMap tiles
- User can zoom in/out with mouse wheel or controls
- User can pan by dragging
- Map is responsive to container size

**Task 2.2: Fetch and display station markers**
- Create `src/map/marker-manager.ts` with `addStationMarkers(stations)` function
- Fetch all active stations using `getStations()` API
- Create Leaflet marker for each station at its lat/lng coordinates
- Add markers to map
- Implement loading indicator while fetching stations
- Handle API errors with user-friendly messages

**Acceptance**:
- All active stations appear as markers on map
- Markers are positioned at correct coordinates
- Loading indicator shows while fetching data
- Error message displays if API request fails

### Phase 3: Station Details and Observations (FR-003, FR-004, FR-005, FR-006, FR-007)

**Task 3.1: Display station information on marker click**
- Create `src/map/popup-builder.ts` with function to build popup HTML
- Add click event listener to each marker
- Display station ID and name in popup
- Style popup for readability

**Acceptance**:
- Clicking a marker opens a popup
- Popup shows station ID and name
- Popup is styled and readable
- Only one popup is open at a time

**Task 3.2: Fetch and display latest observation data**
- Extend popup to fetch latest observation when marker is clicked
- Display observation timestamp (formatted human-readable)
- Display wave height, wind speed, wind direction, water temperature, air pressure
- Create `src/utils/data-helpers.ts` with functions to handle null/missing sensor data
- Show "Not Available" for missing/null sensor readings
- Create `src/utils/date-formatter.ts` to format timestamps

**Acceptance**:
- Latest observation data appears in popup after clicking marker
- All available sensor readings are displayed with units
- Missing sensor readings show "Not Available" instead of null/undefined
- Timestamp is formatted in human-readable format (e.g., "Nov 15, 2025 10:30 AM")
- Loading indicator shows while fetching observation data

### Phase 4: Data Freshness Indicators (FR-013)

**Task 4.1: Implement color-coded markers**
- Extend `marker-manager.ts` to calculate data freshness
- Fetch latest observation timestamp for each station during initial load
- Apply marker colors:
  - Green: observation < 6 hours old
  - Yellow: observation 6-24 hours old
  - Gray: API error or no recent observation
- Create custom marker icons for each color state
- Add legend to map explaining color coding

**Acceptance**:
- Markers are color-coded based on data freshness
- Legend shows what each color means
- Color updates when latest observation is fetched
- Stations with no observations in 24 hours do not appear on map (per spec: "active" = has active flag AND recent observation)

### Phase 5: Error Handling and Edge Cases (FR-010, FR-011, NFR-001, NFR-002)

**Task 5.1: Implement comprehensive error handling**
- Create `src/ui/error-display.ts` for displaying error messages
- Handle network errors (offline, timeout)
- Handle API errors (4xx, 5xx responses)
- Handle invalid coordinate data (out of bounds, null)
- Show user-friendly error messages (no technical details)
- Add retry mechanism for failed requests

**Acceptance**:
- Offline state shows "Unable to connect" message
- API errors show "Failed to load data" message
- Stations with invalid coordinates are logged but don't break the app
- User can retry failed requests

**Task 5.2: Implement client-side input validation**
- Validate coordinate bounds before making API requests (if user input is added later)
- Validate pagination parameters
- Validate station IDs before fetching observations

**Acceptance**:
- Invalid inputs are caught before making API requests
- Validation errors show helpful messages
- No malformed requests are sent to API

### Phase 6: Performance and Polish (FR-009, FR-012, NFR-001)

**Task 6.1: Optimize for 50+ stations**
- Implement marker clustering if more than 50 stations in view
- Use marker cluster plugin for Leaflet
- Test with mock data of 100+ stations
- Ensure smooth zoom/pan with many markers

**Acceptance**:
- Map remains responsive with 50+ markers
- Zoom/pan operations are smooth
- Marker clusters work correctly at different zoom levels

**Task 6.2: Mobile responsiveness**
- Add viewport meta tag for mobile
- Test on mobile viewport sizes (320px, 375px, 768px)
- Ensure map controls are touch-friendly
- Ensure popups are readable on small screens
- Add CSS media queries for mobile layout

**Acceptance**:
- Map works on mobile browsers (Safari iOS, Chrome Android)
- Touch gestures work (pan, zoom)
- UI is readable on small screens
- No horizontal scrolling required

**Task 6.3: Loading states and UI polish**
- Create `src/ui/loading.ts` with loading spinner component
- Show loading indicator during initial station fetch
- Show loading indicator in popup during observation fetch
- Add smooth transitions for popups and markers
- Add favicon
- Add page title

**Acceptance**:
- Loading indicators appear during async operations
- UI transitions are smooth
- Page has proper title and favicon

### Phase 7: Server Integration

**Task 7.1: Add static file serving to Fastify server**
- Update `apps/server/src/app.ts` to serve static files from `apps/web-demo/dist`
- Add `@fastify/static` plugin to server dependencies
- Configure static file serving with correct MIME types
- Update server to serve `index.html` for root path `/`
- Add build step to build web-demo before starting server

**Acceptance**:
- Running server serves web app at http://localhost:3000
- Static assets (JS, CSS) load correctly
- Web app can make API calls to same origin (no CORS issues)

**Task 7.2: Production build configuration**
- Update `vite.config.ts` with production build settings
- Configure output directory and asset handling
- Add build script to web-demo package.json
- Test production build locally

**Acceptance**:
- `pnpm --filter web-demo build` creates optimized production bundle
- Built assets are < 500KB total (gzipped)
- Production build works in server

### Phase 8: Testing and Documentation

**Task 8.1: Manual testing against success criteria**
- Test SC-001: Stations load within 3 seconds
- Test SC-002: Observation data loads within 2 seconds
- Test SC-003: Map responsive with 50+ markers
- Test SC-004: 100% of stations positioned correctly
- Test SC-005: Works on desktop and mobile
- Test SC-006: Error messages are meaningful
- Test SC-007: Missing data handled gracefully
- Test SC-008: User can identify buoys within 5 seconds

**Acceptance**:
- All success criteria pass
- Document any issues or edge cases found

**Task 8.2: Write user documentation**
- Create `apps/web-demo/README.md` with:
  - How to run in development
  - How to build for production
  - How to use the map interface
  - Known limitations
  - Browser compatibility

**Acceptance**:
- README is complete and accurate
- Another developer can run the app using README

**Task 8.3: Integration testing**
- Verify server + web-demo work together
- Test with real database data
- Test rate limiting behavior
- Test with slow network (throttled)
- Test error scenarios (server down, database unreachable)

**Acceptance**:
- All integration scenarios pass
- App behaves correctly under various conditions

## Data Flow

### Station List Loading
```
User loads page
    → main.ts: initMap()
    → api/stations.ts: getStations()
    → Server: GET /stations?limit=1000
    → Server: Query Prisma for active stations with recent observations
    → Server: Return paginated stations
    → map/marker-manager.ts: addStationMarkers()
    → Calculate freshness from latest observation
    → Create colored markers
    → Add to map
```

### Observation Detail Loading
```
User clicks marker
    → marker click handler
    → popup-builder.ts: buildPopupHTML(station)
    → Show station info + loading indicator
    → api/observations.ts: getLatestObservation(stationId)
    → Server: GET /observations/by-station/:stationId?limit=1
    → Server: Query Prisma for latest observation
    → Server: Return observation with timestamp
    → popup-builder.ts: updatePopupWithObservation()
    → Format timestamp
    → Display sensor readings or "Not Available"
    → Show in popup
```

## API Contracts

### GET /stations
**Used for**: Initial marker placement, determining active stations

**Query Parameters**:
- `page`: number (default: 1)
- `limit`: number (default: 1000)

**Response**:
```typescript
{
  data: Station[];
  meta: {
    page: number;
    limit: number;
    total: number;
  }
}

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### GET /observations/by-station/:stationId
**Used for**: Fetching latest observation for popup display

**Path Parameters**:
- `stationId`: string

**Query Parameters**:
- `limit`: number (default: 1)
- `page`: number (default: 1)
- `since`: ISO date string (optional)

**Response**:
```typescript
{
  data: Observation[];
  meta: {
    page: number;
    limit: number;
    total: number;
  }
}

interface Observation {
  id: string;
  stationId: string;
  observedAt: string;
  waveHeight: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  waterTemperature: number | null;
  airPressure: number | null;
  createdAt: string;
}
```

## Testing Strategy

### Unit Testing
- **Utils**: Date formatting, data helpers (null handling)
- **API Client**: Mock fetch responses, error handling
- **Marker Manager**: Color calculation based on timestamp

### Integration Testing
- **API Integration**: Real requests to local server
- **Map Rendering**: Verify markers appear at correct coordinates
- **Popup Flow**: Click marker → fetch data → display

### Manual Testing
- **Cross-browser**: Chrome, Firefox, Safari, Edge
- **Mobile devices**: iOS Safari, Android Chrome
- **Performance**: 50+ markers, slow network
- **Error scenarios**: Server down, network offline, invalid data

### Acceptance Testing
- Verify each user story acceptance scenario
- Verify all functional requirements (FR-001 through FR-013)
- Verify non-functional requirements (NFR-001, NFR-002)
- Verify all success criteria (SC-001 through SC-008)

## Dependencies

### External Dependencies
- Existing Fastify server running at localhost:3000
- Existing Prisma database with stations and observations
- OpenStreetMap tile service (public CDN)
- Browser support: Modern browsers with ES6+ support

### Internal Dependencies
- `packages/shared`: May need to export types for cross-package sharing
- Server must remain backwards compatible (web-demo is additive, not breaking)

### New NPM Packages
- `leaflet`: ^1.9.4 (map rendering)
- `@types/leaflet`: ^1.9.8 (TypeScript definitions)
- `vite`: ^5.0.0 (build tool, dev server)
- `@fastify/static`: ^7.0.0 (static file serving in server)

## Risk Mitigation

### Risk: OpenStreetMap tiles unavailable
**Mitigation**: 
- Use multiple tile providers with fallback
- Display error message if tiles fail to load
- Map still functional, just no background imagery

### Risk: Large number of stations (100+) causes performance issues
**Mitigation**:
- Implement marker clustering from the start
- Test with mock data of 200+ stations
- Use Leaflet's built-in optimization (canvas renderer for many markers)

### Risk: API rate limiting affects user experience
**Mitigation**:
- Cache station list in memory for 5 minutes
- Only fetch latest observation when user clicks marker (not all upfront)
- Show rate limit error to user if hit

### Risk: Mobile browsers have different touch behavior
**Mitigation**:
- Test on real devices early
- Use Leaflet's mobile-friendly defaults
- Add touch event polyfills if needed

### Risk: Timestamp formatting issues with time zones
**Mitigation**:
- Store all times in UTC in database (already done)
- Format timestamps using browser's local time zone
- Show timezone in formatted timestamp (e.g., "PST")

## Definition of Done

A task is considered complete when:
1. Code is written and passes TypeScript compilation
2. Acceptance criteria for the task are met
3. Code follows project linting rules (`pnpm lint` passes)
4. Manual testing confirms functionality works
5. No console errors in browser
6. Changes are committed to feature branch

The feature is complete when:
1. All tasks are done
2. All functional requirements (FR-001 through FR-013) are implemented
3. All non-functional requirements (NFR-001, NFR-002) are met
4. All success criteria (SC-001 through SC-008) pass
5. All user story acceptance scenarios pass
6. Integration testing passes
7. README documentation is complete
8. Feature branch is ready for PR review

## Timeline Estimate

- **Phase 1**: Project Setup - 2 hours
- **Phase 2**: Map Display Core - 3 hours
- **Phase 3**: Station Details - 3 hours
- **Phase 4**: Data Freshness - 2 hours
- **Phase 5**: Error Handling - 2 hours
- **Phase 6**: Performance & Polish - 3 hours
- **Phase 7**: Server Integration - 2 hours
- **Phase 8**: Testing & Documentation - 3 hours

**Total Estimated Time**: 20 hours

**Note**: Estimates assume familiarity with Leaflet and TypeScript. First-time implementation may take 25-30 hours.
