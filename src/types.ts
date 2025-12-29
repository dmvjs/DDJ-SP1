export interface ButtonEvent {
  type: 'button';
  button: number;
  pressed: boolean;
  channel: number;
}

export interface KnobEvent {
  type: 'knob';
  knob: number;
  value: number;
  channel: number;
}

export type ControllerEvent = ButtonEvent | KnobEvent;

export interface MidiNoteMessage {
  channel: number;
  note: number;
  velocity: number;
  _type: 'noteon' | 'noteoff';
}

export interface MidiCCMessage {
  channel: number;
  controller: number;
  value: number;
  _type: 'cc';
}
