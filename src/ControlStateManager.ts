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

  // Map shifted note numbers to their unshifted equivalents
  private readonly shiftedNoteMap: Map<number, number> = new Map([
    [99, 71],   // FX1
    [100, 72],  // FX2
    [101, 73],  // FX3
    [102, 67],  // TAP (or 74 for FX ASSIGN)
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
   * Generate a unique key for a button
   */
  private getButtonKey(channel: number, note: number): string {
    return `${channel}:${note}`;
  }
}
