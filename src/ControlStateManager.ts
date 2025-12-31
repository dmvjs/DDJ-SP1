/**
 * ControlStateManager
 *
 * Manages control state for the DDJ-SP1, including:
 * - Shift button detection
 * - Button lock/unlock state (for FX buttons)
 * - LED state management
 * - Note mapping for shifted controls
 */

export interface LockStateChange {
  button: number;
  channel: number;
  locked: boolean;
}

export class ControlStateManager {
  private shiftPressed: boolean = false;
  private lockedButtons: Map<string, boolean> = new Map();
  private fxAssignments: Map<string, boolean> = new Map(); // key: "fx:deck" (e.g., "1:1" = FX1→Deck1)
  private deckButtonStates: Map<string, boolean> = new Map(); // key: "channel:note" for DECK buttons

  // Performance pad mode management
  // Tracks mode for each of the 4 decks (1-4)
  private padModes: Map<number, number> = new Map([
    [1, 27], // Deck 1 starts with HOT CUE (note 27)
    [2, 27], // Deck 2 starts with HOT CUE (note 27)
    [3, 27], // Deck 3 starts with HOT CUE (note 27)
    [4, 27], // Deck 4 starts with HOT CUE (note 27)
  ]);
  private readonly modeButtons = [27, 30, 32, 34]; // HOT CUE, ROLL, SLICER, SAMPLER

  // Tempo management
  private currentTempo: 84 | 94 | 102 = 94;
  private readonly tempos: Array<84 | 94 | 102> = [84, 94, 102];

  // Sync state: tracks which decks are synced
  private syncStates: Map<number, boolean> = new Map([
    [1, false],
    [2, false],
    [3, false],
    [4, false],
  ]);

  // Map shifted note numbers to their unshifted equivalents
  private readonly shiftedNoteMap: Map<number, number> = new Map([
    [99, 71],   // FX1
    [100, 72],  // FX2
    [101, 73],  // FX3
    [102, 67],  // TAP (or 74 for FX ASSIGN)
  ]);

  // Performance pad shift mapping → pad mode buttons (HOT CUE, ROLL, SLICER, SAMPLER)
  private readonly shiftedPadMap: Map<string, string> = new Map([
    // Deck A - shift + top row pads → mode buttons
    ['0:105', '0:27'],   // HOT CUE
    ['0:107', '0:30'],   // ROLL
    ['0:109', '0:32'],   // SLICER
    ['0:111', '0:34'],   // SAMPLER
    // Deck B - shift + top row pads → mode buttons
    ['1:105', '1:27'],   // HOT CUE
    ['1:107', '1:30'],   // ROLL
    ['1:109', '1:32'],   // SLICER
    ['1:111', '1:34'],   // SAMPLER
  ]);

  /**
   * Update shift button state
   */
  setShiftPressed(pressed: boolean): void {
    this.shiftPressed = pressed;
  }

  /**
   * Get current shift button state
   */
  isShiftPressed(): boolean {
    return this.shiftPressed;
  }

  /**
   * Check if a note is a shifted FX button
   */
  isShiftedFXNote(note: number, channel: number): boolean {
    return this.shiftedNoteMap.has(note) && (channel === 4 || channel === 5);
  }

  /**
   * Check if a note is a shifted performance pad
   */
  isShiftedPad(note: number, channel: number): boolean {
    const key = `${channel}:${note}`;
    return this.shiftedPadMap.has(key);
  }

  /**
   * Get the original pad channel and note for a shifted pad
   */
  getOriginalPad(note: number, channel: number): { channel: number; note: number } | null {
    const key = `${channel}:${note}`;
    const mapped = this.shiftedPadMap.get(key);
    if (!mapped) return null;

    const [ch, n] = mapped.split(':').map(Number);
    return { channel: ch, note: n };
  }

  /**
   * Get the original (unshifted) note for a shifted note
   */
  getOriginalNote(note: number): number {
    return this.shiftedNoteMap.get(note) ?? note;
  }

