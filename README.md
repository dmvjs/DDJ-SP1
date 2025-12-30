# DDJ-SP1 Controller Manager

Professional, simple system for managing the Pioneer DDJ-SP1 MIDI controller with a real-time web interface.

## Features

- Device detection and connection management
- Event-based button and knob handling
- Real-time web visualization of controller
- Full TypeScript support with type safety
- Comprehensive test suite (28 tests)
- Clean, maintainable architecture with separation of concerns
- Modular CSS with design tokens
- WebSocket-based communication

## Project Structure

```
src/
├── types.ts                   # TypeScript type definitions
├── ControlStateManager.ts     # Button lock & shift state management
├── ControlStateManager.test.ts # ControlStateManager tests
├── DeviceManager.ts           # Core MIDI device management
├── DeviceManager.test.ts      # DeviceManager tests
├── ddj-sp1-layout.ts          # Hardware control mapping
├── server.ts                  # Web server + WebSocket bridge
└── index.ts                   # CLI demo application

public/
├── index.html                 # Web UI structure
├── app.js                     # Application entry point (ES modules)
├── css/
│   ├── _variables.css         # Design tokens & CSS custom properties
│   ├── _base.css              # Reset & base styles
│   ├── _layout.css            # Grid & layout structures
│   ├── _controls.css          # Shared control styles
│   ├── _buttons.css           # Button-specific styles
│   ├── _knobs.css             # Knob & slider styles
│   └── _effects.css           # Animations & effects
└── js/
    ├── WebSocketClient.js     # WebSocket connection management
    ├── ControllerState.js     # Application state management
    └── UIRenderer.js          # DOM manipulation & rendering
```

## Architecture

### Backend

The backend follows a layered architecture with clear separation of concerns:

**DeviceManager** - MIDI hardware abstraction
- Connects to DDJ-SP1 via easymidi
- Handles MIDI input/output
- Emits high-level events (button, knob, lock)

**ControlStateManager** - State management
- Manages shift button state
- Handles FX button lock/unlock logic
- Maps shifted notes to original notes
- Determines LED states

**Server** - WebSocket bridge
- Serves static frontend files
- Broadcasts controller events to web clients
- Broadcasts lock state changes

### Frontend

The frontend uses a clean MVC-inspired architecture:

**WebSocketClient** - Communication layer
- Manages WebSocket connection
- Event-based message handling
- Auto-reconnection logic

**ControllerState** - State layer (Model)
- Single source of truth for all control states
- Tracks button lock states
- Manages control registry

**UIRenderer** - View layer
- Pure DOM manipulation functions
- No business logic
- Handles visual updates for buttons, knobs, sliders

**app.js** - Controller (Glue code)
- Coordinates between WebSocket, State, and UI
- Routes events to appropriate handlers
- Minimal business logic

### CSS Architecture

The CSS is modularized into logical layers:

1. **Variables** - All design tokens (colors, spacing, typography)
2. **Base** - Reset and body styles
3. **Layout** - Grid systems and container layouts
4. **Controls** - Shared control styles
5. **Buttons** - All button variations and states
6. **Knobs** - Knob and slider styling
7. **Effects** - Animations and visual effects

This structure reduces duplication, improves maintainability, and makes theme changes trivial.

## Usage

### Running the Application

**Quick Start:**
```bash
npm start
```
This builds the project and starts the web server on http://localhost:3000. Plug in your DDJ-SP1 and the UI will update in real-time as you interact with the controller.

**CLI Mode:**
```bash
npm run build
node dist/index.js
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run test:watch
```

## API

### DeviceManager

```typescript
import { DeviceManager } from './DeviceManager.js';

const manager = new DeviceManager();

// Get available MIDI devices
const devices = manager.getAvailableDevices();

// Check if DDJ-SP1 is connected
const isConnected = manager.isDeviceConnected();

// Connect to the device
manager.connect();

// Listen for button events
manager.on('button', (event) => {
  console.log(`Button ${event.button} ${event.pressed ? 'pressed' : 'released'}`);
});

// Listen for knob events
manager.on('knob', (event) => {
  console.log(`Knob ${event.knob} value: ${event.value}`);
});

// Listen for all events
manager.on('event', (event) => {
  if (event.type === 'button') {
    // Handle button
  } else if (event.type === 'knob') {
    // Handle knob
  }
});

// Disconnect
manager.disconnect();
```

## Event Types

### ButtonEvent
```typescript
{
  type: 'button';
  button: number;    // Button identifier
  pressed: boolean;  // true when pressed, false when released
  channel: number;   // MIDI channel
}
```

### KnobEvent
```typescript
{
  type: 'knob';
  knob: number;    // Knob identifier
  value: number;   // Value (0-127)
  channel: number; // MIDI channel
}
```

## Testing

The test suite (28 tests) validates:

**DeviceManager Tests:**
- Device detection
- Connection management
- Event emitter functionality
- Clean disconnection

**ControlStateManager Tests:**
- Shift button state tracking
- Shifted FX note detection and mapping
- FX button identification
- Button lock/unlock toggling
- LED velocity calculation
- Lock state management

All tests pass with the DDJ-SP1 connected or will gracefully skip when not connected.

## Code Quality Improvements

This refactor delivers three major improvements:

### 1. Modular CSS Architecture
- **Before:** 1502-line monolithic `style.css` with hardcoded values
- **After:** 7 focused CSS modules (~800 lines total) using CSS custom properties
- **Benefits:**
  - 47% reduction in CSS size
  - Theme changes take minutes instead of hours
  - Clear organization by concern
  - Easier debugging and maintenance

### 2. Extracted State Management
- **Before:** Complex shift/lock logic mixed into DeviceManager (197 lines)
- **After:** Dedicated `ControlStateManager` class (153 lines) with full test coverage
- **Benefits:**
  - 44-line reduction in DeviceManager complexity
  - State logic is independently testable
  - Clear separation of MIDI I/O from business logic
  - Easier to add new control modes

### 3. Frontend Separation of Concerns
- **Before:** Procedural `app.js` (237 lines) mixing WebSocket, state, and DOM
- **After:** 3 focused classes + glue code (113 lines in app.js)
- **Benefits:**
  - 52% reduction in main application code
  - Each class has single responsibility
  - WebSocket reconnection can be added without touching UI
  - State changes are centralized and predictable
  - UI rendering is pure and testable
