/**
 * Event emitted when a button is pressed or released
 */
export interface ButtonEvent {
  type: 'button';
  button: number;
  pressed: boolean;
  channel: number;
  mainDeckAssigned?: boolean; // For FX ASSIGN: true if assigned to Deck 1/2
  altDeckAssigned?: boolean;  // For FX ASSIGN: true if assigned to Deck 3/4
}

/**
 * Event emitted when a knob or slider is adjusted
 */
export interface KnobEvent {
  type: 'knob';
  knob: number;
  value: number;
  channel: number;
}

/**
 * Union type of all controller events
 */
export type ControllerEvent = ButtonEvent | KnobEvent;