  /**
   * Check if a button is an FX button (channels 4 & 5, specific notes)
   */
  isFXButton(channel: number, note: number): boolean {
    return (channel === 4 || channel === 5) &&
           (note === 71 || note === 72 || note === 73 || note === 74 || note === 67);
  }

  /**
   * Check if a button is a performance pad (channels 7, 8, 9, 10)
   * Channel 7 = Deck 1, Channel 8 = Deck 2, Channel 9 = Deck 3, Channel 10 = Deck 4
   */
  isPerformancePad(channel: number): boolean {
    return channel === 7 || channel === 8 || channel === 9 || channel === 10;
  }

  /**
   * Check if a button is an FX ASSIGN button (channel 6, notes 76/77/80/81)
   */
  isFXAssignButton(channel: number, note: number): boolean {
    return channel === 6 && (note === 76 || note === 77 || note === 80 || note === 81);
  }

  /**
   * Get FX unit and deck from FX ASSIGN button note
   * Takes into account DECK 3/4 button states to determine target deck
   * @returns {fx, deck, isAltDeck} or null if not an FX ASSIGN button
   */
  getFXAssignMapping(note: number): { fx: number; deck: number; isAltDeck: boolean } | null {
    // Base mapping (Deck 1 or 2)
    const baseMapping: Record<number, { fx: number; baseDeck: number }> = {
      76: { fx: 1, baseDeck: 1 }, // Left side, top button
      80: { fx: 2, baseDeck: 1 }, // Left side, bottom button
      77: { fx: 1, baseDeck: 2 }, // Right side, top button
      81: { fx: 2, baseDeck: 2 }, // Right side, bottom button
    };

    const base = baseMapping[note];
    if (!base) return null;

    // Check if DECK 3/4 button is active for this side
    const isDeck3Active = this.isDeckButtonOn(2, 114); // DECK 1/3 button
    const isDeck4Active = this.isDeckButtonOn(3, 114); // DECK 2/4 button

    let targetDeck = base.baseDeck;
    let isAltDeck = false;

    // If left side (deck 1) and DECK 3 is active, target deck 3
    if (base.baseDeck === 1 && isDeck3Active) {
      targetDeck = 3;
      isAltDeck = true;
    }
    // If right side (deck 2) and DECK 4 is active, target deck 4
    else if (base.baseDeck === 2 && isDeck4Active) {
      targetDeck = 4;
      isAltDeck = true;
    }

    return { fx: base.fx, deck: targetDeck, isAltDeck };
  }

  /**
   * Toggle FX assignment to a deck
   * @returns new assignment state
   */
  toggleFXAssignment(fx: number, deck: number): boolean {
    const key = `${fx}:${deck}`;
    const wasAssigned = this.fxAssignments.get(key) || false;
    const nowAssigned = !wasAssigned;
    this.fxAssignments.set(key, nowAssigned);
    return nowAssigned;
  }

  /**
   * Check if an FX is assigned to a deck
   */
  isFXAssigned(fx: number, deck: number): boolean {
    const key = `${fx}:${deck}`;
    return this.fxAssignments.get(key) || false;
  }

  /**
   * Check if a button is a DECK button (channel 2 or 3, note 114)
   */
  isDeckButton(channel: number, note: number): boolean {
    return (channel === 2 || channel === 3) && note === 114;
  }

  /**
   * Toggle DECK button state
   * @returns new state (true = on, false = off)
   */
  toggleDeckButton(channel: number, note: number): boolean {
    const key = `${channel}:${note}`;
    const wasOn = this.deckButtonStates.get(key) || false;
    const nowOn = !wasOn;
    this.deckButtonStates.set(key, nowOn);
    return nowOn;
  }

  /**
   * Check if a DECK button is currently on
   */
  isDeckButtonOn(channel: number, note: number): boolean {
    const key = `${channel}:${note}`;
    return this.deckButtonStates.get(key) || false;
  }

