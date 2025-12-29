import easymidi from 'easymidi';
import { EventEmitter } from 'events';
export class DeviceManager extends EventEmitter {
    constructor() {
        super();
        this.input = null;
        this.output = null;
        this.deviceName = null;
        this.shiftPressed = false;
        this.lockedPads = new Map(); // Track locked pads by "channel:note"
        // Map shifted note numbers to their unshifted equivalents
        this.shiftedNoteMap = new Map([
            [99, 71], // FX1
            [100, 72], // FX2
            [101, 73], // FX3
            [102, 67], // TAP (or 74 for FX ASSIGN)
        ]);
    }
    /**
     * Get list of available MIDI input devices
     */
    getAvailableDevices() {
        return easymidi.getInputs();
    }
    /**
     * Check if DDJ-SP1 is connected
     */
    isDeviceConnected() {
        const devices = this.getAvailableDevices();
        return devices.some(name => name.includes('DDJ-SP1'));
    }
    /**
     * Connect to the DDJ-SP1
     */
    connect() {
        const devices = this.getAvailableDevices();
        const sp1Device = devices.find(name => name.includes('DDJ-SP1'));
        if (!sp1Device) {
            throw new Error('Pioneer DDJ-SP1 not found. Make sure it is connected via USB.');
        }
        this.deviceName = sp1Device;
        this.input = new easymidi.Input(sp1Device);
        this.output = new easymidi.Output(sp1Device);
        this.setupListeners();
    }
    /**
     * Disconnect from the device
     */
    disconnect() {
        if (this.input) {
            this.input.close();
            this.input = null;
        }
        if (this.output) {
            this.output.close();
            this.output = null;
        }
        this.deviceName = null;
    }
    /**
     * Get the connected device name
     */
    getDeviceName() {
        return this.deviceName;
    }
    /**
     * Check if currently connected
     */
    isConnected() {
        return this.input !== null;
    }
    /**
     * Send LED control message to the device
     * @param channel - MIDI channel
     * @param note - Note number
     * @param velocity - Velocity (0 = off, 127 = on, other values for different colors/brightness)
     */
    setLED(channel, note, velocity) {
        if (!this.output) {
            console.warn('Cannot set LED: output not connected');
            return;
        }
        this.output.send('noteon', {
            note: note,
            velocity: velocity,
            channel: channel
        });
    }
    /**
     * Turn on a button LED
     */
    turnOnLED(channel, note) {
        this.setLED(channel, note, 127);
    }
    /**
     * Turn off a button LED
     */
    turnOffLED(channel, note) {
        this.setLED(channel, note, 0);
    }
    setupListeners() {
        if (!this.input)
            return;
        // Handle button presses (Note On/Off)
        this.input.on('noteon', (msg) => {
            console.log('🔵 BUTTON:', `note=${msg.note}`, `channel=${msg.channel}`, `velocity=${msg.velocity}`);
            // Check if this is the SHIFT button (button-64-ch6)
            if (msg.channel === 6 && msg.note === 64) {
                this.shiftPressed = msg.velocity > 0;
                console.log('⬆️  SHIFT:', this.shiftPressed ? 'PRESSED' : 'RELEASED');
            }
            // Check if this is a shifted FX button (notes 99-102)
            const isShiftedFX = this.shiftedNoteMap.has(msg.note) &&
                (msg.channel === 4 || msg.channel === 5);
            // Map shifted note to original note
            const originalNote = isShiftedFX ? this.shiftedNoteMap.get(msg.note) : msg.note;
            const buttonKey = `${msg.channel}:${originalNote}`;
            // FX buttons with "ON" text (channels 4 & 5, notes 71/72/73/74/67)
            const isFXButton = (msg.channel === 4 || msg.channel === 5) &&
                (originalNote === 71 || originalNote === 72 || originalNote === 73 || originalNote === 74 || originalNote === 67);
            // If this is a shifted FX button being pressed, toggle lock
            if (isShiftedFX && msg.velocity > 0) {
                const wasLocked = this.lockedPads.get(buttonKey) || false;
                const nowLocked = !wasLocked;
                this.lockedPads.set(buttonKey, nowLocked);
                console.log('🔒 BUTTON LOCK:', `note=${originalNote}`, `channel=${msg.channel}`, `locked=${nowLocked}`);
                // Keep the LED on if now locked, turn off if unlocked
                this.setLED(msg.channel, originalNote, nowLocked ? 127 : 0);
                // Emit lock state change event
                this.emit('lock', {
                    button: originalNote,
                    channel: msg.channel,
                    locked: nowLocked
                });
            }
            else if (isFXButton) {
                // For FX buttons, check if it's locked
                const isLocked = this.lockedPads.get(buttonKey) || false;
                if (isLocked) {
                    // Keep locked buttons lit
                    this.setLED(msg.channel, msg.note, 127);
                }
                else {
                    // Normal echo for unlocked buttons
                    this.setLED(msg.channel, msg.note, msg.velocity);
                }
            }
            else {
                // For other buttons, just echo normally
                this.setLED(msg.channel, msg.note, msg.velocity);
            }
            const event = {
                type: 'button',
                button: msg.note,
                pressed: msg.velocity > 0,
                channel: msg.channel
            };
            this.emit('event', event);
            this.emit('button', event);
        });
        // Handle knobs and dials (Control Change)
        this.input.on('cc', (msg) => {
            console.log('🔄 KNOB:', `controller=${msg.controller}`, `channel=${msg.channel}`, `value=${msg.value}`);
            const event = {
                type: 'knob',
                knob: msg.controller,
                value: msg.value,
                channel: msg.channel
            };
            this.emit('event', event);
            this.emit('knob', event);
        });
    }
}
