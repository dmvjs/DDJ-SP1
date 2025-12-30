import easymidi from 'easymidi';
const devices = easymidi.getInputs();
const sp1Device = devices.find(name => name.includes('DDJ-SP1'));
if (!sp1Device) {
    console.error('DDJ-SP1 not found');
    process.exit(1);
}
const input = new easymidi.Input(sp1Device);
console.log('MIDI Spy running - press the 4 FX ASSIGN buttons\n');
input.on('noteon', (msg) => {
    console.log('NOTE ON:', `ch${msg.channel} note${msg.note} vel${msg.velocity}`);
});
input.on('noteoff', (msg) => {
    console.log('NOTE OFF:', `ch${msg.channel} note${msg.note} vel${msg.velocity}`);
});
input.on('cc', (msg) => {
    console.log('CC:', `ch${msg.channel} controller${msg.controller} value${msg.value}`);
});
// Keep running
console.log('Listening for all MIDI messages...\n');
