# Audio Clients and Integrations

This document catalogs supported audio client options, transports, and mapping patterns for sonifying buoy observations.

## Goals

- Make it trivial to plug different audio environments into the real-time data stream.
- Provide transport choices (SSE, WebSocket, OSC, MIDI, MQTT) with minimal glue.
- Offer consistent message schemas and mapping suggestions.

## Transports

- SSE: default browser-friendly stream at `/stream`.
- WebSocket: optional bi-directional channel (future).
- OSC (UDP): de facto standard for patchers and live-coding tools.
- MIDI / Web MIDI: control hardware or DAW instruments.
- MQTT: resilient mobile/IoT bridge if needed.

## Canonical message schema

- Stream event (SSE):
  - event: `observation`
  - data (JSON): `{ "stationId": string, "timestamp": string, "waveHeightM": number, "windSpeedMps": number, "windDirDeg": number, "waterTempC": number, "pressureHpa": number }`

- OSC message (UDP):
  - address: `/observation`
  - args (suggested order/types):
    - stationId: string
    - timestamp: string
    - waveHeightM: float
    - windSpeedMps: float
    - windDirDeg: int
    - waterTempC: float
    - pressureHpa: float

Keep names/units aligned with the database and API.

## Client catalog

### Browsers

- WebAudio API / Tone.js (apps/web-demo)
  - Transport: SSE (default) or WebSocket
  - Use cases: quick demos, interactive sketches, Web MIDI routing

- Web MIDI (browser)
  - Transport: SSE → client maps to MIDI CC/notes
  - Use cases: control hardware synths or DAW instruments

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

- SSE → OSC: small Node sidecar subscribes to `/stream` and forwards `/observation` messages to `127.0.0.1:57120` (configurable).
- SSE → MIDI: browser client maps JSON fields to MIDI CC/notes.
- SSE → WS hub: optional aggregator to fan out to mixed clients.

## Acceptance criteria

- Web client (WebAudio/Tone.js) plays sound based on live `/stream` data.
- ChucK/Max/SuperCollider receive `/observation` via OSC with correct fields.
- Mappings are documented and configurable.

## Next steps

- Implement SSE → OSC bridge package or script.
- Add example patches (Max/SuperCollider) and a minimal ChucK receiver.
- Provide a reference web demo in `apps/web-demo` using Tone.js.
