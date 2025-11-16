# Audio Clients and Integrations

This document catalogs supported audio client options, transports, and mapping patterns for sonifying buoy observations.

## Goals

- Make it trivial to plug different audio environments into the real-time data stream.
- Provide transport choices (SSE, WebSocket, OSC, MIDI, MQTT) with minimal glue.
- Offer consistent message schemas and mapping suggestions.

## Transports

### Server-Sent Events (SSE)

**Primary transport for real-time observation streaming.**

- **Endpoint:** `GET /v1/observations/stream`
- **Protocol:** Server-Sent Events (SSE) / EventSource API
- **Direction:** Unidirectional (server → client)
- **Use cases:** Browser clients, Node.js clients, any HTTP-capable environment
- **Auto-reconnection:** Built-in browser support with exponential backoff
- **Event types:**
  - `connection` - Sent on initial connection
  - `observation` - Sent for each new buoy observation

**Browser example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');

eventSource.addEventListener('observation', (event) => {
  const obs = JSON.parse(event.data);
  
  // Map observation to sound parameters
  const frequency = 200 + (obs.waveHeightM * 50);
  const amplitude = obs.windSpeedMps / 30;
  
  // Use WebAudio API or Tone.js to generate sound
  synth.triggerAttackRelease(frequency, "8n", undefined, amplitude);
});
```

**Node.js example:**
```javascript
import EventSource from 'eventsource';

const source = new EventSource('http://localhost:3000/v1/observations/stream');

