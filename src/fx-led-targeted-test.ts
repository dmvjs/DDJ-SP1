import { DeviceManager } from './DeviceManager.js';

const manager = new DeviceManager();
manager.connect();

console.log('Testing FX ASSIGN LED lights with targeted channels\n');

const tests = [
  // Try channels 2/3 (deck channels) with notes 76,77,80,81
  { ch: 2, notes: [76, 77, 80, 81], label: 'Channel 2 (Deck ch)' },
  { ch: 3, notes: [76, 77, 80, 81], label: 'Channel 3 (Deck ch)' },
  // Try channel 6 with different nearby notes
  { ch: 6, notes: [70, 71, 72, 73, 74, 75, 78, 79, 82, 83, 84, 85], label: 'Channel 6 (other notes)' },
];

async function test() {
  for (const t of tests) {
    console.log(`\n${t.label}:`);
    for (const note of t.notes) {
      console.log(`  Testing ch${t.ch} note${note}...`);
      manager.setLED(t.ch, note, 127);
      await new Promise(resolve => setTimeout(resolve, 600));
      manager.setLED(t.ch, note, 0);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\nTest complete!');
  manager.disconnect();
  process.exit(0);
}

test();
