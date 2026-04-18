// ======================== CONSTANTS & CONFIGURATION ========================
const NOTE_FREQUENCIES = {
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63,
    "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00,
    "A#4": 466.16, "B4": 493.88, "C5": 523.25, "C#5": 554.37, "D5": 587.33,
    "D#5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99,
    "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77
};

const DEFAULT_KEY_MAPPING = {
    "KeyA": "C4", "KeyW": "C#4", "KeyS": "D4", "KeyE": "D#4", "KeyD": "E4",
    "KeyF": "F4", "KeyT": "F#4", "KeyG": "G4", "KeyY": "G#4", "KeyH": "A4",
    "KeyU": "A#4", "KeyJ": "B4", "KeyK": "C5", "KeyO": "C#5", "KeyL": "D5",
    "KeyP": "D#5", "KeySemicolon": "E5", "KeyZ": "F5", "KeyX": "F#5", "KeyC": "G5",
    "KeyV": "G#5", "KeyB": "A5", "KeyN": "A#5", "KeyM": "B5"
};

const CONFIG = {
    MAX_SEQUENCE_LENGTH: 40,
    NOTE_DURATION: 1.2,
    MASTER_GAIN: 0.4,
    REVERB_GAIN: 0.25,
    REVERB_DURATION: 1.2,
    FILTER_FREQ: 1800,
    FILTER_Q: 5,
    TOAST_DURATION: 2500
};

// ======================== AUDIO STATE ========================
let audioCtx = null;
let masterGain = null;
let reverbNode = null;
let muteEnabled = false;
let activeNotes = new Map();

// ======================== SEQUENCE STATE ========================
let sequence = [];
let locked = false;
let editModeActive = false;
let pendingEditIndex = null;
let exerciseActive = false;
let exerciseStepIndex = 0;
let exerciseTimerInterval = null;
let exerciseStartTime = 0;
let expectedNote = null;
let currentTimerSeconds = 0;

// ======================== KEY MAPPING STATE ========================
let keyMapping = { ...DEFAULT_KEY_MAPPING };

// ======================== UTILITY FUNCTIONS ========================
/**
 * Display a toast notification message
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether message is an error
 */
function showToast(message, isError = false) {
    try {
        const toastArea = document.getElementById("toastMsg");
        if (!toastArea) return;
        
        const toastDiv = document.createElement("div");
        toastDiv.className = "toast" + (isError ? " error" : "");
        toastDiv.innerText = message;
        if (isError) toastDiv.style.borderLeftColor = "#ff5e6e";
        toastArea.appendChild(toastDiv);
        setTimeout(() => toastDiv.remove(), CONFIG.TOAST_DURATION);
    } catch (e) {
        console.error("Toast error:", e);
    }
}

/**
 * Initialize Web Audio Context
 */
async function initAudio() {
    if (audioCtx) return;
    
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = CONFIG.MASTER_GAIN;
        
        // Create reverb convolver
        const convolver = audioCtx.createConvolver();
        const sampleRate = audioCtx.sampleRate;
        const impulseLength = sampleRate * CONFIG.REVERB_DURATION;
        const impulse = audioCtx.createBuffer(2, impulseLength, sampleRate);
        
        // Generate impulse response
        for (let channel = 0; channel < 2; channel++) {
            const chanData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
                chanData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.2));
            }
        }
        
        convolver.buffer = impulse;
        reverbNode = audioCtx.createGain();
        reverbNode.gain.value = CONFIG.REVERB_GAIN;
        
        masterGain.connect(reverbNode);
        reverbNode.connect(convolver);
        convolver.connect(audioCtx.destination);
        masterGain.connect(audioCtx.destination);
    } catch (error) {
        console.error("Audio initialization failed:", error);
        showToast("Audio unavailable", true);
    }
}

// ======================== AUDIO PLAYBACK ========================
/**
 * Play a realistic piano note with ADSR envelope
 * @param {number} freq - Frequency in Hz
 * @param {number} duration - Duration in seconds
 */
function playPianoNote(freq, duration = CONFIG.NOTE_DURATION) {
    if (muteEnabled || !audioCtx) return;
    
    try {
        const now = audioCtx.currentTime;
        const gainNode = audioCtx.createGain();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        
        filter.type = "lowpass";
        filter.frequency.value = CONFIG.FILTER_FREQ;
        filter.Q.value = CONFIG.FILTER_Q;
        
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
        gainNode.connect(masterGain);
        
        osc1.start();
        osc2.start();
        
        // Cleanup
        setTimeout(() => {
            try {
                osc1.stop();
                osc2.stop();
            } catch (e) {
                // Already stopped
            }
        }, duration * 1000);
    } catch (error) {
        console.error("playPianoNote error:", error);
    }
}

