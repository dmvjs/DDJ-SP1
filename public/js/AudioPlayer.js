/**
 * AudioPlayer
 *
 * Handles Web Audio API playback for Kwyjibo songs
 * Each deck (0-3) can play one audio file at a time
 */

export class AudioPlayer {
  constructor() {
    // Create Web Audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create gain nodes for each deck
    this.deckGains = new Map(); // key: deck (0-3), value: GainNode
    for (let i = 0; i < 4; i++) {
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.audioContext.destination);
      gainNode.gain.value = 1.0; // Default full volume
      this.deckGains.set(i, gainNode);
    }

    // Track currently playing sources for each deck
    this.activeSources = new Map(); // key: deck (0-3), value: AudioBufferSourceNode

    // Track current song and section for each deck (for auto-transitions)
    this.deckSongs = new Map(); // key: deck, value: song object
    this.deckSections = new Map(); // key: deck, value: 'lead' or 'body'
    this.deckPlaybackStarts = new Map(); // key: deck, value: { contextTime, sectionStart }

    // Roll state tracking
    this.rollStates = new Map(); // key: deck, value: { active, rollStartTime, savedTime, savedSection, savedSong, sectionStartTime }

    // Reverse state tracking (for CENSOR button)
    this.reverseStates = new Map(); // key: deck, value: { active, reverseStartTime, savedPosition, savedSection, savedSong }

    // Cache loaded audio buffers
    this.audioCache = new Map(); // key: file path, value: AudioBuffer

    // Master clock for sync: tracks playback position for each tempo
    // key: tempo (84/94/102), value: { section, startBeat, startTime, bpm }
    this.masterClocks = new Map();

