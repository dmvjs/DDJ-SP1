import easymidi from 'easymidi';
import { EventEmitter } from 'events';
import { ControlStateManager } from './ControlStateManager.js';
export class DeviceManager extends EventEmitter {
    constructor() {
        super();
        this.input = null;
        this.output = null;
        this.deviceName = null;
        this.stateManager = new ControlStateManager();
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
            // TEMP: Log all channel 6 button presses to find FX ASSIGN buttons
            if (msg.channel === 6 && msg.velocity > 0) {
                console.log('🔵 CH6 BUTTON:', `note=${msg.note}`, `velocity=${msg.velocity}`);
            }
            // Check if this is the SHIFT button (button-64-ch6)
            if (msg.channel === 6 && msg.note === 64) {
                this.stateManager.setShiftPressed(msg.velocity > 0);
                console.log('⬆️  SHIFT:', this.stateManager.isShiftPressed() ? 'PRESSED' : 'RELEASED');
            }
            // Check if this is an FX ASSIGN button
            const isFXAssignButton = this.stateManager.isFXAssignButton(msg.channel, msg.note);
            // Check if this is a DECK button (DECK 1/3 or DECK 2/4)
            const isDeckButton = this.stateManager.isDeckButton(msg.channel, msg.note);
            // Check if this is a shifted FX button
            const isShiftedFX = this.stateManager.isShiftedFXNote(msg.note, msg.channel);
            // Check if this is a shifted performance pad
            const isShiftedPad = this.stateManager.isShiftedPad(msg.note, msg.channel);
            // Map shifted note to original note
            let originalNote = msg.note;
            let originalChannel = msg.channel;
            if (isShiftedFX) {
                originalNote = this.stateManager.getOriginalNote(msg.note);
            }
            else if (isShiftedPad) {
                const padMapping = this.stateManager.getOriginalPad(msg.note, msg.channel);
                if (padMapping) {
                    originalNote = padMapping.note;
                    originalChannel = padMapping.channel;
                }
            }
            // Check if this is an FX button
            const isFXButton = this.stateManager.isFXButton(originalChannel, originalNote);
            // Handle FX ASSIGN button press/release (toggle assignment)
            if (isFXAssignButton) {
                const mapping = this.stateManager.getFXAssignMapping(msg.note);
                if (mapping) {
                    // Only toggle on button press, not release
                    if (msg.velocity > 0) {
                        const nowAssigned = this.stateManager.toggleFXAssignment(mapping.fx, mapping.deck);
                        console.log('🎛️  FX ASSIGN:', `FX${mapping.fx}→Deck${mapping.deck}`, nowAssigned ? 'ON' : 'OFF', `LED: ch${msg.channel} note${msg.note}`);
                    }
                    // Check BOTH main deck and alt deck assignments
                    // Get the base deck (1 or 2) from the button
                    const baseMapping = {
                        76: { fx: 1, baseDeck: 1 },
                        80: { fx: 2, baseDeck: 1 },
                        77: { fx: 1, baseDeck: 2 },
                        81: { fx: 2, baseDeck: 2 },
                    };
                    const base = baseMapping[msg.note];
                    if (base) {
                        const mainDeckAssigned = this.stateManager.isFXAssigned(base.fx, base.baseDeck);
                        const altDeck = base.baseDeck === 1 ? 3 : 4;
                        const altDeckAssigned = this.stateManager.isFXAssigned(base.fx, altDeck);
                        // Set button LED (main deck 1/2) and light indicator LED (alt deck 3/4)
                        // Button notes: 76, 77, 80, 81
                        // Light notes:  90, 92, 91, 93 (from spec: 11L, 11R, 12L, 12R)
                        const lightNoteMapping = {
                            76: 90, // Left 1:  FX1→Deck1 button, FX1→Deck3 light (11L) ✓
                            77: 91, // Right 1: FX1→Deck2 button, FX1→Deck4 light (was transposed)
                            80: 92, // Left 2:  FX2→Deck1 button, FX2→Deck3 light (was transposed)
                            81: 93, // Right 2: FX2→Deck2 button, FX2→Deck4 light (12R)
                        };
                        // Set button LED based on main deck (1/2) assignment
                        this.setLED(msg.channel, msg.note, mainDeckAssigned ? 127 : 0);
                        console.log(`💡 Button LED: ch${msg.channel} note${msg.note} = ${mainDeckAssigned ? 'ON' : 'OFF'}`);
                        // Set light indicator LED based on alt deck (3/4) assignment
                        const lightNote = lightNoteMapping[msg.note];
                        if (lightNote) {
                            this.setLED(msg.channel, lightNote, altDeckAssigned ? 127 : 0);
                            console.log(`🔴 Light LED: ch${msg.channel} note${lightNote} = ${altDeckAssigned ? 'ON' : 'OFF'}`);
                        }
                        // Emit event with both deck states
                        const event = {
                            type: 'button',
                            button: msg.note,
                            pressed: mainDeckAssigned || altDeckAssigned,
                            channel: msg.channel,
                            mainDeckAssigned,
                            altDeckAssigned
                        };
                        this.emit('event', event);
                        this.emit('button', event);
                        return; // Skip normal event emission
                    }
                }
            }
            // Handle DECK button press/release (toggle state)
            else if (isDeckButton) {
                // Only toggle on button press, not release
                if (msg.velocity > 0) {
                    const nowOn = this.stateManager.toggleDeckButton(msg.channel, msg.note);
                    console.log('🎚️  DECK BUTTON:', `ch${msg.channel} note${msg.note}`, nowOn ? 'ON' : 'OFF');
                }
                // Always set LED and emit event based on current toggle state, not velocity
                const isOn = this.stateManager.isDeckButtonOn(msg.channel, msg.note);
                this.setLED(msg.channel, msg.note, isOn ? 127 : 0);
                // Emit event with toggle state instead of press state
                const event = {
                    type: 'button',
                    button: msg.note,
                    pressed: isOn,
                    channel: msg.channel
                };
                this.emit('event', event);
                this.emit('button', event);
                return; // Skip normal event emission
            }
            // Handle shifted FX button press (toggle lock)
            else if (isShiftedFX) {
                const lockChange = this.stateManager.handleShiftedFXPress(msg.channel, msg.note, msg.velocity);
                if (lockChange) {
                    console.log('🔒 BUTTON LOCK:', `note=${lockChange.button}`, `channel=${lockChange.channel}`, `locked=${lockChange.locked}`);
                    // Update LED based on lock state
                    this.setLED(lockChange.channel, lockChange.button, lockChange.locked ? 127 : 0);
                    // Emit lock state change event
                    this.emit('lock', lockChange);
                }
            }
            else if (isShiftedPad) {
                // For shifted pads, echo LED to the original pad channel/note
                this.setLED(originalChannel, originalNote, msg.velocity);
            }
            else if (isFXButton) {
                // For FX buttons, use state manager to get proper LED velocity
                const ledVelocity = this.stateManager.getLEDVelocity(msg.channel, msg.note, msg.velocity);
                this.setLED(msg.channel, msg.note, ledVelocity);
            }
            else if (this.stateManager.isPerformancePad(msg.channel)) {
                // Performance pads: echo LED on same channel/note
                this.setLED(msg.channel, msg.note, msg.velocity);
            }
            else {
                // For other buttons, just echo normally
                this.setLED(msg.channel, msg.note, msg.velocity);
            }
            // Emit event with original channel/note for shifted pads
            const event = {
                type: 'button',
                button: originalNote,
                pressed: msg.velocity > 0,
                channel: originalChannel
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
