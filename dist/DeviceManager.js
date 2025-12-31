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
        this.initializeLEDs();
    }
    /**
     * Get the active deck number (1-4) from a performance pad channel
     * Handles both direct pad channels (9, 10 for decks 3, 4) and
     * DECK button-switched channels (7, 8 for decks 1/3 or 2/4)
     */
    getActiveDeckFromChannel(channel) {
        if (channel === 9)
            return 3;
        if (channel === 10)
            return 4;
        if (channel === 7) {
            const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
            return deck3Active ? 3 : 1;
        }
        if (channel === 8) {
            const deck4Active = this.stateManager.isDeckButtonOn(3, 114);
            return deck4Active ? 4 : 2;
        }
        return 1; // Default
    }
    /**
     * Initialize LEDs on device connection
     * Sets HOT CUE mode as active on all 4 decks
     */
    initializeLEDs() {
        if (!this.output)
            return;
        // Light up HOT CUE button (note 27) on all 4 deck channels
        // Mode buttons are on performance pad channels: 7, 8, 9, 10 (decks 1, 2, 3, 4)
        this.setLED(7, 27, 127); // Deck 1
        this.setLED(8, 27, 127); // Deck 2
        this.setLED(9, 27, 127); // Deck 3
        this.setLED(10, 27, 127); // Deck 4
        // Light up active pads for HOT CUE mode
        this.updatePadLEDsForChannel(0); // Left pads (Deck 1)
        this.updatePadLEDsForChannel(1); // Right pads (Deck 2)
        console.log('🎮 Initialized: HOT CUE mode active on all decks');
    }
    /**
     * Update performance pad LEDs for a channel based on current deck's mode
     * @param channel - 0 for left pads, 1 for right pads
     */
    updatePadLEDsForChannel(channel) {
        if (!this.output)
            return;
        // Determine which deck (1-4) is currently active for this channel
        let activeDeck;
        if (channel === 0) {
            const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
            activeDeck = deck3Active ? 3 : 1;
        }
        else {
            const deck4Active = this.stateManager.isDeckButtonOn(3, 114);
            activeDeck = deck4Active ? 4 : 2;
        }
        // Get the active mode for this deck
        const activeMode = this.stateManager.getActiveMode(activeDeck);
        // Map deck to pad channel:
        // Deck 1 → Channel 7, Deck 2 → Channel 8, Deck 3 → Channel 9, Deck 4 → Channel 10
        const padChannel = activeDeck === 1 ? 7 : activeDeck === 2 ? 8 : activeDeck === 3 ? 9 : 10;
        console.log(`   📡 updatePadLEDsForChannel: channel=${channel}, activeDeck=${activeDeck}, padChannel=${padChannel}, mode=${activeMode}`);
        // Turn off all pads first on the correct pad channel
        for (let i = 0; i < 8; i++) {
            this.setLED(padChannel, i, 0);
        }
        // Light up specific pads based on mode
        if (activeMode === 27) {
            // HOT CUE mode: light up all 8 pads
            // Pad 1 (0): LEAD
            // Pad 2 (1): 0.5 beats (eighth note)
            // Pad 3 (2): 0.75 beats (shuffle point)
            // Pad 4 (3): 1.0 beat (first snare)
            // Pad 5 (4): 0 beats (body start)
            // Pad 6 (5): 16 beats (25%)
            // Pad 7 (6): 32 beats (50%)
            // Pad 8 (7): 48 beats (75%)
            const pads = [0, 1, 2, 3, 4, 5, 6, 7];
            console.log(`      Setting HOT CUE pads: ch${padChannel} notes [0-7] vel 2`);
            pads.forEach(pad => this.setLED(padChannel, pad, 2));
        }
        // Add other modes here as needed (ROLL, SLICER, SAMPLER)
    }
    /**
     * Re-initialize mode button LEDs (called when state needs to be synced)
     */
    syncModeLEDs() {
        if (!this.output)
            return;
        const modeButtons = this.stateManager.getModeButtons();
        // Update mode button LEDs for all 4 decks
        // Mode buttons are on channels 7, 8, 9, 10 (decks 1, 2, 3, 4)
        for (let deck = 1; deck <= 4; deck++) {
            const padChannel = deck + 6; // Deck 1→ch7, Deck 2→ch8, Deck 3→ch9, Deck 4→ch10
            const activeMode = this.stateManager.getActiveMode(deck);
            modeButtons.forEach(btn => {
                this.setLED(padChannel, btn, btn === activeMode ? 127 : 0);
            });
        }
        // Update pad LEDs based on active deck's mode
        this.updatePadLEDsForChannel(0); // Left pads (Deck 1 or 3)
        this.updatePadLEDsForChannel(1); // Right pads (Deck 2 or 4)
        console.log('🔄 Synced mode LEDs to device');
    }
    /**
     * Get mode name for logging
     */
    getModeName(note) {
        const names = {
            27: 'HOT CUE',
            30: 'ROLL',
            32: 'SLICER',
            34: 'SAMPLER'
        };
        return names[note] || 'UNKNOWN';
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
     * Get the state manager
     */
    getStateManager() {
        return this.stateManager;
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
            // Check if this is a pad release (velocity 0)
            if (this.stateManager.isPerformancePad(msg.channel) && msg.velocity === 0) {
                console.log('🎹 PAD RELEASE (noteon vel=0):', `ch${msg.channel}`, `note${msg.note}`);
                // Determine which deck from channel (handles all 4 decks)
                const activeDeck = this.getActiveDeckFromChannel(msg.channel);
                // Emit pad release event
                this.emit('padRelease', {
                    channel: msg.channel,
                    note: msg.note,
                    deck: activeDeck
                });
                return;
            }
            // DEBUG: Log ALL pad messages for all 4 decks
            if (this.stateManager.isPerformancePad(msg.channel) && msg.velocity > 0) {
                const deck = this.getActiveDeckFromChannel(msg.channel);
                console.log('🎹 PAD PRESS:', `ch${msg.channel}`, `deck${deck}`, `note${msg.note}`, `vel${msg.velocity}`);
            }
            // Check if this is the SHIFT button (button-64-ch6)
            // Note: SHIFT state is tracked for UI purposes, but the hardware sends different
            // CC messages (e.g., CC 55 instead of CC 23) when SHIFT is held
            if (msg.channel === 6 && msg.note === 64) {
                this.stateManager.setShiftPressed(msg.velocity > 0);
                console.log(`⬆️  SHIFT: ${msg.velocity > 0 ? 'PRESSED' : 'RELEASED'}`);
            }
            // Check if this is an FX ASSIGN button
            const isFXAssignButton = this.stateManager.isFXAssignButton(msg.channel, msg.note);
            // Check if this is a DECK button (DECK 1/3 or DECK 2/4)
            const isDeckButton = this.stateManager.isDeckButton(msg.channel, msg.note);
            // Check if this is a SYNC button
            const isSyncButton = this.stateManager.isSyncButton(msg.channel, msg.note);
            // Check if this is a performance pad mode button (HOT CUE, ROLL, SLICER, SAMPLER)
            const isModeButton = this.stateManager.isModeButton(msg.channel, msg.note);
            // Handle mode button press (radio button behavior)
            if (isModeButton) {
                const modeChange = this.stateManager.handleModeButtonPress(msg.channel, msg.note, msg.velocity);
                if (modeChange) {
                    // Turn off all mode button LEDs for this pad channel
                    const modeButtons = this.stateManager.getModeButtons();
                    modeButtons.forEach(btn => {
                        this.setLED(msg.channel, btn, 0);
                    });
                    // Turn on only the active mode button LED
                    this.setLED(msg.channel, modeChange.activeMode, 127);
                    // Update performance pad LEDs for the new mode (map deck to UI channel 0 or 1)
                    const uiChannel = (modeChange.deck === 1 || modeChange.deck === 3) ? 0 : 1;
                    this.updatePadLEDsForChannel(uiChannel);
                    // Emit mode change event
                    this.emit('modeChange', modeChange);
                }
            }
            // Check if this is a shifted FX button
            const isShiftedFX = this.stateManager.isShiftedFXNote(msg.note, msg.channel);
            // Check if this is a shifted performance pad
            const isShiftedPad = this.stateManager.isShiftedPad(msg.note, msg.channel);
            // Check if this is a performance pad press (channels 7 & 8)
            const isPerformancePad = this.stateManager.isPerformancePad(msg.channel);
            // Handle performance pad press with LED feedback
            if (isPerformancePad && msg.velocity > 0) {
                // Determine which deck from channel (handles all 4 decks)
                const activeDeck = this.getActiveDeckFromChannel(msg.channel);
                const activeMode = this.stateManager.getActiveMode(activeDeck);
                console.log(`🎹 PAD ${msg.note} on deck ${activeDeck}: activeMode=${activeMode}`);
                // Only handle pads that are active in current mode
                if (activeMode === 27 || activeMode === 30) { // HOT CUE mode (27) or ROLL mode (30)
                    console.log(`✅ Mode ${activeMode} matched - emitting padPress`);
                    // All performance pads use notes 0-7 regardless of mode
                    const activePads = [0, 1, 2, 3, 4, 5, 6, 7];
                    if (activePads.includes(msg.note)) {
                        // Flash off
                        this.setLED(msg.channel, msg.note, 0);
                        // Flash back on after 100ms
                        setTimeout(() => {
                            this.setLED(msg.channel, msg.note, 2);
                        }, 100);
                        // Emit pad press event for audio playback
                        const isSynced = this.stateManager.isSynced(activeDeck);
                        this.emit('padPress', {
                            channel: msg.channel,
                            note: msg.note, // 0-7
                            deck: activeDeck,
                            synced: isSynced
                        });
                    }
                }
            }
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
                    const activeDeck = msg.channel === 2 ? (nowOn ? 3 : 1) : (nowOn ? 4 : 2);
                    console.log(`   → Switched to Deck ${activeDeck}`);
                }
                // Always set DECK button LED based on current toggle state
                const isOn = this.stateManager.isDeckButtonOn(msg.channel, msg.note);
                this.setLED(msg.channel, msg.note, isOn ? 127 : 0);
                // Update mode button LEDs and pad LEDs with a small delay
                // to give the hardware time to process the DECK button press
                // Mode buttons are on deck control channels (0, 1, 2, 3), NOT pad channels
                // Channel 2 (DECK 1/3 button) controls mode LEDs on channel 0 or 2
                // Channel 3 (DECK 2/4 button) controls mode LEDs on channel 1 or 3
                const uiChannel = msg.channel === 2 ? 0 : 1;
                const activeDeck = msg.channel === 2 ? (isOn ? 3 : 1) : (isOn ? 4 : 2);
                // Mode buttons are on deck control channels: deck 1→ch0, deck 2→ch1, deck 3→ch2, deck 4→ch3
                const modeButtonChannel = activeDeck - 1;
                setTimeout(() => {
                    // Get the mode for the newly active deck
                    const activeMode = this.stateManager.getActiveMode(activeDeck);
                    // Send mode button LEDs on the correct deck control channel
                    const modeButtons = this.stateManager.getModeButtons();
                    console.log(`   📡 Setting mode button LEDs on channel ${modeButtonChannel} (deck ${activeDeck}), activeMode=${activeMode} (${this.getModeName(activeMode)})`);
                    modeButtons.forEach(btn => {
                        const velocity = btn === activeMode ? 127 : 0;
                        console.log(`      LED: ch${modeButtonChannel} note${btn} vel${velocity}`);
                        this.setLED(modeButtonChannel, btn, velocity);
                    });
                    // Update pad LEDs for the active deck
                    console.log(`   📡 Updating pad LEDs for UI channel ${uiChannel} (deck ${activeDeck})`);
                    this.updatePadLEDsForChannel(uiChannel);
                }, 50); // 50ms delay to let hardware process DECK button
                // Emit event with toggle state
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
            // Handle SYNC button press (toggle sync state)
            else if (isSyncButton && msg.velocity > 0) {
                // Determine which deck this SYNC button controls
                let activeDeck;
                if (msg.channel === 0) {
                    const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
                    activeDeck = deck3Active ? 3 : 1;
                }
                else {
                    const deck4Active = this.stateManager.isDeckButtonOn(3, 114);
                    activeDeck = deck4Active ? 4 : 2;
                }
                const shiftPressed = this.stateManager.isShiftPressed();
                console.log(`🔄 SYNC pressed on Deck ${activeDeck}, SHIFT=${shiftPressed}`);
                // Check if SHIFT is pressed
                if (shiftPressed) {
                    // SHIFT + SYNC = vinyl stop/brake effect
                    console.log(`🛑 Deck ${activeDeck} SPINDOWN (vinyl stop)`);
                    this.emit('spindown', { deck: activeDeck });
                }
                else {
                    // Emit sync event on every button press to sync all other decks
                    console.log(`🔗 Emitting syncChange for Deck ${activeDeck}`);
                    this.emit('syncChange', { deck: activeDeck, synced: true });
                    // Keep LED always lit for SYNC button
                    this.setLED(msg.channel, msg.note, 127);
                }
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
        // Handle button releases (Note Off) - for roll mode
        this.input.on('noteoff', (msg) => {
            console.log('🎹 PAD RELEASE (noteoff):', `ch${msg.channel}`, `note${msg.note}`, `vel${msg.velocity}`);
            // Only handle performance pad releases (all 4 deck channels)
            if (this.stateManager.isPerformancePad(msg.channel)) {
                // Determine which deck from channel (handles all 4 decks)
                const activeDeck = this.getActiveDeckFromChannel(msg.channel);
                // Emit pad release event
                this.emit('padRelease', {
                    channel: msg.channel,
                    note: msg.note, // 0-7
                    deck: activeDeck
                });
            }
        });
        // Handle knobs and dials (Control Change)
        this.input.on('cc', (msg) => {
            // Check if this is SHIFT + volume knob (CC 55) = tempo control
            // According to spec: volume knob sends CC 23 normally, CC 55 when SHIFT is held
            const isShiftedVolumeKnob = msg.controller === 55 && (msg.channel >= 0 && msg.channel <= 3);
            if (isShiftedVolumeKnob) {
                // SHIFT + Volume knob = tempo control
                console.log(`🎵 SHIFT + VOLUME: ch${msg.channel} CC${msg.controller} value=${msg.value}`);
                const newTempo = this.stateManager.handleBeatsKnobChange(msg.channel, msg.value);
                if (newTempo !== null) {
                    console.log(`🎵 TEMPO CHANGED: ${newTempo} BPM`);
                    this.emit('tempoChange', { tempo: newTempo });
                }
                return; // Don't emit normal knob event
            }
            // Check if this is SHIFT + rotary selector/browse knob (CC 100) = 10x scroll speed
            // According to spec: browse knob sends CC 64 normally, CC 100 when SHIFT is held
            const isShiftedBrowseKnob = msg.controller === 100 && msg.channel === 6;
            if (isShiftedBrowseKnob) {
                // SHIFT + Browse knob = fast scroll (10x speed)
                console.log(`⚡ SHIFT + BROWSE (10x scroll): value=${msg.value}`);
            }
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