    // Resume audio context on any user interaction
    this.setupAudioUnlock();
  }

  /**
   * Setup audio context unlock on user interaction
   */
  setupAudioUnlock() {
    const unlock = async () => {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔊 Audio context unlocked!');
      }
      // Remove listeners after first unlock
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };

    // Listen for any user interaction
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);

    // Auto-resume when tab/window regains focus
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed (tab focused)');
      }
    });

    // Also resume on window focus
    window.addEventListener('focus', async () => {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed (window focused)');
      }
    });
  }

  /**
   * Load an audio file and return AudioBuffer
   */
  async loadAudio(filePath) {
    // Check cache first
    if (this.audioCache.has(filePath)) {
      console.log(`⚡ Using cached: ${filePath.split('/').pop()}`);
      return this.audioCache.get(filePath);
    }

    console.log(`📥 Loading: ${filePath.split('/').pop()}...`);
    const loadStart = Date.now();

    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Cache the buffer
      this.audioCache.set(filePath, audioBuffer);

      const loadTime = Date.now() - loadStart;
      console.log(`✓ Loaded in ${loadTime}ms: ${filePath.split('/').pop()}`);

      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Play a song's lead or body section with automatic transitions
   * LEAD (16 beats) → BODY (64 beats) → LEAD → BODY → ...
   * @param {Object} song - Song object with id, bpm, etc
   * @param {number} deck - Deck number (0-3)
   * @param {string} section - 'lead' or 'body'
   * @param {number} bodyPosition - For body: offset in beats (0.5 = eighth note, 1.0 = snare, 16 = 25%, etc)
   */
  async play(song, deck, section, bodyPosition = 0) {
    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return;
      }
    }

    // Stop any currently playing audio on this deck
    this.stop(deck);

    // Store song and section for this deck (for auto-transitions)
    this.deckSongs.set(deck, song);
    this.deckSections.set(deck, section);

    // Format song ID as 8-digit zero-padded string
    const songId = String(song.id).padStart(8, '0');
    const filePath = `/music/${songId}-${section}.wav`;

    console.log(`🎵 Playing: ${section.toUpperCase()} on Deck ${deck + 1}`);

    try {
      // Load the audio file
      const audioBuffer = await this.loadAudio(filePath);

      // Calculate section timing based on BPM
      const beatsPerSecond = song.bpm / 60;
      const sectionBeats = section === 'lead' ? 16 : 64;
      const sectionDuration = sectionBeats / beatsPerSecond;

      // Calculate start position for any section
      // bodyPosition is now in beats (e.g., 0.5 = half beat, 1.0 = first snare, 16 = 25%)
      let startTime = 0;
      if (bodyPosition > 0) {
        startTime = bodyPosition / beatsPerSecond;
        const percentage = ((bodyPosition / sectionBeats) * 100).toFixed(1);
        console.log(`   Starting ${section} at beat ${bodyPosition} (${percentage}%, ${startTime.toFixed(2)}s)`);
      }

      // Calculate duration to play (from start position to end of section)
      const playDuration = sectionDuration - startTime;

      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to deck's gain node (for volume control)
      const gainNode = this.deckGains.get(deck);
      source.connect(gainNode);

      // Store the source so we can stop it later
      this.activeSources.set(deck, source);

      // Start playback with exact duration (no looping, will auto-transition)
      source.start(0, startTime, playDuration);

      // Track when this playback started for roll resume calculations
      this.deckPlaybackStarts.set(deck, {
        contextTime: this.audioContext.currentTime,
        sectionStart: startTime
      });

      console.log(`▶️  Playing ${sectionBeats} beats (${playDuration.toFixed(2)}s) at ${song.bpm} BPM`);

      // When this section ends, automatically play the next section
      source.onended = () => {
        if (this.activeSources.get(deck) === source) {
          this.activeSources.delete(deck);

          // Automatically transition to the other section
          const currentSong = this.deckSongs.get(deck);
          const currentSection = this.deckSections.get(deck);

          if (currentSong && currentSection) {
            // Toggle between lead and body (always at 0% for body)
            const nextSection = currentSection === 'lead' ? 'body' : 'lead';
            console.log(`🔄 Deck ${deck + 1}: ${currentSection.toUpperCase()} → ${nextSection.toUpperCase()}`);

            // Play the next section (don't await, let it happen asynchronously)
            this.play(currentSong, deck, nextSection, 0);
          }
        }
      };

    } catch (error) {
      console.error(`Failed to play ${filePath}:`, error);
    }
  }

  /**
   * Stop playback on a specific deck
   */
  stop(deck) {
    const source = this.activeSources.get(deck);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (error) {
        // Source might already be stopped
      }
      this.activeSources.delete(deck);

      // Clear tracking info to stop auto-transitions
      this.deckSongs.delete(deck);
      this.deckSections.delete(deck);

      console.log(`⏹️  Stopped Deck ${deck + 1}`);
    }
  }

  /**
   * Fade out and stop playback on a specific deck
   * @param {number} deck - Deck number (0-3)
   * @param {number} fadeTime - Fade duration in seconds (default 0.2s)
   */
  fadeOut(deck, fadeTime = 0.2) {
    const source = this.activeSources.get(deck);
    if (!source) {
      console.log(`⚠️  No audio playing on Deck ${deck + 1}`);
      return;
    }

    const gainNode = this.deckGains.get(deck);
    if (!gainNode) return;

    try {
      const now = this.audioContext.currentTime;

      // Ramp gain from current value down to 0
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + fadeTime);

      console.log(`🔇 Deck ${deck + 1} FADE OUT (${fadeTime * 1000}ms)`);

      // Stop completely after fade and restore gain
      setTimeout(() => {
        this.stop(deck);
        gainNode.gain.value = 1.0; // Restore full volume for next play
      }, fadeTime * 1000 + 50);
    } catch (error) {
      console.error(`Failed to fade out Deck ${deck + 1}:`, error);
    }
  }

  /**
   * Spindown effect (vinyl stop / brake)
   * Slows playback to a stop like stopping a record by hand
   */
  spindown(deck) {
    const source = this.activeSources.get(deck);
    if (!source || !source.playbackRate) {
      console.log(`⚠️  No audio playing on Deck ${deck + 1}`);
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      const spindownTime = 0.8; // 0.8 seconds to stop

      // Ramp playback rate from 1.0 down to 0.01 (nearly stopped)
      source.playbackRate.cancelScheduledValues(now);
      source.playbackRate.setValueAtTime(source.playbackRate.value, now);
      source.playbackRate.exponentialRampToValueAtTime(0.01, now + spindownTime);

      console.log(`🛑 Deck ${deck + 1} SPINDOWN`);

      // Stop completely after spindown
      setTimeout(() => {
        this.stop(deck);
      }, spindownTime * 1000 + 100);
    } catch (error) {
      console.error(`Failed to spindown Deck ${deck + 1}:`, error);
    }
  }

  /**
   * Stop all playback
   */
  stopAll() {
    for (const deck of this.activeSources.keys()) {
      this.stop(deck);
    }
  }

  /**
   * Set volume for a specific deck
   * @param {number} deck - Deck number (0-3)
   * @param {number} volume - Volume level (0-127 MIDI range)
   */
  setVolume(deck, volume) {
    const gainNode = this.deckGains.get(deck);
    if (gainNode) {
      // Convert MIDI 0-127 to gain 0.0-1.0
      const gain = volume / 127;
      gainNode.gain.value = gain;
      console.log(`🔊 Deck ${deck + 1} volume: ${Math.round(gain * 100)}%`);
    }
  }

  /**
   * Set master volume for all decks
   * @param {number} volume - Volume level (0-127 MIDI range)
   */
  setMasterVolume(volume) {
    for (let deck = 0; deck < 4; deck++) {
      this.setVolume(deck, volume);
    }
  }

  /**
   * Preload a song's audio files (lead and body)
   * Call this when a track is loaded to make playback instant
   * @param {Object} song - Song object with id
   */
  async preloadSong(song) {
    const songId = String(song.id).padStart(8, '0');
    const leadPath = `/music/${songId}-lead.wav`;
    const bodyPath = `/music/${songId}-body.wav`;

    console.log(`⏳ Preloading: ${song.title}...`);

    try {
      // Load both files in parallel
      await Promise.all([
        this.loadAudio(leadPath),
        this.loadAudio(bodyPath)
      ]);
      console.log(`✓ Preloaded: ${song.title}`);
    } catch (error) {
      console.error(`Failed to preload: ${song.title}`, error);
    }
  }

  /**
   * Start roll effect - loop a small section of the current song
   * @param {number} deck - Deck number (0-3)
   * @param {number} rollBeats - Length of roll in beats (2, 1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625)
   * @param {Object} song - Song object to roll (if not currently playing)
   */
  async startRoll(deck, rollBeats, song) {
    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed for roll');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return;
      }
    }

    // Use provided song or currently playing song
    const rollSong = song || this.deckSongs.get(deck);
    const section = this.deckSections.get(deck) || 'body'; // Default to body if nothing playing

    if (!rollSong) {
      console.log(`⚠️  No song loaded on Deck ${deck + 1}`);
      return;
    }

    console.log(`🔁 Starting roll: ${rollSong.title}, section=${section}, beats=${rollBeats}`);

    // Calculate current position in the song
    const playbackStart = this.deckPlaybackStarts.get(deck);
    let currentPosition = 0;
    if (playbackStart) {
      const elapsedTime = this.audioContext.currentTime - playbackStart.contextTime;
      currentPosition = playbackStart.sectionStart + elapsedTime;
      console.log(`🔁 Current position: ${currentPosition.toFixed(2)}s into ${section}`);
    }

    // Stop current playback and save state
    const currentSource = this.activeSources.get(deck);
    if (currentSource) {
      try {
        currentSource.stop();
        currentSource.disconnect();
      } catch (e) {
        // Already stopped
      }
    }

    // Mark as rolling - save where we were
    this.rollStates.set(deck, {
      active: true,
      rollStartTime: this.audioContext.currentTime,
      savedPosition: currentPosition,
      savedSection: section,
      savedSong: rollSong
    });

    const songId = String(rollSong.id).padStart(8, '0');
    const filePath = `/music/${songId}-${section}.wav`;

    try {
      const audioBuffer = await this.loadAudio(filePath);
      const beatsPerSecond = rollSong.bpm / 60;
      const rollDuration = rollBeats / beatsPerSecond;

      console.log(`🔁 Roll settings: BPM=${rollSong.bpm}, duration=${(rollDuration * 1000).toFixed(1)}ms, from position ${currentPosition.toFixed(2)}s`);

      // Create looping source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      // Loop from current position to current position + roll duration
      source.loopStart = currentPosition;
      source.loopEnd = Math.min(currentPosition + rollDuration, audioBuffer.duration);

      const gainNode = this.deckGains.get(deck);
      source.connect(gainNode);

      this.activeSources.set(deck, source);

      // Start playing from current position
      source.start(0, currentPosition);

      console.log(`🔁 Deck ${deck + 1} ROLL ACTIVE: ${rollBeats} beats (${(rollDuration * 1000).toFixed(0)}ms loop)`);
    } catch (error) {
      console.error(`Failed to start roll on Deck ${deck + 1}:`, error);
      this.rollStates.delete(deck);
    }
  }

  /**
   * Stop roll effect and resume normal playback
   * @param {number} deck - Deck number (0-3)
   */
  stopRoll(deck) {
    const rollState = this.rollStates.get(deck);
    if (!rollState || !rollState.active) {
      console.log(`⚠️  No active roll on Deck ${deck + 1}`);
      return;
    }

    // Calculate how long the roll was active
    const rollDuration = this.audioContext.currentTime - rollState.rollStartTime;
    console.log(`🔁 Deck ${deck + 1} ROLL END after ${(rollDuration * 1000).toFixed(0)}ms`);

    // Calculate where playback should resume (as if the button was never pressed)
    const { savedSong, savedSection, savedPosition } = rollState;
    const resumePosition = savedPosition + rollDuration;

    // Get section duration
    const beatsPerSecond = savedSong.bpm / 60;
    const sectionBeats = savedSection === 'lead' ? 16 : 64;
    const sectionDuration = sectionBeats / beatsPerSecond;

    console.log(`🔁 Resume calculation: was at ${savedPosition.toFixed(2)}s, roll lasted ${rollDuration.toFixed(2)}s, resuming at ${resumePosition.toFixed(2)}s`);

    // Stop the rolling source
    const source = this.activeSources.get(deck);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.activeSources.delete(deck);
    }

    // Clear roll state
    this.rollStates.delete(deck);

    // Check if we've gone past the end of the section
    if (resumePosition >= sectionDuration) {
      // We've passed the end - transition to next section
      const nextSection = savedSection === 'lead' ? 'body' : 'lead';
      const overflow = resumePosition - sectionDuration;
      console.log(`▶️  Section ended during roll, transitioning to ${nextSection} at ${overflow.toFixed(2)}s`);
      this.play(savedSong, deck, nextSection, overflow * beatsPerSecond);
    } else {
      // Resume from calculated position within current section
      const resumeBeats = resumePosition * beatsPerSecond;
      console.log(`▶️  Resuming: ${savedSong.title} (${savedSection}) at beat ${resumeBeats.toFixed(2)}`);
      this.play(savedSong, deck, savedSection, resumeBeats);
    }
  }

  /**
   * Start reverse playback (CENSOR effect)
   * @param {number} deck - Deck number (0-3)
   */
  async startReverse(deck) {
    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed for reverse');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return;
      }
    }

    const song = this.deckSongs.get(deck);
    const section = this.deckSections.get(deck) || 'body';

    if (!song) {
      console.log(`⚠️  No song loaded on Deck ${deck + 1}`);
      return;
    }

    console.log(`⏪ Starting reverse: ${song.title}, section=${section}`);

    // Calculate current position in the song
    const playbackStart = this.deckPlaybackStarts.get(deck);
    let currentPosition = 0;
    if (playbackStart) {
      const elapsedTime = this.audioContext.currentTime - playbackStart.contextTime;
      currentPosition = playbackStart.sectionStart + elapsedTime;
      console.log(`⏪ Current position: ${currentPosition.toFixed(2)}s into ${section}`);
    }

    // Stop current playback and save state
    const currentSource = this.activeSources.get(deck);
    if (currentSource) {
      try {
        currentSource.stop();
        currentSource.disconnect();
      } catch (e) {
        // Already stopped
      }
    }

    // Mark as reversing - save where we were
    this.reverseStates.set(deck, {
      active: true,
      reverseStartTime: this.audioContext.currentTime,
      savedPosition: currentPosition,
      savedSection: section,
      savedSong: song
    });

    const songId = String(song.id).padStart(8, '0');
    const filePath = `/music/${songId}-${section}.wav`;

    try {
      const audioBuffer = await this.loadAudio(filePath);

      // Create a reversed audio buffer
      const reversedBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      // Copy and reverse each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        for (let i = 0; i < audioBuffer.length; i++) {
          reversedData[i] = originalData[audioBuffer.length - 1 - i];
        }
      }

      // Create source with reversed buffer
      const source = this.audioContext.createBufferSource();
      source.buffer = reversedBuffer;

      const gainNode = this.deckGains.get(deck);
      source.connect(gainNode);

      this.activeSources.set(deck, source);

      // Play reversed buffer from the mirrored position
      // If we're at 5s in a 10s buffer, we play from 5s in the reversed buffer
      // which will sound like playing backwards from the 5s mark
      const bufferDuration = audioBuffer.duration;
      const reversedOffset = bufferDuration - currentPosition;

      source.start(0, reversedOffset);

      console.log(`⏪ Deck ${deck + 1} REVERSE ACTIVE from ${currentPosition.toFixed(2)}s (reversed offset: ${reversedOffset.toFixed(2)}s)`);
    } catch (error) {
      console.error(`Failed to start reverse on Deck ${deck + 1}:`, error);
      this.reverseStates.delete(deck);
    }
  }

  /**
   * Get current playback position and state for a deck
   * @param {number} deck - Deck number (0-3)
   * @returns {Object|null} - { position: seconds, section: 'lead'|'body', song: Object } or null
   */
  getCurrentPlaybackState(deck) {
    const song = this.deckSongs.get(deck);
    const section = this.deckSections.get(deck);
    const playbackStart = this.deckPlaybackStarts.get(deck);

    if (!song || !section || !playbackStart) {
      return null;
    }

    const elapsedTime = this.audioContext.currentTime - playbackStart.contextTime;
    const currentPosition = playbackStart.sectionStart + elapsedTime;

    return {
      position: currentPosition,
      section: section,
      song: song
    };
  }

  /**
   * Sync one deck to another's playback position
   * @param {number} sourceDeck - Deck to sync from (0-3)
   * @param {number} targetDeck - Deck to sync to (0-3)
   */
  syncDeckTo(sourceDeck, targetDeck) {
    // Get source deck's current state
    const sourceState = this.getCurrentPlaybackState(sourceDeck);
    if (!sourceState) {
      console.log(`⚠️  No playback on Deck ${sourceDeck + 1} to sync from`);
      return;
    }

    // Get target deck's loaded song
    const targetSong = this.deckSongs.get(targetDeck);
    if (!targetSong) {
      console.log(`⚠️  No song loaded on Deck ${targetDeck + 1} to sync`);
      return;
    }

    // Check if tempos match
    if (sourceState.song.bpm !== targetSong.bpm) {
      console.log(`⚠️  Tempo mismatch: Deck ${sourceDeck + 1} (${sourceState.song.bpm} BPM) vs Deck ${targetDeck + 1} (${targetSong.bpm} BPM)`);
      return;
    }

    // Sync target deck to source deck's position and section
    const beatsPerSecond = targetSong.bpm / 60;
    const positionInBeats = sourceState.position * beatsPerSecond;

    console.log(`🔗 SYNC: Deck ${targetDeck + 1} → Deck ${sourceDeck + 1} at ${sourceState.section} ${positionInBeats.toFixed(2)} beats`);
    this.play(targetSong, targetDeck, sourceState.section, positionInBeats);
  }

  /**
   * Stop reverse playback and resume normal playback
   * @param {number} deck - Deck number (0-3)
   */
  stopReverse(deck) {
    const reverseState = this.reverseStates.get(deck);
    if (!reverseState || !reverseState.active) {
      console.log(`⚠️  No active reverse on Deck ${deck + 1}`);
      return;
    }

    // Calculate how long the reverse was active
    const reverseDuration = this.audioContext.currentTime - reverseState.reverseStartTime;
    console.log(`⏪ Deck ${deck + 1} REVERSE END after ${(reverseDuration * 1000).toFixed(0)}ms`);

    // Calculate where playback should resume (as if button was never pressed)
    const { savedSong, savedSection, savedPosition } = reverseState;
    const resumePosition = savedPosition + reverseDuration;

    // Get section duration
    const beatsPerSecond = savedSong.bpm / 60;
    const sectionBeats = savedSection === 'lead' ? 16 : 64;
    const sectionDuration = sectionBeats / beatsPerSecond;

    console.log(`⏪ Resume calculation: was at ${savedPosition.toFixed(2)}s, reverse lasted ${reverseDuration.toFixed(2)}s, resuming at ${resumePosition.toFixed(2)}s`);

    // Stop the reverse source
    const source = this.activeSources.get(deck);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.activeSources.delete(deck);
    }

    // Clear reverse state
    this.reverseStates.delete(deck);

    // Check if we've gone past the end of the section
    if (resumePosition >= sectionDuration) {
      // We've passed the end - transition to next section
      const nextSection = savedSection === 'lead' ? 'body' : 'lead';
      const overflow = resumePosition - sectionDuration;
      console.log(`▶️  Section ended during reverse, transitioning to ${nextSection} at ${overflow.toFixed(2)}s`);
      this.play(savedSong, deck, nextSection, overflow * beatsPerSecond);
    } else if (resumePosition < 0) {
      // We've gone past the beginning - stay at the start
      console.log(`▶️  Resuming: ${savedSong.title} (${savedSection}) at beginning`);
      this.play(savedSong, deck, savedSection, 0);
    } else {
      // Resume from calculated position within current section
      const resumeBeats = resumePosition * beatsPerSecond;
      console.log(`▶️  Resuming: ${savedSong.title} (${savedSection}) at beat ${resumeBeats.toFixed(2)}`);
      this.play(savedSong, deck, savedSection, resumeBeats);
    }
  }
}
