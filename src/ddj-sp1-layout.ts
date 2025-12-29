/**
 * DDJ-SP1 Hardware Layout
 *
 * Complete mapping of all Pioneer DDJ-SP1 controls including:
 * - 8 performance pads per deck (16 total)
 * - 4 FX knobs per deck (3 effects + 1 parameter)
 * - 3 rows of control buttons per deck
 * - Center browser and utility controls
 * - 1 sampler volume slider
 *
 * Channel Mapping:
 * - Ch 0/1: Deck A/B control buttons
 * - Ch 4/5: Deck A/B FX controls
 * - Ch 6: Center section
 * - Ch 7/8: Deck A/B performance pads
 */

export interface ControlDefinition {
  id: string;
  type: 'button' | 'knob' | 'slider';
  channel: number;
  number: number;
  label: string;
  section: 'deck-a' | 'deck-b' | 'center' | 'deck-a-top' | 'deck-b-top' | 'deck-a-buttons' | 'deck-b-buttons' | 'center-row-4' | 'center-row-2' | 'center-browser' | 'center-view-area' | 'center-load' | 'center-shift' | 'center-volume';
}

export const DDJ_SP1_LAYOUT: ControlDefinition[] = [
  // Deck A (Left) - Performance Pads
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `button-${i}-ch7`,
    type: 'button' as const,
    channel: 7,
    number: i,
    label: '',
    section: 'deck-a' as const
  })),

  // Deck B (Right) - Performance Pads (Channel 8)
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `button-${i}-ch8`,
    type: 'button' as const,
    channel: 8,
    number: i,
    label: '',
    section: 'deck-b' as const
  })),

  // Deck A - Top Row Dials (Channel 4)
  { id: 'knob-2-ch4', type: 'knob', channel: 4, number: 2, label: 'FX 1', section: 'deck-a-top' },
  { id: 'knob-4-ch4', type: 'knob', channel: 4, number: 4, label: 'FX 2', section: 'deck-a-top' },
  { id: 'knob-6-ch4', type: 'knob', channel: 4, number: 6, label: 'FX 3', section: 'deck-a-top' },
  { id: 'knob-0-ch4', type: 'knob', channel: 4, number: 0, label: 'BEATS', section: 'deck-a-top' },
  { id: 'button-67-ch4', type: 'button', channel: 4, number: 67, label: 'TAP', section: 'deck-a-top' },

  // Deck B - Top Row Dials (Channel 5)
  { id: 'knob-2-ch5', type: 'knob', channel: 5, number: 2, label: 'FX 1', section: 'deck-b-top' },
  { id: 'knob-4-ch5', type: 'knob', channel: 5, number: 4, label: 'FX 2', section: 'deck-b-top' },
  { id: 'knob-6-ch5', type: 'knob', channel: 5, number: 6, label: 'FX 3', section: 'deck-b-top' },
  { id: 'knob-0-ch5', type: 'knob', channel: 5, number: 0, label: 'BEATS', section: 'deck-b-top' },
  { id: 'button-67-ch5', type: 'button', channel: 5, number: 67, label: 'TAP', section: 'deck-b-top' },

  // Deck A - Top Button Row (FX ON buttons + FX ASSIGN)
  { id: 'button-71-ch4', type: 'button', channel: 4, number: 71, label: 'FX 1', section: 'deck-a-buttons' },
  { id: 'button-72-ch4', type: 'button', channel: 4, number: 72, label: 'FX 2', section: 'deck-a-buttons' },
  { id: 'button-73-ch4', type: 'button', channel: 4, number: 73, label: 'FX 3', section: 'deck-a-buttons' },
  { id: 'button-74-ch4', type: 'button', channel: 4, number: 74, label: 'FX ASSIGN', section: 'deck-a-buttons' },

  // Deck A - Middle Button Row
  { id: 'button-88-ch0', type: 'button', channel: 0, number: 88, label: 'SYNC', section: 'deck-a-buttons' },
  { id: 'button-64-ch0', type: 'button', channel: 0, number: 64, label: 'SLIP', section: 'deck-a-buttons' },
  { id: 'button-21-ch0', type: 'button', channel: 0, number: 21, label: 'CENSOR', section: 'deck-a-buttons' },
  { id: 'knob-23-ch0', type: 'knob', channel: 0, number: 23, label: 'AUTO LOOP', section: 'deck-a-buttons' },
  { id: 'button-13-ch0', type: 'button', channel: 0, number: 13, label: 'PARAMETER', section: 'deck-a-buttons' },

  // Deck A - Bottom Button Row (Pad Modes)
  { id: 'button-27-ch0', type: 'button', channel: 0, number: 27, label: 'HOT CUE', section: 'deck-a-buttons' },
  { id: 'button-30-ch0', type: 'button', channel: 0, number: 30, label: 'ROLL', section: 'deck-a-buttons' },
  { id: 'button-32-ch0', type: 'button', channel: 0, number: 32, label: 'SLICER', section: 'deck-a-buttons' },
  { id: 'button-34-ch0', type: 'button', channel: 0, number: 34, label: 'SAMPLER', section: 'deck-a-buttons' },

  // Deck B - Top Button Row (FX ON buttons + FX ASSIGN)
  { id: 'button-71-ch5', type: 'button', channel: 5, number: 71, label: 'FX 1', section: 'deck-b-buttons' },
  { id: 'button-72-ch5', type: 'button', channel: 5, number: 72, label: 'FX 2', section: 'deck-b-buttons' },
  { id: 'button-73-ch5', type: 'button', channel: 5, number: 73, label: 'FX 3', section: 'deck-b-buttons' },
  { id: 'button-74-ch5', type: 'button', channel: 5, number: 74, label: 'FX ASSIGN', section: 'deck-b-buttons' },

  // Deck B - Middle Button Row
  { id: 'button-88-ch1', type: 'button', channel: 1, number: 88, label: 'SYNC', section: 'deck-b-buttons' },
  { id: 'button-64-ch1', type: 'button', channel: 1, number: 64, label: 'SLIP', section: 'deck-b-buttons' },
  { id: 'button-21-ch1', type: 'button', channel: 1, number: 21, label: 'CENSOR', section: 'deck-b-buttons' },
  { id: 'knob-23-ch1', type: 'knob', channel: 1, number: 23, label: 'AUTO LOOP', section: 'deck-b-buttons' },
  { id: 'button-13-ch1', type: 'button', channel: 1, number: 13, label: 'PARAMETER', section: 'deck-b-buttons' },

  // Deck B - Bottom Button Row (Pad Modes)
  { id: 'button-27-ch1', type: 'button', channel: 1, number: 27, label: 'HOT CUE', section: 'deck-b-buttons' },
  { id: 'button-30-ch1', type: 'button', channel: 1, number: 30, label: 'ROLL', section: 'deck-b-buttons' },
  { id: 'button-32-ch1', type: 'button', channel: 1, number: 32, label: 'SLICER', section: 'deck-b-buttons' },
  { id: 'button-34-ch1', type: 'button', channel: 1, number: 34, label: 'SAMPLER', section: 'deck-b-buttons' },

  // Center Controls
  // Row 1 - Deck selection buttons (4 buttons) - FX ASSIGN + DECK buttons
  { id: 'button-76-ch6', type: 'button', channel: 6, number: 76, label: 'FX 1/2', section: 'center-row-4' },
  { id: 'button-80-ch6', type: 'button', channel: 6, number: 80, label: 'DECK', section: 'center-row-4' },
  { id: 'button-77-ch6', type: 'button', channel: 6, number: 77, label: 'FX 3/4', section: 'center-row-4' },
  { id: 'button-81-ch6', type: 'button', channel: 6, number: 81, label: 'DECK', section: 'center-row-4' },

  // Row 2 - DECK buttons for deck 1/3 and 2/4 switching
  { id: 'button-114-ch2', type: 'button', channel: 2, number: 114, label: 'DECK 1/3', section: 'center-row-2' },
  { id: 'button-114-ch3', type: 'button', channel: 3, number: 114, label: 'DECK 2/4', section: 'center-row-2' },

  // Row 3 - Browser controls
  { id: 'knob-64-ch6', type: 'knob', channel: 6, number: 64, label: 'BROWSER', section: 'center-browser' },
  { id: 'button-65-ch6', type: 'button', channel: 6, number: 65, label: 'LOAD PREPARE', section: 'center-browser' },

  // Row 4 - Back/Utility and View/Area (2 buttons)
  { id: 'button-101-ch6', type: 'button', channel: 6, number: 101, label: 'BACK/UTILITY', section: 'center-view-area' },
  { id: 'button-103-ch6', type: 'button', channel: 6, number: 103, label: 'VIEW', section: 'center-view-area' },

  // Row 5 - Load buttons (2 buttons)
  { id: 'button-70-ch6', type: 'button', channel: 6, number: 70, label: 'LOAD A', section: 'center-load' },
  { id: 'button-71-ch6', type: 'button', channel: 6, number: 71, label: 'LOAD B', section: 'center-load' },

  // Row 6 - Shift (1 button)
  { id: 'button-64-ch6', type: 'button', channel: 6, number: 64, label: 'SHIFT', section: 'center-shift' },

  // Row 7 - Sampler Volume (vertical slider)
  { id: 'knob-3-ch6', type: 'slider', channel: 6, number: 3, label: 'SAMPLER VOLUME', section: 'center-volume' },
];