  /**
   * Get current DECK button states for syncing to client
   * @returns {deck1_3: boolean, deck2_4: boolean}
   */
  getDeckButtonStates(): { deck1_3: boolean; deck2_4: boolean } {
    return {
      deck1_3: this.isDeckButtonOn(2, 114),
      deck2_4: this.isDeckButtonOn(3, 114)
    };
  }

  /**
   * Toggle lock state for a button
   * @returns new lock state
   */
  toggleButtonLock(channel: number, note: number): boolean {
    const key = this.getButtonKey(channel, note);
    const wasLocked = this.lockedButtons.get(key) || false;
    const nowLocked = !wasLocked;
    this.lockedButtons.set(key, nowLocked);
    return nowLocked;
  }

  /**
   * Check if a button is locked
   */
  isButtonLocked(channel: number, note: number): boolean {
    const key = this.getButtonKey(channel, note);
    return this.lockedButtons.get(key) || false;
  }

  /**
   * Get LED velocity based on button state
   * @param channel - MIDI channel
   * @param note - Note number
   * @param velocity - Original velocity from MIDI event
   * @returns LED velocity to send
   */
  getLEDVelocity(channel: number, note: number, velocity: number): number {
    const isLocked = this.isButtonLocked(channel, note);

    if (isLocked) {
      // Keep locked buttons lit
      return 127;
    }

    // Echo the velocity for unlocked buttons
    return velocity;
  }

  /**
   * Handle a shifted FX button press
   * @returns LockStateChange if lock state changed, null otherwise
   */
  handleShiftedFXPress(channel: number, note: number, velocity: number): LockStateChange | null {
    // Only process on button press (velocity > 0)
    if (velocity === 0) {
      return null;
    }

    const originalNote = this.getOriginalNote(note);
    const nowLocked = this.toggleButtonLock(channel, originalNote);

    return {
      button: originalNote,
      channel: channel,
      locked: nowLocked
    };
  }

  /**
   * Clear all locked buttons (useful for reset)
   */
  clearAllLocks(): void {
    this.lockedButtons.clear();
  }

  /**
   * Get all currently locked buttons
   */
  getLockedButtons(): Array<{ channel: number; note: number }> {
    const result: Array<{ channel: number; note: number }> = [];

    for (const [key, locked] of this.lockedButtons.entries()) {
      if (locked) {
        const [channel, note] = key.split(':').map(Number);
        result.push({ channel, note });
      }
    }

    return result;
  }

  /**
   * Check if a control is a BEATS knob (channels 4 or 5, note 0)
   */
  isBeatsKnob(channel: number, note: number): boolean {
    return (channel === 4 || channel === 5) && note === 0;
  }

  /**
   * Handle BEATS knob change to switch between tempos
   * Both BEATS knobs (left and right) stay synced
   * @returns new tempo if changed, null if no change
   */
  handleBeatsKnobChange(channel: number, value: number): 84 | 94 | 102 | null {
    console.log(`🔍 BEATS KNOB: ch${channel} value=${value}`);

    // Infinite encoders send low values (1-63) for clockwise, high values (65-127) for counter-clockwise
    if (value === 64) {
      return null;
    }

    const isClockwise = value < 64;

    const currentIndex = this.tempos.indexOf(this.currentTempo);
    console.log(`   Current tempo: ${this.currentTempo} (index ${currentIndex}), turning ${isClockwise ? 'RIGHT' : 'LEFT'}`);

    let newIndex: number;

    if (isClockwise) {
      // Turn right: go up (84 → 94 → 102, stops at 102)
      newIndex = Math.min(currentIndex + 1, this.tempos.length - 1);
    } else {
      // Turn left: go down (102 → 94 → 84, stops at 84)
      newIndex = Math.max(currentIndex - 1, 0);
    }

    // Only update if tempo actually changed
    if (newIndex === currentIndex) {
      console.log(`   Already at ${isClockwise ? 'max' : 'min'} tempo, no change`);
      return null;
    }

    this.currentTempo = this.tempos[newIndex];
    console.log(`   ✅ New tempo: ${this.currentTempo}`);
    return this.currentTempo;
  }

