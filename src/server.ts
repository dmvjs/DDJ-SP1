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
  // Log events to console for debugging
  if (event.type === 'knob') {
    console.log(`Knob ${event.knob} = ${event.value} (Channel ${event.channel})`);
  } else {
    console.log(`Button ${event.button} ${event.pressed ? 'pressed' : 'released'} (Channel ${event.channel})`);
  }

  const message = JSON.stringify({ type: 'event', data: event });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial layout to new client
  ws.send(JSON.stringify({ type: 'layout', data: DDJ_SP1_LAYOUT }));

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
