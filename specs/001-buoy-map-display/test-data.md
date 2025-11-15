# Test Data Documentation

**Date**: 2025-11-15  
**Task**: 0.1 - Test Environment Setup

## Environment Status

### Database
- **Status**: ✓ Running and accessible
- **Host**: localhost:5432
- **Database**: buoys
- **Migrations**: Up to date (2 migrations applied)

### Data Summary
- **Total Stations**: 5 active stations
- **Total Observations**: 32,323 observations
- **Data Freshness**: All stations have observations from 2025-11-15 (today)

## Test Stations

### 1. Delaware Bay (44009)
- **Coordinates**: 38.457°N, -74.703°W
- **Location**: Atlantic Ocean, off Delaware coast
- **Latest Observation**: 2025-11-15 04:00:00 UTC
- **Sample Data**:
  - Wave Height: 2.50 m
  - Wind Speed: 3.7 m/s
  - Water Temperature: null

### 2. Boston (44013)
- **Coordinates**: 42.346°N, -70.651°W
- **Location**: Atlantic Ocean, off Boston coast
- **Latest Observation**: 2025-11-15 04:10:00 UTC
- **Sample Data**:
  - Wave Height: 3.20 m
  - Wind Speed: 0.1 m/s
  - Water Temperature: 3.24°C

### 3. Eel River (46022)
- **Coordinates**: 40.713°N, -124.52°W
- **Location**: Pacific Ocean, off California coast
- **Latest Observation**: 2025-11-15 04:10:00 UTC
- **Sample Data**:
  - Wave Height: 1.70 m
  - Wind Speed: 11.5 m/s
  - Water Temperature: 2.85°C

### 4. Stonewall Bank (46050)
- **Coordinates**: 44.656°N, -124.526°W
- **Location**: Pacific Ocean, off Oregon coast
- **Latest Observation**: 2025-11-15 04:10:00 UTC
- **Sample Data**:
  - Wave Height: 2.10 m
  - Wind Speed: null
  - Water Temperature: 2.83°C

### 5. Mid-Gulf (42001)
- **Coordinates**: 25.897°N, -89.668°W
- **Location**: Gulf of Mexico
- **Latest Observation**: 2025-11-15 04:10:00 UTC
- **Sample Data**:
  - Wave Height: 0.90 m
  - Wind Speed: 18.0 m/s
  - Water Temperature: 1.26°C

## Geographic Distribution

The test stations provide good coverage across US coastal waters:
- **Atlantic Ocean**: 2 stations (Delaware Bay, Boston)
- **Pacific Ocean**: 2 stations (Eel River, Stonewall Bank)
- **Gulf of Mexico**: 1 station (Mid-Gulf)

This distribution is suitable for testing:
- Map rendering across different regions
- Varied latitude/longitude coordinates
- Different data characteristics (some stations have null sensor readings)

## Data Characteristics

### Freshness
- All stations have observations within the last hour
- All observations are within the last 7 days (well within requirements)
- Data is being actively updated by the worker process

### Completeness
- All stations have required fields: id, name, lat, lon
- Observations include varied sensor readings
- Some sensor readings are null (good for testing "Not Available" display)

### Quality
- Coordinates are valid and within expected ranges
  - Latitude: -90 to 90
  - Longitude: -180 to 180
- All stations are marked as active
- Observations have proper timestamps

## Verification Query Results

```
✓ Database is running and accessible
✓ At least 5 active stations exist (found 5)
✓ Each station has observation data within last 7 days
✓ Can query stations and observations via Prisma
```

## Notes

- Worker process is actively fetching new observations
- Observations are being added approximately every 10 minutes per station
- Database performance is good with 32K+ observations
- Test environment is ready for feature implementation

## Acceptance Criteria Status

- [x] Database is running and accessible
- [x] At least 5 active stations exist in database
- [x] Each station has observation data within last 7 days
- [x] Can query stations and observations via Prisma
- [x] Test data is documented
