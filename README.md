# DDJ-SP1 Controller Manager

Professional, simple system for managing the Pioneer DDJ-SP1 MIDI controller.

## Features

- Device detection and connection management
- Event-based button and knob handling
- Full TypeScript support with type safety
- Comprehensive test suite
- Clean, maintainable architecture

## Project Structure

```
src/
├── types.ts              # TypeScript type definitions
├── DeviceManager.ts      # Core device management class
├── DeviceManager.test.ts # Test suite
└── index.ts              # Example application
```

## Usage

### Running the Application

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

The test suite validates:
- Device detection
- Connection management
- Event emitter functionality
- Clean disconnection

All tests pass with the DDJ-SP1 connected or will gracefully skip when not connected.
