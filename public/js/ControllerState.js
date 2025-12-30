/**
 * ControllerState
 *
 * Manages the state of all controls on the DDJ-SP1 controller.
 * Single source of truth for button states, knob values, and lock states.
 */
export class ControllerState {
  constructor() {
    this.controls = new Map();
    this.lockedButtons = new Set();
    this.currentTempo = 94; // Current tempo: 84, 94, or 102
    this.deckButtonStates = new Map(); // Track DECK 3/4 button toggle states
    this.padModes = new Map([[1, 27], [2, 27], [3, 27], [4, 27]]); // Track active mode for each deck 1-4 (default: HOT CUE)
    this.knobClickButtons = {
      'button-67-ch4': 'knob-0-ch4',
      'button-67-ch5': 'knob-0-ch5',
      'button-13-ch0': 'knob-23-ch0',
      'button-13-ch1': 'knob-23-ch1',
      'button-65-ch6': 'knob-64-ch6'
    };
  }

  /**
   * Register a control element
   */
  registerControl(id, element) {
    this.controls.set(id, {
      id,
      element,
      type: this.getControlType(element),
      value: null
    });
  }

  /**
   * Register a knob-click button (button that shows ring on knob)
   */
  registerKnobClickButton(buttonId, targetKnobId) {
    this.controls.set(buttonId, {
      id: buttonId,
      type: 'knob-click',
      targetKnob: targetKnobId
    });
  }

  /**
   * Get control type from element
   */
  getControlType(element) {
    if (element.querySelector('.button')) return 'button';
    if (element.querySelector('.slider-container')) return 'slider';
    if (element.querySelector('.knob-container')) return 'knob';
    return 'unknown';
  }

  /**
   * Check if a control exists
   */
  hasControl(id) {
    return this.controls.has(id);
  }

  /**
   * Get a control by ID
   */
  getControl(id) {
    return this.controls.get(id);
  }

  /**
   * Get all controls
   */
  getAllControls() {
    return Array.from(this.controls.values());
  }

  /**
   * Update button state
   */
  updateButton(id, pressed) {
    const control = this.controls.get(id);
    if (control) {
      control.value = pressed;

      // Handle DECK button state (button-114-ch2 and button-114-ch3)
      // Server sends the actual toggle state, so just set it directly
      if (id === 'button-114-ch2' || id === 'button-114-ch3') {
        const channel = id === 'button-114-ch2' ? 2 : 3;
        this.deckButtonStates.set(channel, pressed);
        console.log(`🎚️ DECK button ch${channel}: ${pressed ? 'ON' : 'OFF'}`);
      }

      return control;
    }
    return null;
  }

  /**
   * Update knob value
   */
  updateKnob(id, value) {
    const control = this.controls.get(id);
    if (control) {
      control.value = value;
      return control;
    }
    return null;
  }

  /**
   * Update slider value
   */
  updateSlider(id, value) {
    const control = this.controls.get(id);
    if (control) {
      control.value = value;
      return control;
    }
    return null;
  }

  /**
   * Set button lock state
   */
  setButtonLocked(lockKey, locked) {
    if (locked) {
      this.lockedButtons.add(lockKey);
    } else {
      this.lockedButtons.delete(lockKey);
    }
  }

  /**
   * Check if button is locked
   */
  isButtonLocked(lockKey) {
    return this.lockedButtons.has(lockKey);
  }

  /**
   * Get knob click button mapping
   */
  getKnobClickTarget(buttonId) {
    return this.knobClickButtons[buttonId];
  }

  /**
   * Set current tempo
   */
  setTempo(tempo) {
    this.currentTempo = tempo;
  }

  /**
   * Get current tempo
   */
  getTempo() {
    return this.currentTempo;
  }

  /**
   * Check if a knob is a BEATS knob (tempo selector)
   */
  isBeatsKnob(id) {
    return id === 'knob-0-ch4' || id === 'knob-0-ch5';
  }

  /**
   * Check if a DECK 3/4 button is active (toggle state)
   * DECK 1/3 = channel 2, note 114
   * DECK 2/4 = channel 3, note 114
   */
  isDeckButtonActive(channel) {
    return this.deckButtonStates.get(channel) || false;
  }

  /**
   * Set DECK button state (from server sync)
   */
  setDeckButtonState(channel, isActive) {
    this.deckButtonStates.set(channel, isActive);
  }

  /**
   * Set active pad mode for a deck (1-4)
   */
  setActiveMode(deck, modeNote) {
    this.padModes.set(deck, modeNote);
  }

  /**
   * Get active pad mode for a deck (1-4)
   */
  getActiveMode(deck) {
    return this.padModes.get(deck) || 27; // Default to HOT CUE
  }

  /**
   * Get active mode for a channel (0 or 1) based on DECK button state
   * Channel 0 (left) → Deck 1 or 3
   * Channel 1 (right) → Deck 2 or 4
   */
  getActiveModeForChannel(channel) {
    let targetDeck;
    if (channel === 0) {
      const deck3Active = this.isDeckButtonActive(2);
      targetDeck = deck3Active ? 3 : 1;
    } else {
      const deck4Active = this.isDeckButtonActive(3);
      targetDeck = deck4Active ? 4 : 2;
    }
    return this.getActiveMode(targetDeck);
  }

  /**
   * Clear all state (useful for reset)
   */
  clear() {
    this.controls.clear();
    this.lockedButtons.clear();
    this.currentTempo = 94;
    this.padModes = new Map([[0, 27], [1, 27]]);
  }
}
