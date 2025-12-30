import easymidi from 'easymidi';
import { EventEmitter } from 'events';
import { ControllerEvent } from './types.js';
import { ControlStateManager } from './ControlStateManager.js';

export class DeviceManager extends EventEmitter {
  private input: easymidi.Input | null = null;
  private output: easymidi.Output | null = null;
  private deviceName: string | null = null;
  private stateManager: ControlStateManager;

  constructor() {
    super();
    this.stateManager = new ControlStateManager();
  }

  /**
   * Get list of available MIDI input devices
   */
  getAvailableDevices(): string[] {
    return easymidi.getInputs();
  }

  /**
   * Check if DDJ-SP1 is connected
   */
  isDeviceConnected(): boolean {
    const devices = this.getAvailableDevices();
    return devices.some(name => name.includes('DDJ-SP1'));
  }

  /**
   * Connect to the DDJ-SP1
   */
  connect(): void {
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
   * Initialize LEDs on device connection
   * Sets HOT CUE mode as active on both decks
   */
  private initializeLEDs(): void {
    if (!this.output) return;

    // Light up HOT CUE button (note 27) on both channels
    this.setLED(0, 27, 127); // Left (Deck 1)
    this.setLED(1, 27, 127); // Right (Deck 2)

    // Light up active pads for HOT CUE mode (1% brightness)
    this.updatePadLEDsForChannel(0); // Left pads
    this.updatePadLEDsForChannel(1); // Right pads

    console.log('🎮 Initialized: HOT CUE mode active on all decks');
  }

  /**
   * Update performance pad LEDs for a channel based on current deck's mode
   * @param channel - 0 for left pads, 1 for right pads
   * @param deckButtonChannel - Optional: 2 or 3 for deck 3/4, use this channel for LEDs too
   */
  private updatePadLEDsForChannel(channel: number, deckButtonChannel?: number): void {
    if (!this.output) return;

    // Determine which deck (1-4) is currently active for this channel
    let activeDeck: number;
    const isDeck3or4 = deckButtonChannel !== undefined;
    if (channel === 0) {
      const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
      activeDeck = deck3Active ? 3 : 1;
    } else {
      const deck4Active = this.stateManager.isDeckButtonOn(3, 114);
      activeDeck = deck4Active ? 4 : 2;
    }

    // Get the active mode for this deck
    const activeMode = this.stateManager.getActiveMode(activeDeck);

    // Map channel 0/1 (mode buttons) to channel 7/8 (performance pads)
    const padChannel = channel === 0 ? 7 : 8;

    // Turn off all pads first (try both pad channel and deck button channel)
    for (let i = 0; i < 8; i++) {
      this.setLED(padChannel, i, 0);
      if (deckButtonChannel && isDeck3or4) {
        this.setLED(deckButtonChannel, i, 0);
      }
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

      // For deck 3/4, try sending pads on BOTH deck button channel AND mode button channel
      if (deckButtonChannel && isDeck3or4) {
        console.log(`      ALSO trying pads on DECK ch${deckButtonChannel} notes [0-7] vel 2`);
        pads.forEach(pad => this.setLED(deckButtonChannel, pad, 2));

        console.log(`      ALSO trying pads on MODE BUTTON ch${channel} notes [0-7] vel 2`);
        pads.forEach(pad => this.setLED(channel, pad, 2));
      }
    }
    // Add other modes here as needed (ROLL, SLICER, SAMPLER)
  }

  /**
   * Re-initialize mode button LEDs (called when state needs to be synced)
   */
  public syncModeLEDs(): void {
    if (!this.output) return;

    // Get current mode for each channel based on active deck
    const leftMode = this.stateManager.getActiveModeForChannel(0);
    const rightMode = this.stateManager.getActiveModeForChannel(1);

    // Update mode button LEDs for left channel
    const modeButtons = this.stateManager.getModeButtons();
    modeButtons.forEach(btn => {
      this.setLED(0, btn, btn === leftMode ? 127 : 0);
    });

    // Update mode button LEDs for right channel
    modeButtons.forEach(btn => {
      this.setLED(1, btn, btn === rightMode ? 127 : 0);
    });

    // Update pad LEDs based on active deck's mode
    this.updatePadLEDsForChannel(0); // Left pads
    this.updatePadLEDsForChannel(1); // Right pads

    console.log('🔄 Synced mode LEDs to device');
  }

  /**
   * Get mode name for logging
   */
  private getModeName(note: number): string {
    const names: Record<number, string> = {
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
  disconnect(): void {
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
  getDeviceName(): string | null {
    return this.deviceName;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.input !== null;
  }

  /**
   * Get the state manager
   */
  getStateManager(): ControlStateManager {
    return this.stateManager;
  }

  /**
   * Send LED control message to the device
   * @param channel - MIDI channel
   * @param note - Note number
   * @param velocity - Velocity (0 = off, 127 = on, other values for different colors/brightness)
   */
  setLED(channel: number, note: number, velocity: number): void {
    if (!this.output) {
      console.warn('Cannot set LED: output not connected');
      return;
    }

    (this.output as any).send('noteon', {
      note: note,
      velocity: velocity,
      channel: channel
    });
  }

  /**
   * Turn on a button LED
   */
  turnOnLED(channel: number, note: number): void {
    this.setLED(channel, note, 127);
  }

  /**
   * Turn off a button LED
   */
  turnOffLED(channel: number, note: number): void {
    this.setLED(channel, note, 0);
  }

  private setupListeners(): void {
    if (!this.input) return;

    // Handle button presses (Note On/Off)
    this.input.on('noteon', (msg: any) => {
      // DEBUG: Log ALL pad messages to debug deck 3/4 pad LED issue
      if ((msg.channel === 7 || msg.channel === 8) && msg.velocity > 0) {
        console.log('🎹 PAD PRESS:', `ch${msg.channel}`, `note${msg.note}`, `vel${msg.velocity}`);
      }

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

      // Check if this is a SYNC button
      const isSyncButton = this.stateManager.isSyncButton(msg.channel, msg.note);

      // Check if this is a performance pad mode button (HOT CUE, ROLL, SLICER, SAMPLER)
      const isModeButton = this.stateManager.isModeButton(msg.channel, msg.note);

      // Handle mode button press (radio button behavior)
      if (isModeButton) {
        const modeChange = this.stateManager.handleModeButtonPress(msg.channel, msg.note, msg.velocity);
        if (modeChange) {
          // Turn off all mode button LEDs for this channel
          const modeButtons = this.stateManager.getModeButtons();
          modeButtons.forEach(btn => {
            this.setLED(msg.channel, btn, 0);
          });

          // Turn on only the active mode button LED
          this.setLED(msg.channel, modeChange.activeMode, 127);

          // Update performance pad LEDs for the new mode
          this.updatePadLEDsForChannel(msg.channel);

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
        // Determine which deck based on DECK button state
        let activeDeck: number;
        if (msg.channel === 7) {
          const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
          activeDeck = deck3Active ? 3 : 1;
        } else {
          const deck4Active = this.stateManager.isDeckButtonOn(3, 114);
          activeDeck = deck4Active ? 4 : 2;
        }
        const activeMode = this.stateManager.getActiveMode(activeDeck);

        // Only handle pads that are active in current mode
        if (activeMode === 27) { // HOT CUE mode
          const activePads = [0, 1, 2, 3, 4, 5, 6, 7]; // All 8 pads
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
              note: msg.note,
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
      } else if (isShiftedPad) {
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
          const baseMapping: Record<number, { fx: number; baseDeck: number }> = {
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
            const lightNoteMapping: Record<number, number> = {
              76: 90,  // Left 1:  FX1→Deck1 button, FX1→Deck3 light (11L) ✓
              77: 91,  // Right 1: FX1→Deck2 button, FX1→Deck4 light (was transposed)
              80: 92,  // Left 2:  FX2→Deck1 button, FX2→Deck3 light (was transposed)
              81: 93,  // Right 2: FX2→Deck2 button, FX2→Deck4 light (12R)
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
            const event: ControllerEvent = {
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
        // Channel 2 = DECK 1/3 (controls left pads, channel 0)
        // Channel 3 = DECK 2/4 (controls right pads, channel 1)
        const padChannel = msg.channel === 2 ? 0 : 1;

        setTimeout(() => {
          // Get the mode for the newly active deck
          const activeMode = this.stateManager.getActiveModeForChannel(padChannel);

          // Try sending mode button LEDs on BOTH the mode button channel AND the DECK button channel
          // Some controllers use different channels for LED control when deck 3/4 is active
          const modeButtons = this.stateManager.getModeButtons();

          // Always send on the mode button channel (0 or 1)
          console.log(`   📡 Setting mode button LEDs on channel ${padChannel}, activeMode=${activeMode} (${this.getModeName(activeMode)})`);
          modeButtons.forEach(btn => {
            const velocity = btn === activeMode ? 127 : 0;
            console.log(`      LED: ch${padChannel} note${btn} vel${velocity}`);
            this.setLED(padChannel, btn, velocity);
          });

          // ALSO try sending on the DECK button channel (2 or 3) for deck 3/4
          if (isOn) {
            console.log(`   📡 ALSO trying mode button LEDs on DECK channel ${msg.channel}`);
            modeButtons.forEach(btn => {
              const velocity = btn === activeMode ? 127 : 0;
              console.log(`      LED: ch${msg.channel} note${btn} vel${velocity}`);
              this.setLED(msg.channel, btn, velocity);
            });
          }

          // Update pad LEDs (pass deck button channel for deck 3/4)
          console.log(`   📡 Updating pad LEDs for channel ${padChannel}`);
          this.updatePadLEDsForChannel(padChannel, isOn ? msg.channel : undefined);
        }, 50); // 50ms delay to let hardware process DECK button

        // Emit event with toggle state
        const event: ControllerEvent = {
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
        let activeDeck: number;
        if (msg.channel === 0) {
          const deck3Active = this.stateManager.isDeckButtonOn(2, 114);
          activeDeck = deck3Active ? 3 : 1;
        } else {
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
        } else {
          // Toggle sync state
          const nowSynced = this.stateManager.toggleSync(activeDeck);

          // Update SYNC button LED
          this.setLED(msg.channel, msg.note, nowSynced ? 127 : 0);

          // Emit sync state change event
          this.emit('syncChange', { deck: activeDeck, synced: nowSynced });
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
      } else if (isShiftedPad) {
        // For shifted pads, echo LED to the original pad channel/note
        this.setLED(originalChannel, originalNote, msg.velocity);
      } else if (isFXButton) {
        // For FX buttons, use state manager to get proper LED velocity
        const ledVelocity = this.stateManager.getLEDVelocity(msg.channel, msg.note, msg.velocity);
        this.setLED(msg.channel, msg.note, ledVelocity);
      } else if (this.stateManager.isPerformancePad(msg.channel)) {
        // Performance pads: echo LED on same channel/note
        this.setLED(msg.channel, msg.note, msg.velocity);
      } else {
        // For other buttons, just echo normally
        this.setLED(msg.channel, msg.note, msg.velocity);
      }

      // Emit event with original channel/note for shifted pads
      const event: ControllerEvent = {
        type: 'button',
        button: originalNote,
        pressed: msg.velocity > 0,
        channel: originalChannel
      };
      this.emit('event', event);
      this.emit('button', event);
    });

    // Handle knobs and dials (Control Change)
    this.input.on('cc', (msg: any) => {
      console.log('🔄 KNOB:', `controller=${msg.controller}`, `channel=${msg.channel}`, `value=${msg.value}`);

      // Check if this is a BEATS knob (tempo selector)
      const isBeats = this.stateManager.isBeatsKnob(msg.channel, msg.controller);
      console.log(`   isBeatsKnob(${msg.channel}, ${msg.controller}) = ${isBeats}`);

      if (isBeats) {
        console.log('   🎵 BEATS KNOB DETECTED - calling handleBeatsKnobChange');
        const newTempo = this.stateManager.handleBeatsKnobChange(msg.channel, msg.value);
        if (newTempo !== null) {
          console.log(`🎵 TEMPO CHANGED: ${newTempo} BPM`);
          this.emit('tempoChange', { tempo: newTempo });
        }
      }

      const event: ControllerEvent = {
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