source.addEventListener('observation', (event) => {
  const obs = JSON.parse(event.data);
  console.log(`Station ${obs.stationId}: wave=${obs.waveHeightM}m`);
});
```

See [API.md](./API.md) for complete SSE documentation.

### Other Transports

- **WebSocket:** Optional bi-directional channel (future).
- **OSC (UDP):** De facto standard for patchers and live-coding tools.
- **MIDI / Web MIDI:** Control hardware or DAW instruments.
- **MQTT:** Resilient mobile/IoT bridge if needed.

## Canonical message schema

### SSE Event Schema

The SSE endpoint `/v1/observations/stream` sends two event types:

**Connection Event:**
```json
{
  "status": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Observation Event:**
```json
{
  "stationId": "44009",
  "timestamp": "2024-01-15T10:25:00.000Z",
  "waveHeightM": 2.5,
  "windSpeedMps": 12.3,
  "windDirDeg": 180,
  "waterTempC": 18.5,
  "pressureHpa": 1013.2
}
```

**Field Descriptions:**
- `stationId` (string) - NDBC station identifier
- `timestamp` (string) - ISO 8601 datetime of observation
- `waveHeightM` (number | null) - Wave height in meters
- `windSpeedMps` (number | null) - Wind speed in meters per second
- `windDirDeg` (number | null) - Wind direction in degrees (0-360)
- `waterTempC` (number | null) - Water temperature in Celsius
- `pressureHpa` (number | null) - Atmospheric pressure in hectopascals

**Note:** All measurement fields may be `null` if sensor data is unavailable.

### OSC Message Schema

For clients using Open Sound Control (OSC):

**Address:** `/observation`

**Arguments (suggested order/types):**
1. `stationId` - string
2. `timestamp` - string
3. `waveHeightM` - float (or -1 if null)
4. `windSpeedMps` - float (or -1 if null)
5. `windDirDeg` - int (or -1 if null)
6. `waterTempC` - float (or -999 if null)
7. `pressureHpa` - float (or -1 if null)

**Note:** OSC doesn't support nullable types, so use sentinel values (-1, -999) to indicate missing data.

Keep names/units aligned with the database and API.

## Client catalog

### Browsers

**WebAudio API / Tone.js** (apps/web-demo)
- **Transport:** SSE via EventSource API
- **Use cases:** Quick demos, interactive sketches, Web MIDI routing
- **Example:** See [API.md](./API.md#browser-javascript) for complete code

**Web MIDI** (browser)
- **Transport:** SSE → client maps to MIDI CC/notes
- **Use cases:** Control hardware synths or DAW instruments
- **Pattern:** Listen to SSE `observation` events, map fields to MIDI CC values, send via Web MIDI API

### Patchers and DAWs

- Max/MSP or Pure Data (Pd)
  - Transport: OSC
  - Why: visual patching, easy routing to DAWs/hardware

- Ableton Live (Max for Live)
  - Transport: OSC → Max for Live → device parameters/MIDI
  - Why: performable, recordable, automation-friendly

- VCV Rack / Bitwig (The Grid)
  - Transport: OSC → MIDI/CV modules
  - Why: modular synthesis playground

### Live-coding

- SuperCollider
  - Transport: OSC
  - Why: powerful synthesis server, tight timing

- TidalCycles / FoxDot / Sonic Pi
  - Transport: OSC
  - Why: declarative pattern mapping, live performance

- ChucK
  - Transport: OSC bridge
  - Why: deterministic timing, straightforward synthesis

### Visual / AV

- TouchDesigner / Hydra
  - Transport: OSC/WebSocket
  - Why: audio-reactive visuals and sonification together

### Game engines

- Unity / Unreal
  - Transport: WebSocket or OSC via plugin
  - Why: spatial audio, 3D data art

### Mobile / Embedded

- iOS (AudioKit) / Android (Oboe)
  - Transport: WebSocket or MQTT

- Raspberry Pi headless synth
  - Transport: OSC → SuperCollider/FluidSynth on Pi

## Mapping suggestions

- waveHeightM → filter cutoff, LFO depth, or chorus mix
- windSpeedMps → amplitude/envelope intensity
- windDirDeg → stereo pan or azimuth (spatialization)
- waterTempC → oscillator morph index/timbre
- pressureHpa → base pitch, reverb size, or compressor threshold

Recommended processing:

- Clamp extreme outliers to sensible domain ranges.
- Smooth with EMA to reduce jitter: `y_t = α x_t + (1-α) y_{t-1}` (α≈0.1–0.3).
- Quantize to a tempo grid if performing with a clock.

## Bridge patterns

### SSE → OSC Bridge

Small Node.js script that subscribes to `/v1/observations/stream` and forwards messages as OSC packets:

```javascript
import EventSource from 'eventsource';
import osc from 'osc';

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121,
  remoteAddress: "127.0.0.1",
  remotePort: 57120  // Default SuperCollider port
});

udpPort.open();

const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');

eventSource.addEventListener('observation', (event) => {
  const obs = JSON.parse(event.data);
  
  udpPort.send({
    address: "/observation",
    args: [
      { type: "s", value: obs.stationId },
      { type: "s", value: obs.timestamp },
      { type: "f", value: obs.waveHeightM ?? -1 },
      { type: "f", value: obs.windSpeedMps ?? -1 },
      { type: "i", value: obs.windDirDeg ?? -1 },
      { type: "f", value: obs.waterTempC ?? -999 },
      { type: "f", value: obs.pressureHpa ?? -1 }
    ]
  });
});
```

### SSE → MIDI Bridge

Browser client that maps observation fields to MIDI CC values:

```javascript
const eventSource = new EventSource('/v1/observations/stream');
const midiOutput = await navigator.requestMIDIAccess().outputs.values().next().value;

eventSource.addEventListener('observation', (event) => {
  const obs = JSON.parse(event.data);
  
  // Map wave height (0-10m) to MIDI CC value (0-127)
  const waveCC = Math.min(127, Math.round((obs.waveHeightM ?? 0) * 12.7));
  midiOutput.send([0xB0, 1, waveCC]); // CC#1
  
  // Map wind speed (0-30 m/s) to CC value
  const windCC = Math.min(127, Math.round((obs.windSpeedMps ?? 0) * 4.2));
  midiOutput.send([0xB0, 2, windCC]); // CC#2
});
```

### SSE → WebSocket Hub (Future)

Optional aggregator to fan out SSE streams to WebSocket clients with additional features like filtering, buffering, and replay.

## Acceptance criteria

- Web client (WebAudio/Tone.js) plays sound based on live `/stream` data.
- ChucK/Max/SuperCollider receive `/observation` via OSC with correct fields.
- Mappings are documented and configurable.

## Next steps

- Implement SSE → OSC bridge package or script.
- Add example patches (Max/SuperCollider) and a minimal ChucK receiver.
- Provide a reference web demo in `apps/web-demo` using Tone.js.
