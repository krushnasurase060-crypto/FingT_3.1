/**
 * Piano Extended Module
 * Extends FingT with advanced piano features (multiple octaves, realistic sound, keyboard mapping)
 * Preserves existing FingT design and color scheme
 */

(function(global) {
  'use strict';

  // ======================== PIANO CONFIGURATION ========================
  const PIANO_CONFIG = {
    NOTE_FREQUENCIES: {
      "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63,
      "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00,
      "A#4": 466.16, "B4": 493.88, "C5": 523.25, "C#5": 554.37, "D5": 587.33,
      "D#5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99,
      "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77
    },

    // SIMPLIFIED INTUITIVE MAPPING
    // Octave 1 (C4-B4): Bottom row Z-X-C-V-B-N-M + Numbers 1-5 for sharps
    // Octave 2 (C5-B5): Top row Q-W-E-R-T-Y-U + Numbers 6-0 for sharps
    DEFAULT_PIANO_MAPPING: {
      // === OCTAVE 1 (C4-B4) ===
      // White keys - Bottom row: Z X C V B N M
      "KeyZ": "C4",    // C4
      "KeyX": "D4",    // D4
      "KeyC": "E4",    // E4
      "KeyV": "F4",    // F4
      "KeyB": "G4",    // G4
      "KeyN": "A4",    // A4
      "KeyM": "B4",    // B4
      
      // Black/Sharp keys - Numbers 1-5
      "Digit1": "C#4",  // C# in octave 1
      "Digit2": "D#4",  // D# in octave 1
      "Digit3": "F#4",  // F# in octave 1
      "Digit4": "G#4",  // G# in octave 1
      "Digit5": "A#4",  // A# in octave 1
      
      // === OCTAVE 2 (C5-B5) ===
      // White keys - Top row: Q W E R T Y U
      "KeyQ": "C5",    // C5
      "KeyW": "D5",    // D5
      "KeyE": "E5",    // E5
      "KeyR": "F5",    // F5
      "KeyT": "G5",    // G5
      "KeyY": "A5",    // A5
      "KeyU": "B5",    // B5
      
      // Black/Sharp keys - Numbers 6-0
      "Digit6": "C#5",  // C# in octave 2
      "Digit7": "D#5",  // D# in octave 2
      "Digit8": "F#5",  // F# in octave 2
      "Digit9": "G#5",  // G# in octave 2
      "Digit0": "A#5"   // A# in octave 2
    },

    AUDIO_CONFIG: {
      MASTER_GAIN: 0.4,
      REVERB_GAIN: 0.25,
      REVERB_DURATION: 1.2,
      NOTE_DURATION: 1.2,
      FILTER_FREQ: 1800,
      FILTER_Q: 5
    }
  };

  // ======================== STATE MANAGEMENT ========================
  const PianoState = {
    audioCtx: null,
    masterGain: null,
    reverbNode: null,
    muteEnabled: false,
    pianoKeyMapping: {},
    configuringKey: null,
    sequenceLength: 0
  };

  // ======================== UTILITY FUNCTIONS ========================
  function getNoteLabel(noteId) {
    return noteId.replace(/[0-9]/g, '');
  }

  function showPianoToast(message) {
    const existingToast = document.querySelector('.piano-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'piano-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2500);
  }

  // ======================== AUDIO INITIALIZATION ========================
  async function initPianoAudio() {
    if (PianoState.audioCtx) return;

    try {
      PianoState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      PianoState.masterGain = PianoState.audioCtx.createGain();
      PianoState.masterGain.gain.value = PIANO_CONFIG.AUDIO_CONFIG.MASTER_GAIN;

      // Create reverb convolver
      const convolver = PianoState.audioCtx.createConvolver();
      const sampleRate = PianoState.audioCtx.sampleRate;
      const impulseLength = sampleRate * PIANO_CONFIG.AUDIO_CONFIG.REVERB_DURATION;
      const impulse = PianoState.audioCtx.createBuffer(2, impulseLength, sampleRate);

      // Generate impulse response
      for (let channel = 0; channel < 2; channel++) {
        const chanData = impulse.getChannelData(channel);
        for (let i = 0; i < impulseLength; i++) {
          chanData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.2));
        }
      }

      convolver.buffer = impulse;
      PianoState.reverbNode = PianoState.audioCtx.createGain();
      PianoState.reverbNode.gain.value = PIANO_CONFIG.AUDIO_CONFIG.REVERB_GAIN;

      PianoState.masterGain.connect(PianoState.reverbNode);
      PianoState.reverbNode.connect(convolver);
      convolver.connect(PianoState.audioCtx.destination);
      PianoState.masterGain.connect(PianoState.audioCtx.destination);
    } catch (error) {
      console.error("Piano audio init failed:", error);
      showPianoToast("Audio unavailable");
    }
  }

  // ======================== SOUND PLAYBACK ========================
  function playPianoNote(freq, duration = PIANO_CONFIG.AUDIO_CONFIG.NOTE_DURATION) {
    if (PianoState.muteEnabled || !PianoState.audioCtx) return;

    try {
      const now = PianoState.audioCtx.currentTime;
      const gainNode = PianoState.audioCtx.createGain();
      const osc1 = PianoState.audioCtx.createOscillator();
      const osc2 = PianoState.audioCtx.createOscillator();
      const filter = PianoState.audioCtx.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.value = PIANO_CONFIG.AUDIO_CONFIG.FILTER_FREQ;
      filter.Q.value = PIANO_CONFIG.AUDIO_CONFIG.FILTER_Q;

      osc1.type = "sawtooth";
      osc2.type = "triangle";
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 0.998;

      // ADSR envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.15);
      gainNode.gain.setValueAtTime(0.08, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(PianoState.masterGain);

      osc1.start();
      osc2.start();

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
        } catch (e) {
          // Already stopped
        }
      }, duration * 1000);
    } catch (error) {
      console.error("Piano note playback error:", error);
    }
  }

  function triggerPianoSound(noteId) {
    if (!PianoState.audioCtx) return;
    const freq = PIANO_CONFIG.NOTE_FREQUENCIES[noteId];
    if (freq) playPianoNote(freq, PIANO_CONFIG.AUDIO_CONFIG.NOTE_DURATION);
  }

  // ======================== PIANO KEYBOARD UI ========================
  function buildPianoKeyboard() {
    const wrapper = document.getElementById("pianoWrapper");
    if (!wrapper) return;

    wrapper.innerHTML = "";
    const whiteNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5"];
    const blackMap = {
      "C#4": "C4", "D#4": "D4", "F#4": "F4", "G#4": "G4", "A#4": "A4",
      "C#5": "C5", "D#5": "D5", "F#5": "F5", "G#5": "G5", "A#5": "A5"
    };

    // Create white keys
    whiteNotes.forEach(note => {
      const keyDiv = document.createElement("div");
      keyDiv.className = "piano-white-key";
      keyDiv.dataset.note = note;
      keyDiv.textContent = note.replace(/[0-9]/g, '');
      keyDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        onPianoKeyClick(note);
      });
      wrapper.appendChild(keyDiv);
    });

    // Create black keys
    const whiteElements = document.querySelectorAll(".piano-white-key");
    Object.entries(blackMap).forEach(([blackNote, whiteRef]) => {
      const refIdx = whiteNotes.indexOf(whiteRef);
      if (refIdx !== -1 && whiteElements[refIdx]) {
        const blackDiv = document.createElement("div");
        blackDiv.className = "piano-black-key";
        blackDiv.dataset.note = blackNote;
        blackDiv.textContent = "♯";
        blackDiv.style.left = `${whiteElements[refIdx].offsetLeft + whiteElements[refIdx].offsetWidth - 18}px`;
        blackDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          onPianoKeyClick(blackNote);
        });
        wrapper.appendChild(blackDiv);
      }
    });
  }

  // ======================== NOTE-TO-INDEX MAPPING ========================
  // Maps note names to consistent indices for FingT training
  const NOTE_INDEX_MAP = {
    "C4": 0, "C#4": 1, "D4": 2, "D#4": 3, "E4": 4,
    "F4": 5, "F#4": 6, "G4": 7, "G#4": 8, "A4": 9,
    "A#4": 10, "B4": 11, "C5": 12, "C#5": 13, "D5": 14,
    "D#5": 15, "E5": 16, "F5": 17, "F#5": 18, "G5": 19,
    "G#5": 20, "A5": 21, "A#5": 22, "B5": 23
  };

  function onPianoKeyClick(noteId) {
    triggerPianoSound(noteId);
    const keyIndex = NOTE_INDEX_MAP[noteId];
    
    // During training: validate input
    if (FingT.state.status === 'running') {
      handlePianoTrainingInput(keyIndex, noteId);
      return;
    }
    
    // During editing/idle: add to sequence
    const isLocked = FingT.state.isSequenceLocked;
    if (!isLocked && FingT.state.status !== 'running') {
      FingT.state.sequence.push(keyIndex);
      FingT.renderSequenceDisplay();
      FingT.state.status = 'editing';
      FingT.updateUIForState('editing');
      showPianoToast(`Added ${getNoteLabel(noteId)}`);
    } else if (isLocked) {
      showPianoToast("Sequence locked!");
    }
  }

  // Handle training input validation - mirrors FingT.handleKeyDown logic
  function handlePianoTrainingInput(keyIndex, noteId) {
    if (FingT.state.status !== 'running') return;
    
    const expectedKey = FingT.state.sequence[FingT.state.currentStep];
    
    if (keyIndex === expectedKey) {
      // Correct key pressed
      FingT.state.currentStep++;
      FingT.updateProgress();
      
      // Check if sequence completed
      if (FingT.state.currentStep >= FingT.state.sequence.length) {
        FingT.completeTraining(true);
      }
    } else {
      // Wrong key pressed - fail immediately
      FingT.completeTraining(false);
    }
  }

  // Convert note name to key index for FingT
  function getNoteToKeyIndex(noteId) {
    return NOTE_INDEX_MAP[noteId] || -1;
  }

  // ======================== KEYBOARD MAPPING ========================
  function loadPianoKeyMapping() {
    const stored = localStorage.getItem('fingt_pianomap');
    if (stored) {
      try {
        PianoState.pianoKeyMapping = JSON.parse(stored);
      } catch (e) {
        PianoState.pianoKeyMapping = { ...PIANO_CONFIG.DEFAULT_PIANO_MAPPING };
      }
    } else {
      PianoState.pianoKeyMapping = { ...PIANO_CONFIG.DEFAULT_PIANO_MAPPING };
    }
  }

  function savePianoKeyMapping() {
    localStorage.setItem('fingt_pianomap', JSON.stringify(PianoState.pianoKeyMapping));
  }

  function renderPianoMappingUI() {
    const container = document.getElementById("pianoMappingTable");
    if (!container) return;

    container.innerHTML = "";
    Object.entries(PianoState.pianoKeyMapping).forEach(([keyCode, note]) => {
      const card = document.createElement("div");
      card.className = "piano-mapping-card";
      card.innerHTML = `<strong>${keyCode.replace("Key", "")}</strong> → ${getNoteLabel(note)}`;
      container.appendChild(card);
    });
  }

  function renderPianoConfigButtons() {
    const container = document.getElementById("pianoConfigBtns");
    if (!container) return;

    container.innerHTML = "";
    const uniqueNotes = [...new Set(Object.values(PianoState.pianoKeyMapping))];
    uniqueNotes.sort();

    uniqueNotes.forEach(note => {
      const btn = document.createElement("button");
      btn.className = "piano-config-btn";
      btn.textContent = getNoteLabel(note);
      btn.dataset.configNote = note;
      btn.addEventListener("click", () => startPianoKeyConfiguration(note));
      container.appendChild(btn);
    });
  }

  function startPianoKeyConfiguration(note) {
    if (FingT.state.status === 'running') {
      showPianoToast("Cannot configure during exercise!");
      return;
    }
    PianoState.configuringKey = note;
    const btn = document.querySelector(`[data-config-note="${note}"]`);
    if (btn) {
      btn.style.border = '2px solid #ffff00';
      btn.style.animation = 'pulse 0.6s infinite';
    }
    showPianoToast(`Press any key for ${getNoteLabel(note)}...`);
  }

  function assignPianoKeyToNote(note, keyCode) {
    // Remove old mappings for this note
    for (let code in PianoState.pianoKeyMapping) {
      if (PianoState.pianoKeyMapping[code] === note) {
        delete PianoState.pianoKeyMapping[code];
      }
    }
    // Add new mapping
    PianoState.pianoKeyMapping[keyCode] = note;
    savePianoKeyMapping();

    // Reset button styles
    const buttons = document.querySelectorAll('[data-config-note]');
    buttons.forEach(btn => {
      btn.style.border = '';
      btn.style.animation = '';
    });

    renderPianoMappingUI();
    showPianoToast(`✅ ${getNoteLabel(note)} → ${keyCode.replace("Key", "")}`);
  }

  // ======================== KEYBOARD EVENT HANDLING ========================
  function handlePianoKeyDown(e) {
    if (!PianoState.audioCtx) initPianoAudio();

    const code = e.code;

    // If in configuration mode, capture the key
    if (PianoState.configuringKey !== null) {
      e.preventDefault();
      assignPianoKeyToNote(PianoState.configuringKey, code);
      PianoState.configuringKey = null;
      return;
    }

    // Normal key handling
    if (PianoState.pianoKeyMapping[code]) {
      e.preventDefault();
      const note = PianoState.pianoKeyMapping[code];
      const keyIndex = NOTE_INDEX_MAP[note];
      
      triggerPianoSound(note);

      // During training: validate input
      if (FingT.state.status === 'running') {
        handlePianoTrainingInput(keyIndex, note);
        return;
      }

      // During editing/idle: add to sequence
      if (FingT.state.status === 'idle' || FingT.state.status === 'editing') {
        if (!FingT.state.isSequenceLocked) {
          FingT.state.sequence.push(keyIndex);
          FingT.renderSequenceDisplay();
          FingT.state.status = 'editing';
          FingT.updateUIForState('editing');
        }
      }
    }
  }

  // ======================== PUBLIC API ========================
  global.PianoExtended = {
    init: async function() {
      await initPianoAudio();
      loadPianoKeyMapping();
      buildPianoKeyboard();
      renderPianoMappingUI();
      renderPianoConfigButtons();
      window.addEventListener("keydown", handlePianoKeyDown);
      document.body.addEventListener("click", () => {
        if (PianoState.audioCtx && PianoState.audioCtx.state === "suspended") {
          PianoState.audioCtx.resume();
        }
      });
    },

    getConfig: function() {
      return PIANO_CONFIG;
    },

    getState: function() {
      return PianoState;
    },

    toggleMute: function() {
      PianoState.muteEnabled = !PianoState.muteEnabled;
      return PianoState.muteEnabled;
    },

    resetPianoMapping: function() {
      PianoState.pianoKeyMapping = { ...PIANO_CONFIG.DEFAULT_PIANO_MAPPING };
      savePianoKeyMapping();
      renderPianoMappingUI();
      renderPianoConfigButtons();
      showPianoToast("✅ Piano mapping reset");
    }
  };

})(window);
