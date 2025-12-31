import express from 'express';
import { WebSocketServer } from 'ws';
import { DeviceManager } from './DeviceManager.js';
import { DDJ_SP1_LAYOUT } from './ddj-sp1-layout.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static(join(__dirname, '../public')));

// Serve music files from juh project
app.use('/music', express.static(join(__dirname, '../../juh/music')));

const server = app.listen(PORT, () => {
  console.log(`Web UI running at http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Initialize device manager
const manager = new DeviceManager();

try {
  manager.connect();
  console.log(`Connected to: ${manager.getDeviceName()}`);
} catch (error) {
  console.error('Error connecting to DDJ-SP1:', (error as Error).message);
  console.error('Make sure the device is connected via USB.');
}

// Broadcast events to all connected clients
manager.on('event', (event) => {
  const message = JSON.stringify({ type: 'event', data: event });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast lock state changes to all connected clients
manager.on('lock', (lockEvent) => {
  const message = JSON.stringify({ type: 'lock', data: lockEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast tempo changes to all connected clients
manager.on('tempoChange', (tempoEvent) => {
  const message = JSON.stringify({ type: 'tempoChange', data: tempoEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast pad mode changes to all connected clients
manager.on('modeChange', (modeEvent) => {
  const message = JSON.stringify({ type: 'modeChange', data: modeEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast pad press events to all connected clients
manager.on('padPress', (padEvent) => {
  console.log(`📤 Broadcasting padPress:`, padEvent);
  const message = JSON.stringify({ type: 'padPress', data: padEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast pad release events to all connected clients
manager.on('padRelease', (padEvent) => {
  console.log(`📤 Broadcasting padRelease:`, padEvent);
  const message = JSON.stringify({ type: 'padRelease', data: padEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast sync state changes to all connected clients
manager.on('syncChange', (syncEvent) => {
  const message = JSON.stringify({ type: 'syncChange', data: syncEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// Broadcast spindown events to all connected clients
manager.on('spindown', (spindownEvent) => {
  const message = JSON.stringify({ type: 'spindown', data: spindownEvent });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial layout to new client
  ws.send(JSON.stringify({ type: 'layout', data: DDJ_SP1_LAYOUT }));

  // Send current tempo to new client
  const currentTempo = manager.getStateManager().getCurrentTempo();
  ws.send(JSON.stringify({ type: 'tempoChange', data: { tempo: currentTempo } }));

  // Send current DECK button states to new client
  const deckStates = manager.getStateManager().getDeckButtonStates();
  ws.send(JSON.stringify({ type: 'deckButtonStates', data: deckStates }));

  // Send current pad mode states to new client
  const padModes = manager.getStateManager().getPadModeStates();
  ws.send(JSON.stringify({ type: 'padModeStates', data: padModes }));

  // Sync device LEDs to match current state
  manager.syncModeLEDs();

  // Handle messages from frontend
  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'deckLoad') {
        // Frontend notifying backend that a deck loaded/unloaded a song
        const { deck, loaded } = message.data;
        manager.handleDeckLoadChange(deck, loaded);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  manager.disconnect();
  server.close();
  process.exit(0);
});
