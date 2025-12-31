/**
 * SongList Component
 *
 * Displays filtered song list from Kwyjibo library
 * E-reader style with zebra striping
 */

export class SongList {
  constructor(containerId, activeTracks) {
    this.container = document.getElementById(containerId);
    this.activeTracks = activeTracks;
    this.songs = [];
    this.currentTempo = 94;
    this.referenceKey = null; // Key of track loaded on Deck 1
    this.selectedIndex = 0;
    this.scrollPosition = 0;
    this.lastScrollTime = 0;
    this.scrollDebounceMs = 0; // No debounce - raw dial speed
    this.isExpanded = false;
    this.loadSongs();
    this.startExpandCheck();
  }

  /**
   * Load songs from songdata
   */
  async loadSongs() {
    try {
      const module = await import('../songdata.js');
      this.songs = module.songdata || [];
      this.render();
    } catch (error) {
      console.error('Failed to load songs:', error);
    }
  }

  /**
   * Update tempo filter
   */
  setTempo(tempo) {
    this.currentTempo = tempo;
    this.selectedIndex = 0;
    this.render();
  }

  /**
   * Set reference key (from Deck 1's loaded track)
   */
  setReferenceKey(key) {
    this.referenceKey = key;
    this.selectedIndex = 0;
    this.render();
  }

  /**
   * Calculate key distance for harmonic mixing
   * Returns 0 for same key, 1 for adjacent keys, 2 for next, etc.
   */
  getKeyDistance(key1, key2) {
    if (key1 === key2) return 0;

    // Calculate circular distance (keys wrap around: 12 -> 1)
    const forward = (key2 - key1 + 12) % 12;
    const backward = (key1 - key2 + 12) % 12;
    return Math.min(forward, backward);
  }

  /**
   * Get filtered and sorted songs for current tempo
   */
  getFilteredSongs() {
    const filtered = this.songs.filter(song => song.bpm === this.currentTempo);

    if (this.referenceKey) {
      // Sort by harmonic mixing: same key first, then adjacent keys, etc.
      return filtered.sort((a, b) => {
        const distA = this.getKeyDistance(this.referenceKey, a.key);
        const distB = this.getKeyDistance(this.referenceKey, b.key);

        if (distA !== distB) {
          return distA - distB; // Closer keys first
        }

        // Same key distance: sort by artist then title
        const artistCompare = a.artist.localeCompare(b.artist);
        if (artistCompare !== 0) return artistCompare;
        return a.title.localeCompare(b.title);
      });
    } else {
      // No reference key: sort by key order (1-12), then artist, then title
      return filtered.sort((a, b) => {
        if (a.key !== b.key) {
          return a.key - b.key;
        }
        const artistCompare = a.artist.localeCompare(b.artist);
        if (artistCompare !== 0) return artistCompare;
        return a.title.localeCompare(b.title);
      });
    }
  }

  /**
   * Start checking for expand/collapse based on scroll activity
   */
  startExpandCheck() {
    setInterval(() => {
      const now = Date.now();
      const timeSinceScroll = now - this.lastScrollTime;

      if (timeSinceScroll < 3000 && !this.isExpanded) {
        // Scrolling recently - expand
        this.expand();
      } else if (timeSinceScroll >= 3000 && this.isExpanded) {
        // No scrolling for 3 seconds - collapse
        this.collapse();
      }
    }, 100); // Check every 100ms
  }

  /**
   * Expand the song list to fill the screen
   */
  expand() {
    this.isExpanded = true;
    this.container.classList.add('expanded');

    // Center the selected item after a brief delay to allow layout to settle
    setTimeout(() => {
      const selectedItem = this.container.querySelector('.song-item.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }, 50);
  }

  /**
   * Collapse the song list to normal size
   */
  collapse() {
    this.isExpanded = false;
    this.container.classList.remove('expanded');
  }

  /**
   * Scroll the list (called by center knob)
   * @param value - encoder value (1-63 = down, 65-127 = up)
   * @param multiplier - scroll speed multiplier (default 1, 10 for SHIFT)
   */
  scroll(value, multiplier = 1) {
    const filteredSongs = this.getFilteredSongs();
    if (filteredSongs.length === 0) return;

    // Debounce: ignore rapid scroll events
    const now = Date.now();
    if (now - this.lastScrollTime < this.scrollDebounceMs) {
      return;
    }
    this.lastScrollTime = now;

    // Infinite encoder: 1-63 = down, 65-127 = up
    // Apply multiplier for fast scroll (e.g., 10x when SHIFT is held)
    const scrollAmount = 1 * multiplier;
    if (value < 64) {
      this.selectedIndex = Math.min(this.selectedIndex + scrollAmount, filteredSongs.length - 1);
    } else if (value > 64) {
      this.selectedIndex = Math.max(this.selectedIndex - scrollAmount, 0);
    }

    this.render();
    this.scrollToSelected();
  }

  /**
   * Scroll the selected item into view
   */
  scrollToSelected() {
    const wrapper = this.container.querySelector('.song-list-wrapper');
    const selectedItem = this.container.querySelector('.song-item.selected');
    if (wrapper && selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  /**
   * Get currently selected song
   */
  getSelectedSong() {
    const filteredSongs = this.getFilteredSongs();
    return filteredSongs[this.selectedIndex] || null;
  }

  /**
   * Render the song list in 4-column grid layout
   */
  render() {
    if (!this.container) return;

    const filteredSongs = this.getFilteredSongs();

    this.container.innerHTML = `
      <div class="song-list-container">
        <div class="song-list-header">
          <span class="tempo-display">${this.currentTempo} BPM</span>
          <span class="song-count">${filteredSongs.length} songs</span>
        </div>
        <div class="song-list-wrapper">
          <div class="song-list-grid">
            ${filteredSongs.map((song, index) => `
              <div class="song-item ${index === this.selectedIndex ? 'selected' : ''}" data-id="${song.id}">
                <span class="song-key key-${song.key}">${song.key}</span>
                <span class="song-info">
                  <span class="song-artist">${this.escapeHtml(song.artist)}</span>
                  <span class="song-separator"> - </span>
                  <span class="song-title">${this.escapeHtml(song.title)}</span>
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
