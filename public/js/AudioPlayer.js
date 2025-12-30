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

      // Calculate start position for body sections
      // bodyPosition is now in beats (e.g., 0.5 = half beat, 1.0 = first snare, 16 = 25%)
      let startTime = 0;
      if (section === 'body' && bodyPosition > 0) {
        startTime = bodyPosition / beatsPerSecond;
        const percentage = ((bodyPosition / sectionBeats) * 100).toFixed(1);
        console.log(`   Starting body at beat ${bodyPosition} (${percentage}%, ${startTime.toFixed(2)}s)`);
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
}
