/**
 * FingT — Finger Training Core Engine
 * Unified training system for all modes.
 * Pure vanilla JS, no frameworks.
 */

(function(global) {
  'use strict';

  // ---------- GLOBAL STATE ----------
  const FingT = {
    // Configuration set by page
    config: {
      mode: 'home',
      keyCount: 4,
      soundType: null,        // 'piano', 'flute', or null
      predefined: null,       // { jingle: [...], happy: [...] }
      enableTimingVisual: false
    },

    // Core state
    state: {
      status: 'idle',         // idle, editing, running, success, failure
      sequence: [],           // array of key indices (0-based)
      currentStep: 0,
      timerInterval: null,
      timerSeconds: 0,
      timerRunning: false,
      keyMappings: {},        // { 0: '1', 1: '2', ... }
      isSequenceLocked: false,
      soundPlayers: {
        piano: null,
        flute: null
      },
      // For rhythm timing visual
      timingInterval: null,
      timingProgress: 0
    },

    // DOM elements cache
    dom: {},

    // ---------- INITIALIZATION (called by each page) ----------
    init: function(configOverride) {
      // Merge config
      Object.assign(this.config, configOverride);
      
      // Load key mappings from localStorage or set defaults
      this.loadKeyMappings();
      
      // Cache DOM elements
      this.cacheDOM();
      
      // Build keypad UI based on keyCount and mappings
      this.renderKeypad();
      
      // Attach global event listeners
      this.attachEvents();
      
      // Setup sound if needed
      if (this.config.soundType) {
        this.initSounds();
      }
      
      // If rhythm mode, setup predefined sequence loader
      if (this.config.mode === 'rhythm') {
        this.setupRhythmMode();
      }
      
      // Update UI to reflect idle state
      this.updateUIForState('idle');
      this.renderSequenceDisplay();
      
      console.log(`FingT initialized in ${this.config.mode} mode`);
    },

    // For settings page (separate init)
    initSettings: function() {
      this.loadKeyMappings();
      this.cacheDOM();
      this.renderSettingsPage();
    },

    // ---------- KEY MAPPINGS (localStorage) ----------
    loadKeyMappings: function() {
      const stored = localStorage.getItem('fingt_keymap');
      const defaultKeys = ['1','2','3','4','5','6','7','8','9','0'];
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Ensure we have at least keyCount mappings
          for (let i = 0; i < this.config.keyCount; i++) {
            if (!parsed[i]) parsed[i] = defaultKeys[i] || (i+1).toString();
          }
          this.state.keyMappings = parsed;
        } catch (e) {
          this.setDefaultMappings();
        }
      } else {
        this.setDefaultMappings();
      }
      
      // Save defaults if not exist
      localStorage.setItem('fingt_keymap', JSON.stringify(this.state.keyMappings));
    },
    
    setDefaultMappings: function() {
      const defaultKeys = ['1','2','3','4','5','6','7','8','9','0'];
      this.state.keyMappings = {};
      for (let i = 0; i < this.config.keyCount; i++) {
        this.state.keyMappings[i] = defaultKeys[i] || (i+1).toString();
      }
    },

    saveKeyMappings: function(newMappings) {
      this.state.keyMappings = { ...this.state.keyMappings, ...newMappings };
      localStorage.setItem('fingt_keymap', JSON.stringify(this.state.keyMappings));
      // Re-render keypad hints if on training page
      if (this.dom.keypadContainer) {
        this.renderKeypad();
      }
    },

    // ---------- DOM CACHING ----------
    cacheDOM: function() {
      this.dom = {
        keypadContainer: document.getElementById('keypadContainer'),
        sequenceDisplay: document.getElementById('sequenceDisplay'),
        startBtn: document.getElementById('startBtn'),
        resetBtn: document.getElementById('resetBtn'),
        clearSeqBtn: document.getElementById('clearSeqBtn'),
        removeLastBtn: document.getElementById('removeLastBtn'),
        timerDisplay: document.getElementById('timerDisplay'),
        progressBar: document.getElementById('progressBar'),
        stateMessage: document.getElementById('stateMessage'),
        popupModal: document.getElementById('popupModal'),
        popupMessage: document.getElementById('popupMessage'),
        popupCloseBtn: document.getElementById('popupCloseBtn'),
        // Rhythm specific
        songSelect: document.getElementById('songSelect'),
        loadSongBtn: document.getElementById('loadSongBtn'),
        timingBar: document.getElementById('timingBar'),
        timingNote: document.getElementById('timingNote'),
        // Settings
        mappingsList: document.getElementById('mappingsList'),
        saveMappingsBtn: document.getElementById('saveMappingsBtn'),
        resetDefaultsBtn: document.getElementById('resetDefaultsBtn'),
        settingsMessage: document.getElementById('settingsMessage')
      };
    },

    // ---------- RENDER KEYPAD ----------
    renderKeypad: function() {
      if (!this.dom.keypadContainer) return;
      
      const container = this.dom.keypadContainer;
      container.innerHTML = '';
      
      for (let i = 0; i < this.config.keyCount; i++) {
        const keyBtn = document.createElement('button');
        keyBtn.className = 'key-btn';
        keyBtn.dataset.keyIndex = i;
        keyBtn.textContent = i + 1;
        
        const hintSpan = document.createElement('span');
        hintSpan.className = 'key-mapping-hint';
        hintSpan.textContent = `[${this.state.keyMappings[i] || '?'}]`;
        keyBtn.appendChild(hintSpan);
        
        keyBtn.addEventListener('click', (e) => this.handleKeyClick(e));
        container.appendChild(keyBtn);
      }
    },

    // ---------- EVENT LISTENERS ----------
    attachEvents: function() {
      // Control buttons
      if (this.dom.startBtn) {
        this.dom.startBtn.addEventListener('click', () => this.startTraining());
      }
      if (this.dom.resetBtn) {
        this.dom.resetBtn.addEventListener('click', () => this.resetTraining());
      }
      if (this.dom.clearSeqBtn) {
        this.dom.clearSeqBtn.addEventListener('click', () => this.clearSequence());
      }
      if (this.dom.removeLastBtn) {
        this.dom.removeLastBtn.addEventListener('click', () => this.removeLastFromSequence());
      }
      
      // Keyboard listener
      window.addEventListener('keydown', (e) => this.handleKeyDown(e));
      
      // Modal close
      if (this.dom.popupCloseBtn) {
        this.dom.popupCloseBtn.addEventListener('click', () => this.hidePopup());
      }
      
      // Rhythm mode events
      if (this.config.mode === 'rhythm' && this.dom.loadSongBtn) {
        this.dom.loadSongBtn.addEventListener('click', () => this.loadPredefinedSequence());
      }
      
      // Settings page events are attached in renderSettingsPage
    },

    // ---------- SEQUENCE MANAGEMENT ----------
    addToSequence: function(keyIndex) {
      if (this.state.isSequenceLocked) {
        this.showMessage('Sequence locked. Reset to edit.', 'warning');
        return;
      }
      if (this.state.status !== 'editing' && this.state.status !== 'idle') {
        return;
      }
      
      this.state.sequence.push(keyIndex);
      this.renderSequenceDisplay();
      this.state.status = 'editing';
      this.updateUIForState('editing');
    },

    removeLastFromSequence: function() {
      if (this.state.isSequenceLocked) return;
      this.state.sequence.pop();
      this.renderSequenceDisplay();
      if (this.state.sequence.length === 0) {
        this.state.status = 'idle';
        this.updateUIForState('idle');
      }
    },

    clearSequence: function() {
      if (this.state.isSequenceLocked) return;
      this.state.sequence = [];
      this.state.status = 'idle';
      this.renderSequenceDisplay();
      this.updateUIForState('idle');
    },

    renderSequenceDisplay: function() {
      if (!this.dom.sequenceDisplay) return;
      const display = this.dom.sequenceDisplay;
      
      if (this.state.sequence.length === 0) {
        display.innerHTML = '<span class="empty-sequence">Click keys to build sequence</span>';
        return;
      }
      
      display.innerHTML = '';
      this.state.sequence.forEach((keyIdx, i) => {
        const chip = document.createElement('span');
        chip.className = 'sequence-chip';
        chip.textContent = keyIdx + 1;
        display.appendChild(chip);
      });
    },

    // ---------- TRAINING STATE MACHINE ----------
    startTraining: function() {
      // Auto-reset if training just completed (success/failure)
      // This allows starting next session directly without manual reset
      if (this.state.status === 'success' || this.state.status === 'failure') {
        this.resetTraining();
      }
      
      if (this.state.sequence.length === 0) {
        this.showPopup('⚠️ Build a sequence first!', 'warning');
        return;
      }
      
      // Lock sequence and disable editing UI
      this.state.isSequenceLocked = true;
      this.state.status = 'running';
      this.state.currentStep = 0;
      this.state.timerSeconds = 0;
      this.updateUIForState('running');
      
      // Disable editing buttons
      this.setEditingEnabled(false);
      
      // Timer will start on first key press, but we can also start on Start button click (choose: start immediately)
      // According to spec: "Start on first valid key press OR Start button"
      this.startTimer();
      
      // Update progress bar
      this.updateProgress();
      
      // If rhythm mode, start visual timing
      if (this.config.enableTimingVisual) {
        this.startTimingVisual();
      }
    },

    resetTraining: function() {
      // Stop timer
      this.stopTimer();
      this.stopTimingVisual();
      
      // Reset state
      this.state.status = this.state.sequence.length > 0 ? 'editing' : 'idle';
      this.state.currentStep = 0;
      this.state.isSequenceLocked = false;
      this.state.timerSeconds = 0;
      this.updateTimerDisplay();
      
      // Enable editing
      this.setEditingEnabled(true);
      
      // Clear any glow
      this.clearGlow();
      
      this.updateUIForState(this.state.status);
      this.updateProgress();
    },

    completeTraining: function(success) {
      this.stopTimer();
      this.stopTimingVisual();
      
      if (success) {
        this.state.status = 'success';
        this.triggerSuccessGlow();
        const timeStr = this.formatTime(this.state.timerSeconds);
        this.showPopup(`✅ Completed! Time: ${timeStr}`, 'success');
      } else {
        this.state.status = 'failure';
        this.triggerFailureGlow();
        this.showPopup('❌ Wrong Key!', 'failure');
      }
      
      this.state.isSequenceLocked = true;
      this.setEditingEnabled(false);
      this.updateUIForState(this.state.status);
    },

    // ---------- INPUT HANDLING ----------
    handleKeyDown: function(e) {
      // Prevent default if it's a mapped key to avoid typing in inputs
      const key = e.key.length === 1 ? e.key : e.key.toLowerCase();
      
      // Find which key index this corresponds to
      let keyIndex = -1;
      for (let i = 0; i < this.config.keyCount; i++) {
        if (this.state.keyMappings[i]?.toLowerCase() === key.toLowerCase()) {
          keyIndex = i;
          break;
        }
      }
      
      if (keyIndex === -1) return; // Not a mapped key
      
      e.preventDefault(); // Prevent page scrolling or typing
      
      // If training not running and not editing? We'll allow adding to sequence only when not locked
      if (this.state.status === 'idle' || this.state.status === 'editing') {
        if (!this.state.isSequenceLocked) {
          this.addToSequence(keyIndex);
          this.playSoundForKey(keyIndex);
        }
        return;
      }
      
      if (this.state.status !== 'running') return;
      
      // Training is running: validate step
      const expectedKey = this.state.sequence[this.state.currentStep];
      
      // Play sound on key press even during validation? Yes for feedback.
      this.playSoundForKey(keyIndex);
      
      if (keyIndex === expectedKey) {
        // Correct key
        this.state.currentStep++;
        this.updateProgress();
        
        // If rhythm visual, advance timing indicator
        if (this.config.enableTimingVisual) {
          this.advanceTimingStep();
        }
        
        // Check if sequence completed
        if (this.state.currentStep >= this.state.sequence.length) {
          this.completeTraining(true);
        }
      } else {
        // Wrong key -> immediate failure
        this.completeTraining(false);
      }
    },

    handleKeyClick: function(e) {
      const btn = e.currentTarget;
      const keyIndex = parseInt(btn.dataset.keyIndex, 10);
      
      // Simulate key press
      const mappedKey = this.state.keyMappings[keyIndex];
      if (mappedKey) {
        // Create a synthetic event to reuse logic
        const fakeEvent = { key: mappedKey, preventDefault: () => {} };
        this.handleKeyDown(fakeEvent);
      }
    },

    // ---------- TIMER ----------
    startTimer: function() {
      if (this.state.timerRunning) return;
      this.state.timerRunning = true;
      this.state.timerInterval = setInterval(() => {
        this.state.timerSeconds += 0.1;
        this.updateTimerDisplay();
      }, 100);
    },

    stopTimer: function() {
      if (this.state.timerInterval) {
        clearInterval(this.state.timerInterval);
        this.state.timerInterval = null;
        this.state.timerRunning = false;
      }
    },

    updateTimerDisplay: function() {
      if (this.dom.timerDisplay) {
        this.dom.timerDisplay.textContent = this.formatTime(this.state.timerSeconds);
      }
    },

    formatTime: function(sec) {
      return sec.toFixed(1) + ' s';
    },

    // ---------- PROGRESS BAR ----------
    updateProgress: function() {
      if (!this.dom.progressBar) return;
      const total = this.state.sequence.length;
      if (total === 0) {
        this.dom.progressBar.style.width = '0%';
        return;
      }
      const percent = (this.state.currentStep / total) * 100;
      this.dom.progressBar.style.width = percent + '%';
    },

    // ---------- UI STATE MANAGEMENT ----------
    updateUIForState: function(status) {
      if (this.dom.stateMessage) {
        const messages = {
          'idle': 'Build a sequence',
          'editing': 'Editing sequence',
          'running': 'Training in progress...',
          'success': 'Great job!',
          'failure': 'Try again'
        };
        this.dom.stateMessage.textContent = messages[status] || '';
      }
      
      // Enable/disable start button based on state
      if (this.dom.startBtn) {
        this.dom.startBtn.disabled = (status === 'running' || status === 'success' || status === 'failure');
      }
    },

    setEditingEnabled: function(enabled) {
      const btns = document.querySelectorAll('.key-btn');
      btns.forEach(btn => {
        // Always keep keys at full brightness and clickable
        btn.classList.remove('disabled');
        btn.disabled = false;
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.style.filter = 'none';
      });
      
      // Also disable sequence action buttons only during editing
      if (this.dom.clearSeqBtn) this.dom.clearSeqBtn.disabled = !enabled;
      if (this.dom.removeLastBtn) this.dom.removeLastBtn.disabled = !enabled;
    },

    // ---------- VISUAL EFFECTS ----------
    triggerSuccessGlow: function() {
      document.body.classList.add('glow-success');
      setTimeout(() => document.body.classList.remove('glow-success'), 1200);
    },

    triggerFailureGlow: function() {
      document.body.classList.add('glow-failure');
      setTimeout(() => document.body.classList.remove('glow-failure'), 400);
    },

    clearGlow: function() {
      document.body.classList.remove('glow-success', 'glow-failure');
    },

    showPopup: function(message, type = 'info') {
      if (!this.dom.popupModal || !this.dom.popupMessage) return;
      
      // Get the modal card element
      const modalCard = this.dom.popupModal.querySelector('.modal-card');
      if (modalCard) {
        // Remove previous type classes
        modalCard.classList.remove('success', 'failure', 'info');
        // Add new type class
        if (type === 'success' || type === 'failure') {
          modalCard.classList.add(type);
        }
      }
      
      this.dom.popupMessage.textContent = message;
      this.dom.popupModal.style.display = 'flex';
    },

    hidePopup: function() {
      if (this.dom.popupModal) {
        this.dom.popupModal.style.display = 'none';
      }
    },

    showMessage: function(msg, type) {
      if (this.dom.stateMessage) {
        this.dom.stateMessage.textContent = msg;
      }
    },

    // ---------- SOUND GENERATION (Web Audio API) ----------
    initSounds: function() {
      // We'll create simple oscillators for piano/flute feel
      // Piano: quick decay; Flute: smoother
      // For simplicity, we'll use a single AudioContext and play notes on demand.
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    },

    playSoundForKey: function(keyIndex) {
      if (!this.config.soundType) return;
      if (!this.audioContext) this.initSounds();
      
      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      const now = this.audioContext.currentTime;
      const freq = 261.63 + keyIndex * 50; // C4 + offset
      
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = this.config.soundType === 'piano' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      
      // Envelope
      if (this.config.soundType === 'piano') {
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      } else { // flute
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      }
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.start();
      osc.stop(now + (this.config.soundType === 'piano' ? 0.6 : 1.0));
    },

    // ---------- RHYTHM MODE SPECIFIC ----------
    setupRhythmMode: function() {
      // Load default song on page load (Jingle Bells)
      if (this.config.predefined) {
        // Preload Jingle Bells into sequence after a tiny delay to ensure DOM ready
        setTimeout(() => {
          if (this.dom.songSelect) {
            this.loadPredefinedSequence('jingle');
          }
        }, 10);
      }
    },

    loadPredefinedSequence: function(songKey) {
      if (!songKey && this.dom.songSelect) {
        songKey = this.dom.songSelect.value;
      }
      if (!this.config.predefined || !this.config.predefined[songKey]) return;
      
      const seq = this.config.predefined[songKey];
      if (!this.state.isSequenceLocked) {
        this.state.sequence = [...seq];
        this.renderSequenceDisplay();
        this.state.status = 'editing';
        this.updateUIForState('editing');
      }
    },

    startTimingVisual: function() {
      this.state.timingProgress = 0;
      this.updateTimingBar(0);
      // We'll update timing bar based on expected step durations? For simplicity, we'll just pulse.
      // Not fully implemented per spec but we can add a simple animation.
      this.state.timingInterval = setInterval(() => {
        // Just a simple loop resetting to 0 when >100
        this.state.timingProgress = (this.state.timingProgress + 2) % 100;
        this.updateTimingBar(this.state.timingProgress);
      }, 100);
    },

    stopTimingVisual: function() {
      if (this.state.timingInterval) {
        clearInterval(this.state.timingInterval);
        this.state.timingInterval = null;
      }
      this.updateTimingBar(0);
    },

    advanceTimingStep: function() {
      // On correct key, we could reset pulse
      this.state.timingProgress = 0;
      this.updateTimingBar(0);
    },

    updateTimingBar: function(percent) {
      if (this.dom.timingBar) {
        this.dom.timingBar.style.width = percent + '%';
      }
    },

    // ---------- SETTINGS PAGE RENDERING ----------
    renderSettingsPage: function() {
      if (!this.dom.mappingsList) return;
      
      const container = this.dom.mappingsList;
      container.innerHTML = '';
      
      // Use a larger keyCount (max 10) for settings to allow mapping all possible keys
      const maxKeys = 10;
      for (let i = 0; i < maxKeys; i++) {
        const row = document.createElement('div');
        row.className = 'mapping-row';
        
        const label = document.createElement('span');
        label.className = 'mapping-label';
        label.textContent = `Key ${i+1}`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'mapping-input';
        input.maxLength = 1;
        input.dataset.keyIndex = i;
        input.value = this.state.keyMappings[i] || (i+1).toString();
        
        // Listen for key press to capture
        input.addEventListener('keydown', (e) => {
          if (e.key.length === 1) {
            e.preventDefault();
            input.value = e.key;
          }
        });
        
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
      }
      
      // Attach settings actions
      if (this.dom.saveMappingsBtn) {
        this.dom.saveMappingsBtn.addEventListener('click', () => {
          const inputs = document.querySelectorAll('.mapping-input');
          const newMappings = {};
          inputs.forEach(input => {
            const idx = input.dataset.keyIndex;
            const val = input.value.trim();
            if (val) newMappings[idx] = val;
          });
          this.saveKeyMappings(newMappings);
          if (this.dom.settingsMessage) {
            this.dom.settingsMessage.textContent = '✅ Mappings saved!';
            setTimeout(() => this.dom.settingsMessage.textContent = '', 2000);
          }
        });
      }
      
      if (this.dom.resetDefaultsBtn) {
        this.dom.resetDefaultsBtn.addEventListener('click', () => {
          this.setDefaultMappings();
          localStorage.setItem('fingt_keymap', JSON.stringify(this.state.keyMappings));
          // Update input fields
          const inputs = document.querySelectorAll('.mapping-input');
          inputs.forEach(input => {
            const idx = input.dataset.keyIndex;
            input.value = this.state.keyMappings[idx] || (parseInt(idx)+1).toString();
          });
          if (this.dom.settingsMessage) {
            this.dom.settingsMessage.textContent = '↻ Defaults restored';
          }
        });
      }
    }
  };

  // Expose to global
  global.FingT = FingT;

})(window);