  /**
   * Get current tempo
   */
  getCurrentTempo(): 84 | 94 | 102 {
    return this.currentTempo;
  }

  /**
   * Set tempo directly (for external control or initialization)
   */
  setTempo(tempo: 84 | 94 | 102): void {
    if (!this.tempos.includes(tempo)) {
      throw new Error(`Invalid tempo: ${tempo}. Must be 84, 94, or 102`);
    }
    this.currentTempo = tempo;
  }

  /**
   * Check if a button is a performance pad mode button
   * Mode buttons are on deck control channels 0, 1, 2, 3 (for decks 1, 2, 3, 4)
   */
  isModeButton(channel: number, note: number): boolean {
    return (channel === 0 || channel === 1 || channel === 2 || channel === 3) && this.modeButtons.includes(note);
  }

  /**
   * Handle mode button press (radio button behavior)
   * Updates mode for the currently active deck (1-4) based on channel
   * Mode buttons are on deck control channels: 0, 1, 2, 3 (for decks 1, 2, 3, 4)
   * @returns {activeMode: number, channel: number, deck: number} if mode changed, null otherwise
   */
  handleModeButtonPress(channel: number, note: number, velocity: number): { activeMode: number; channel: number; deck: number } | null {
    // Only process on button press (velocity > 0)
    if (velocity === 0 || !this.isModeButton(channel, note)) {
      return null;
    }

    // Map channel to deck: 0→1, 1→2, 2→3, 3→4
    const targetDeck = channel + 1;

    // Set this as the active mode for the target deck
    this.padModes.set(targetDeck, note);
    console.log(`🎮 Deck ${targetDeck} mode: ${this.getModeName(note)}`);

    return {
      activeMode: note,
      channel: channel,
      deck: targetDeck
    };
  }

  /**
   * Get the active mode for a deck (1-4)
   */
  getActiveMode(deck: number): number {
    return this.padModes.get(deck) || 27; // Default to HOT CUE
  }

  /**
   * Get the active mode for a channel based on DECK button state
   * Channel 0 (left) → Deck 1 or 3
   * Channel 1 (right) → Deck 2 or 4
   */
  getActiveModeForChannel(channel: number): number {
    let targetDeck: number;
    if (channel === 0) {
      const deck3Active = this.isDeckButtonOn(2, 114);
      targetDeck = deck3Active ? 3 : 1;
    } else {
      const deck4Active = this.isDeckButtonOn(3, 114);
      targetDeck = deck4Active ? 4 : 2;
    }
    return this.getActiveMode(targetDeck);
  }

  /**
   * Get all mode button notes
   */
  getModeButtons(): number[] {
    return [...this.modeButtons];
  }

  /**
   * Get initial pad mode states for syncing to client (all 4 decks)
   */
  getPadModeStates(): { deck1: number; deck2: number; deck3: number; deck4: number } {
    return {
      deck1: this.getActiveMode(1),
      deck2: this.getActiveMode(2),
      deck3: this.getActiveMode(3),
      deck4: this.getActiveMode(4)
    };
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
   * Generate a unique key for a button
   */
  private getButtonKey(channel: number, note: number): string {
    return `${channel}:${note}`;
  }

  /**
   * Check if a button is a SYNC button
   */
  isSyncButton(channel: number, note: number): boolean {
    return (channel === 0 || channel === 1) && note === 88;
  }

  /**
   * Toggle sync state for a deck
   */
  toggleSync(deck: number): boolean {
    const currentState = this.syncStates.get(deck) || false;
    this.syncStates.set(deck, !currentState);
    console.log(`🔄 Deck ${deck} SYNC: ${!currentState ? 'ON' : 'OFF'}`);
    return !currentState;
  }

  /**
   * Check if a deck is synced
   */
  isSynced(deck: number): boolean {
    return this.syncStates.get(deck) || false;
  }
}