/**
 * Trigger sound for a note ID
 * @param {string} noteId - Note identifier (e.g., "C4")
 */
function triggerSound(noteId) {
    if (!audioCtx) return;
    const freq = NOTE_FREQUENCIES[noteId];
    if (freq) playPianoNote(freq, CONFIG.NOTE_DURATION);
}

// ======================== PIANO UI & KEYBOARD BUILDING ========================

function buildPiano() {
    const wrapper = document.getElementById("pianoWrapper");
    wrapper.innerHTML = "";
    const whiteNotes = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5","B5"];
    const blackMap = {
        "C#4": "C4", "D#4": "D4", "F#4": "F4", "G#4": "G4", "A#4": "A4",
        "C#5": "C5", "D#5": "D5", "F#5": "F5", "G#5": "G5", "A#5": "A5"
    };
    // white keys first
    whiteNotes.forEach(note => {
        const keyDiv = document.createElement("div");
        keyDiv.className = "white-key";
        keyDiv.setAttribute("data-note", note);
        keyDiv.innerText = note.replace("4","").replace("5","");
        keyDiv.addEventListener("click", (e) => { e.stopPropagation(); onPianoKeyPress(note); });
        wrapper.appendChild(keyDiv);
    });
    // black keys positioned absolute
    const whiteElements = document.querySelectorAll(".white-key");
    const blackKeysList = Object.keys(blackMap);
    blackKeysList.forEach(blackNote => {
        const relativeWhite = blackMap[blackNote];
        const idx = whiteNotes.indexOf(relativeWhite);
        if (idx !== -1 && whiteElements[idx]) {
            const blackDiv = document.createElement("div");
            blackDiv.className = "black-key";
            blackDiv.setAttribute("data-note", blackNote);
            blackDiv.innerText = blackNote.includes("#") ? "♯" : "♭";
            blackDiv.style.left = `${whiteElements[idx].offsetLeft + whiteElements[idx].offsetWidth - 18}px`;
            blackDiv.addEventListener("click", (e) => { e.stopPropagation(); onPianoKeyPress(blackNote); });
            wrapper.appendChild(blackDiv);
        }
    });
    window.addEventListener('resize', () => location.reload()); // crude reposition
}

function onPianoKeyPress(noteId) {
    triggerSound(noteId);
    if (exerciseActive) {
        handleExerciseInput(noteId);
    } else {
        if (!locked && !editModeActive) {
            addToSequence(noteId);
        } else if (editModeActive && pendingEditIndex !== null) {
            replaceStep(pendingEditIndex, noteId);
            pendingEditIndex = null;
            showToast(`Step edited → ${getNoteLabel(noteId)}`);
            renderSequence();
        } else if (locked && !editModeActive) {
            showToast("Sequence locked! Unlock to add notes.");
        }
    }
}

function getNoteLabel(noteId) { return noteId.replace(/[0-9]/g, ''); }

function addToSequence(noteId) {
    if (sequence.length >= 40) { showToast("Max 40 steps reached!", true); return; }
    sequence.push({ name: noteId, label: getNoteLabel(noteId) });
    renderSequence();
    showToast(`Added ${getNoteLabel(noteId)}`);
}

function replaceStep(index, newNote) {
    if (index >= 0 && index < sequence.length) {
        sequence[index] = { name: newNote, label: getNoteLabel(newNote) };
        renderSequence();
    }
}

function removeLast() { if(!locked && sequence.length) { sequence.pop(); renderSequence(); } else showToast("Locked, cannot remove"); }
function clearSeq() { if(!locked) { sequence = []; renderSequence(); } else showToast("Locked, cannot clear"); }

