/**
 * ControlStateManager
 *
 * Manages control state for the DDJ-SP1, including:
 * - Shift button detection
 * - Button lock/unlock state (for FX buttons)
 * - LED state management
 * - Note mapping for shifted controls
 */
export class ControlStateManager {
    constructor() {
        this.shiftPressed = false;
        this.lockedButtons = new Map();
        // Map shifted note numbers to their unshifted equivalents
        this.shiftedNoteMap = new Map([
            [99, 71], // FX1
            [100, 72], // FX2
            [101, 73], // FX3
            [102, 67], // TAP (or 74 for FX ASSIGN)
        ]);
        // Performance pad shift mapping → pad mode buttons (HOT CUE, ROLL, SLICER, SAMPLER)
        this.shiftedPadMap = new Map([
            // Deck A - shift + top row pads → mode buttons
            ['0:105', '0:27'], // HOT CUE
            ['0:107', '0:30'], // ROLL
            ['0:109', '0:32'], // SLICER
            ['0:111', '0:34'], // SAMPLER
            // Deck B - shift + top row pads → mode buttons
            ['1:105', '1:27'], // HOT CUE
            ['1:107', '1:30'], // ROLL
            ['1:109', '1:32'], // SLICER
            ['1:111', '1:34'], // SAMPLER
        ]);
    }
    /**
     * Update shift button state
     */
    setShiftPressed(pressed) {
        this.shiftPressed = pressed;
    }
    /**
     * Get current shift button state
     */
    isShiftPressed() {
        return this.shiftPressed;
    }
    /**
     * Check if a note is a shifted FX button
     */
    isShiftedFXNote(note, channel) {
        return this.shiftedNoteMap.has(note) && (channel === 4 || channel === 5);
    }
    /**
     * Check if a note is a shifted performance pad
     */
    isShiftedPad(note, channel) {
        const key = `${channel}:${note}`;
        return this.shiftedPadMap.has(key);
    }
    /**
     * Get the original pad channel and note for a shifted pad
     */
    getOriginalPad(note, channel) {
        const key = `${channel}:${note}`;
        const mapped = this.shiftedPadMap.get(key);
        if (!mapped)
            return null;
        const [ch, n] = mapped.split(':').map(Number);
        return { channel: ch, note: n };
    }
    /**
     * Get the original (unshifted) note for a shifted note
     */
    getOriginalNote(note) {
        return this.shiftedNoteMap.get(note) ?? note;
    }
    /**
     * Check if a button is an FX button (channels 4 & 5, specific notes)
     */
    isFXButton(channel, note) {
        return (channel === 4 || channel === 5) &&
            (note === 71 || note === 72 || note === 73 || note === 74 || note === 67);
    }
    /**
     * Check if a button is a performance pad (channels 7 & 8)
     */
    isPerformancePad(channel) {
        return channel === 7 || channel === 8;
    }
    /**
     * Toggle lock state for a button
     * @returns new lock state
     */
    toggleButtonLock(channel, note) {
        const key = this.getButtonKey(channel, note);
        const wasLocked = this.lockedButtons.get(key) || false;
        const nowLocked = !wasLocked;
        this.lockedButtons.set(key, nowLocked);
        return nowLocked;
    }
    /**
     * Check if a button is locked
     */
    isButtonLocked(channel, note) {
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
    getLEDVelocity(channel, note, velocity) {
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
    handleShiftedFXPress(channel, note, velocity) {
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
    clearAllLocks() {
        this.lockedButtons.clear();
    }
    /**
     * Get all currently locked buttons
     */
    getLockedButtons() {
        const result = [];
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
    getButtonKey(channel, note) {
        return `${channel}:${note}`;
    }
}
