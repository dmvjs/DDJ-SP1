/**
 * Manual Interactive Note Tester
 * Press ENTER to test each note
 */
import { DeviceManager } from './DeviceManager.js';
import * as readline from 'readline';
const device = new DeviceManager();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
console.log('🔍 Manual Note Tester');
console.log('=====================\n');
console.log('Looking for: RED lights UNDER the FX ASSIGN buttons (1, 2 on left and right)\n');
try {
    device.connect();
    console.log('✅ Connected\n');
    const channel = 6;
    let note = 70;
    function testNote() {
        if (note > 90) {
            console.log('\n✅ Finished testing notes 70-90');
            rl.close();
            device.disconnect();
            process.exit(0);
        }
        console.log(`\n>>> Testing NOTE ${note} on channel ${channel} <<<`);
        console.log('(Light will stay on for 3 seconds)');
        device.setLED(channel, note, 127);
        setTimeout(() => {
            device.setLED(channel, note, 0);
            note++;
            console.log('\nDid a RED light turn on? If yes, write down: note ' + (note - 1));
            rl.question('\nPress ENTER for next note... ', () => {
                testNote();
            });
        }, 3000);
    }
    console.log('Press ENTER to start...');
    rl.question('', () => {
        testNote();
    });
}
catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    process.exit(1);
}