function renderSequence() {
    const container = document.getElementById("sequenceSteps");
    if (!sequence.length) { container.innerHTML = '<div class="empty-seq">✨ Click piano keys to add notes</div>'; return; }
    container.innerHTML = "";
    sequence.forEach((step, idx) => {
        const stepDiv = document.createElement("div");
        stepDiv.className = "step-item";
        stepDiv.innerHTML = `<span class="step-note">🎵 ${step.label}</span>
                             <button class="edit-step-btn" data-idx="${idx}">✏️</button>`;
        stepDiv.querySelector(".edit-step-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            if(locked) { showToast("Unlock to edit steps"); return; }
            editModeActive = true;
            pendingEditIndex = idx;
            showToast(`Click any piano key to replace step ${step.label}`);
        });
        container.appendChild(stepDiv);
    });
}

// Exercise logic
function startExercise() {
    if (sequence.length === 0) { showToast("Build a sequence first!", true); return; }
    if (exerciseActive) return;
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    exerciseActive = true;
    exerciseStepIndex = 0;
    currentTimerSeconds = 0;
    if (exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    exerciseStartTime = Date.now();
    exerciseTimerInterval = setInterval(() => {
        if (exerciseActive) {
            currentTimerSeconds = (Date.now() - exerciseStartTime) / 1000;
            document.getElementById("exerciseTimer").innerText = currentTimerSeconds.toFixed(2);
        }
    }, 100);
    nextExerciseStep();
}

function nextExerciseStep() {
    if (exerciseStepIndex >= sequence.length) {
        finishExercise(true);
        return;
    }
    expectedNote = sequence[exerciseStepIndex].name;
    highlightKey(expectedNote);
    showToast(`🎯 Play: ${getNoteLabel(expectedNote)}`);
}

function handleExerciseInput(playedNote) {
    if (!exerciseActive) return;
    if (playedNote === expectedNote) {
        removeKeyHighlight();
        exerciseStepIndex++;
        if (exerciseStepIndex < sequence.length) nextExerciseStep();
        else finishExercise(true);
    } else {
        finishExercise(false);
    }
}

// Apply background glow effect for feedback
function applyBackgroundGlow(isSuccess) {
    const body = document.body;
    const glowKeyframe = isSuccess ? 'greenGlow' : 'redGlow';
    
    // Temporarily add animation
    body.style.animation = `${glowKeyframe} 1.5s ease-in-out 1`;
    
    // Remove animation after it completes so it can be triggered again
    setTimeout(() => {
        body.style.animation = 'none';
    }, 1500);
}

function finishExercise(success) {
    if (!exerciseActive) return;
    exerciseActive = false;
    if (exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    removeKeyHighlight();
    if (success) {
        showToast(`✅ SUCCESS! Completed in ${currentTimerSeconds.toFixed(1)} sec`);
        document.getElementById("exerciseTimer").innerText = currentTimerSeconds.toFixed(2);
    } else {
        showToast(`❌ FAILED! Wrong note. Expected: ${getNoteLabel(expectedNote)}`, true);
    }
    applyBackgroundGlow(success);
    expectedNote = null;
}

function highlightKey(noteId) {
    removeKeyHighlight();
    const allKeys = [...document.querySelectorAll(".white-key, .black-key")];
    const target = allKeys.find(k => k.getAttribute("data-note") === noteId);
    if (target) target.classList.add("highlight-exercise");
}
function removeKeyHighlight() { document.querySelectorAll(".highlight-exercise").forEach(k => k.classList.remove("highlight-exercise")); }

// Keyboard event
function handleGlobalKey(e) {
    if (!audioCtx) initAudio();
    const code = e.code;
    if (keyMapping[code]) {
        e.preventDefault();
        const note = keyMapping[code];
        triggerSound(note);
        if (!exerciseActive && !locked && !editModeActive) addToSequence(note);
        else if (exerciseActive) handleExerciseInput(note);
        else if (editModeActive && pendingEditIndex !== null) { replaceStep(pendingEditIndex, note); pendingEditIndex = null; renderSequence(); }
        else if (locked) showToast("Sequence locked");
    }
}

// Build mapping UI
function renderMappingUI() {
    const container = document.getElementById("mappingTable");
    container.innerHTML = "";
    for (let [keyCode, note] of Object.entries(keyMapping)) {
        const card = document.createElement("div");
        card.className = "mapping-card";
        card.innerHTML = `<strong>${keyCode.replace("Key","")}</strong> → ${getNoteLabel(note)}`;
        container.appendChild(card);
    }
}

function resetMapping() {
    if (exerciseActive) {
        showToast("Cannot configure keys during exercise!", true);
        return;
    }
    keyMapping = { ...DEFAULT_KEY_MAPPING };
    localStorage.removeItem('customPianoKeyMapping');
    renderMappingUI();
    renderConfigButtons();
    showToast("✅ Keyboard mapping reset to default");
}

// ======================== KEY CONFIGURATION (NEW) ========================
let configureMode = null; // null or note name (e.g., "C4") when configuring

function startKeyConfiguration(note) {
    if (exerciseActive) {
        showToast("Cannot configure keys during exercise!", true);
        return;
    }
    configureMode = note;
    const btn = document.querySelector(`[data-config-note="${note}"]`);
    if (btn) {
        btn.style.border = '2px solid #ffff00';
        btn.style.animation = 'pulse 0.6s infinite';
    }
    showToast(`🎹 Press any key for note ${getNoteLabel(note)}...`);
}

function assignKeyToButton(note, keyCode) {
    // Remove old mappings for this note
    for (let code in keyMapping) {
        if (keyMapping[code] === note) {
            delete keyMapping[code];
        }
    }
    // Add new mapping
    keyMapping[keyCode] = note;
    
    // Save to localStorage
    localStorage.setItem('customPianoKeyMapping', JSON.stringify(keyMapping));
    
    // Reset button styles
    const buttons = document.querySelectorAll('[data-config-note]');
    buttons.forEach(btn => {
        btn.style.border = '';
        btn.style.animation = '';
    });

    renderMappingUI();
    showToast(`✅ Note ${getNoteLabel(note)} now uses key: ${keyCode.replace("Key","")}`);
}

function renderConfigButtons() {
    const container = document.getElementById("pianoConfigBtns");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Get unique notes from current mapping
    const uniqueNotes = [...new Set(Object.values(keyMapping))];
    uniqueNotes.sort();
    
    uniqueNotes.forEach(note => {
        const btn = document.createElement("button");
        btn.className = "sec-btn";
        btn.innerHTML = `${getNoteLabel(note)}`;
        btn.setAttribute("data-config-note", note);
        btn.style.background = "#ff9800";
        btn.style.flex = "1";
        btn.style.minWidth = "80px";
        btn.style.fontSize = "0.85rem";
        btn.style.padding = "0.6rem 0.8rem";
        btn.onclick = () => startKeyConfiguration(note);
        container.appendChild(btn);
    });
}

function loadPianoKeyMapping() {
    const saved = localStorage.getItem('customPianoKeyMapping');
    if (saved) {
        try {
            keyMapping = JSON.parse(saved);
        } catch(e) {
            console.log("Failed to load custom piano key mapping, using default");
            keyMapping = { ...DEFAULT_KEY_MAPPING };
        }
    }
}

// Event listeners + Init
document.addEventListener("DOMContentLoaded", async () => {
    // Load saved key mapping
    loadPianoKeyMapping();
    
    await initAudio();
    buildPiano();
    renderSequence();
    renderMappingUI();
    renderConfigButtons();
    document.getElementById("removeLastBtn").onclick = removeLast;
    document.getElementById("clearSeqBtn").onclick = clearSeq;
    document.getElementById("lockToggleBtn").onclick = () => { locked = !locked; document.getElementById("lockToggleBtn").innerHTML = locked ? "🔒 Locked" : "🔓 Unlock"; showToast(locked ? "Sequence locked" : "Sequence unlocked"); };
    document.getElementById("editModeBtn").onclick = () => { editModeActive = !editModeActive; if(!editModeActive) pendingEditIndex = null; showToast(editModeActive ? "Edit mode: click a step then a key" : "Edit mode off"); };
    document.getElementById("muteToggleBtn").onclick = () => { muteEnabled = !muteEnabled; document.getElementById("muteToggleBtn").innerHTML = muteEnabled ? "🔇 Muted" : "🔊 Unmuted"; showToast(muteEnabled ? "Sound muted" : "Sound on"); };
    document.getElementById("startExerciseBtn").onclick = startExercise;
    document.getElementById("resetMappingBtn").onclick = resetMapping;
    window.addEventListener("keydown", (e) => {
        // If in configuration mode, capture the key
        if (configureMode !== null) {
            e.preventDefault();
            assignKeyToButton(configureMode, e.code);
            configureMode = null;
            return;
        }
        // Normal key handling
        handleGlobalKey(e);
    });
    document.body.addEventListener("click", () => { if(audioCtx && audioCtx.state === "suspended") audioCtx.resume(); });
});