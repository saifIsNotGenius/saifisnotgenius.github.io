// Howler.js audio system variables
let howlReady = false;
let numberSounds = {};
let audioInitialized = false;
let audioTestInProgress = false;
const audioStatus = document.getElementById('audioStatus');
let activeAudioContext = null;

// State tracking variables for answer handling
let lastPresentedNumber = null;  // The most recently presented number
let currentNumber = null;        // Current number being played
let previousNumber = null;       // Previous number (for addition)
let correctAnswer = null;        // Current correct answer
let currentIntervalId = null;    // Current interval timer
let audioPlayInProgress = false; // Flag for audio playing
let processingAnswer = false;    // Flag for answer processing
let nextPresentationTime = 0;    // When the next number should be presented
let forcePresentNextNumber = false; // Flag to force next number presentation
let useNumberPad = false;

// Training state
let trainingTimerId = null;
let isPaused = false;
let currentISIValue = 200;
let consecutiveCorrect = 0;
let consecutiveIncorrect = 0;
let sessionHistory = [];
let totalCorrect = 0;
let totalAttempts = 0;
let lowestISI = 3000;
let remainingTime = 20 * 60; // in seconds

// Improved initialization for Howler with better error handling
function initializeHowlerAudio() {
    const audioStatus = document.getElementById('audioStatus');
    audioStatus.textContent = "Loading audio files...";

    // Define the number files
    const numberFiles = {
        1: 'audio/one.wav',
        2: 'audio/two.wav',
        3: 'audio/three.wav',
        4: 'audio/four.wav',
        5: 'audio/five.wav',
        6: 'audio/six.wav',
        7: 'audio/seven.wav',
        8: 'audio/eight.wav',
        9: 'audio/nine.wav'
    };

    // Track loaded sounds
    let loadedCount = 0;
    const totalSounds = Object.keys(numberFiles).length;

    // Create Howls for each number
    for (let i = 1; i <= 9; i++) {
        numberSounds[i] = new Howl({
            src: [numberFiles[i]],
            preload: true,
            html5: false, // Use Web Audio API for more reliable playback
            onload: function () {
                loadedCount++;

                if (loadedCount === totalSounds) {
                    console.log("All audio files loaded successfully");
                    howlReady = true;
                    audioStatus.textContent = "✓ Audio files ready - click 'Test Audio' to verify";
                    audioStatus.className = "audio-status";
                } else {
                    // Update loading status
                    audioStatus.textContent = `Loading audio files: ${loadedCount}/${totalSounds}`;
                }
            },
            onloaderror: function (id, err) {
                console.error(`Error loading sound for number ${i}:`, err);
                audioStatus.textContent = `⚠️ Error loading audio file for number ${i}. Check that audio/${i}.wav exists.`;
                audioStatus.className = "audio-status error";
            }
        });

        // Force the howl to preload with more reliable cache loading
        numberSounds[i].load();
    }
}

// Simplified Howler playback
function playNumberWithHowler(number) {
    return new Promise((resolve) => {
        if (audioPlayInProgress) {
            // Don't play if audio is already playing
            resolve();
            return;
        }

        audioPlayInProgress = true;

        if (!numberSounds[number]) {
            console.error(`Number ${number} sound not loaded`);
            audioPlayInProgress = false;
            resolve();
            return;
        }

        // Set volume and rate
        const volume = parseFloat(document.getElementById('speechVolume').value);
        const rate = parseFloat(document.getElementById('speechRate').value);
        numberSounds[number].volume(volume);
        numberSounds[number].rate(rate);

        // Keep track of whether we've resolved
        let hasResolved = false;

        // Function to resolve only once
        function resolveOnce() {
            if (!hasResolved) {
                hasResolved = true;
                audioPlayInProgress = false;
                resolve();
            }
        }

        // Register the end event BEFORE playing
        numberSounds[number].once('end', resolveOnce);

        // Safety timeout in case the end event doesn't fire
        const safetyTimeout = setTimeout(() => {
            resolveOnce();
        }, 1500);

        // Start playback with error handling
        try {
            const soundId = numberSounds[number].play();

            if (soundId === null) {
                clearTimeout(safetyTimeout);
                resolveOnce();
            }
        } catch (e) {
            clearTimeout(safetyTimeout);
            resolveOnce();
        }
    });
}

// Simplified speak function
function speakNumber(number) {
    return playNumberWithHowler(number);
}

// Error sound - simplified to just a beep with minimal logging
function playErrorSound() {
    try {
        if (activeAudioContext) {
            if (activeAudioContext.state === 'running') {
                activeAudioContext.close().catch(() => { });
            }
            activeAudioContext = null;
        }

        activeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = activeAudioContext.createOscillator();
        const gainNode = activeAudioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, activeAudioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, activeAudioContext.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(activeAudioContext.destination);

        oscillator.start();
        oscillator.stop(activeAudioContext.currentTime + 0.3);

        setTimeout(() => {
            if (activeAudioContext && activeAudioContext.state !== 'closed') {
                activeAudioContext.close().catch(() => { });
                activeAudioContext = null;
            }
        }, 500);
    } catch (error) { }
}

// Stop all audio playback
function stopAllAudio() {
    try {
        if (activeAudioContext) {
            activeAudioContext.close().catch(() => { });
            activeAudioContext = null;
        }
    } catch (e) { }

    try {
        for (let i = 1; i <= 9; i++) {
            if (numberSounds[i]) {
                numberSounds[i].stop();
            }
        }
    } catch (e) { }

    audioPlayInProgress = false;
}

// UI Elements
const descriptionScreen = document.getElementById('descriptionScreen');
const trainingScreen = document.getElementById('trainingScreen');
const resultsScreen = document.getElementById('resultsScreen');

const startTraining = document.getElementById('startTraining');
const pauseTraining = document.getElementById('pauseTraining');
const endTraining = document.getElementById('endTraining');
const startNewTraining = document.getElementById('startNewTraining');
const testSpeech = document.getElementById('testSpeech');

const standardMode = document.getElementById('standardMode');
const customMode = document.getElementById('customMode');
const modeDescription = document.getElementById('modeDescription');
const customModeControls = document.getElementById('customModeControls');

const speechRate = document.getElementById('speechRate');
const speechRateValue = document.getElementById('speechRateValue');
const speechVolume = document.getElementById('speechVolume');
const speechVolumeValue = document.getElementById('speechVolumeValue');
const durationSlider = document.getElementById('durationSlider');
const durationValue = document.getElementById('durationValue');

const statusMessage = document.getElementById('statusMessage');
const answerInput = document.getElementById('answerInput');
const currentISI = document.getElementById('currentISI');
const timerCircle = document.getElementById('timerCircle');
const minutesLeft = document.getElementById('minutesLeft');
const secondsLeft = document.getElementById('secondsLeft');

const correctCount = document.getElementById('correctCount');
const totalCount = document.getElementById('totalCount');
const accuracyRate = document.getElementById('accuracyRate');
const minISI = document.getElementById('minISI');
const historyContainer = document.getElementById('historyContainer');

const useNumberPadToggle = document.getElementById('useNumberPad');
const numberpad = document.getElementById('numberpad');
const numberpadButtons = document.querySelectorAll('.numberpad-button');

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Helper function to check if button clicks can be processed
function canProcessButtonClick() {
    if (isPaused) {
        console.log("Button disabled: Training is paused");
        return false;
    }
    if (processingAnswer) {
        console.log("Button disabled: Currently processing an answer");
        return false;
    }
    if (previousNumber === null) {
        console.log("Button disabled: No previous number yet");
        return false;
    }
    // All conditions passed
    return true;
}

// Mode switching
let isStandardMode = false;
let selectedISI = parseInt(document.querySelector('.isi-button.active')?.getAttribute('data-isi'));
let sessionDuration = durationSlider.value;
durationValue.textContent = sessionDuration;

standardMode.addEventListener('click', function () {
    standardMode.classList.add('active');
    customMode.classList.remove('active');
    customModeControls.style.display = 'none';
    isStandardMode = true;
    modeDescription.innerHTML = '<p><strong>Standard Mode:</strong> The training will last for 20 minutes with an initial interval of 3 seconds between numbers. The speed will adjust automatically based on your performance.</p><p class="text-sm text-muted mt-2">💡 <strong>Tip:</strong> If you plan to use intervals below 500ms, consider increasing the speaking speed to prevent audio overlap.</p>';
    sessionDuration = 20;
    selectedISI = 3000;
});

customMode.addEventListener('click', function () {
    customMode.classList.add('active');
    standardMode.classList.remove('active');
    customModeControls.style.display = 'block';
    isStandardMode = false;
    modeDescription.innerHTML = '<p><strong>Custom Mode:</strong> Customize the duration and starting speed of your training session.</p><p class="text-sm text-muted mt-2">💡 <strong>Tip:</strong> If you plan to use intervals below 500ms, consider increasing the speaking speed to prevent audio overlap.</p>';
});

// Set up ISI buttons
const isiButtons = document.querySelectorAll('.isi-button');
isiButtons.forEach(button => {
    button.addEventListener('click', function () {
        isiButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        selectedISI = parseInt(this.getAttribute('data-isi'));
    });
});

// Set up duration slider
durationSlider.addEventListener('input', function () {
    sessionDuration = parseInt(this.value);
    durationValue.textContent = sessionDuration;
});

// Voice control event listeners
speechRate.addEventListener('input', function () {
    const rateValue = parseFloat(this.value);
    if (rateValue < 0.9) {
        speechRateValue.textContent = `Slow (${rateValue.toFixed(1)})`;
    } else if (rateValue > 1.1) {
        speechRateValue.textContent = `Fast (${rateValue.toFixed(1)})`;
    } else {
        speechRateValue.textContent = `Normal (${rateValue.toFixed(1)})`;
    }
});

useNumberPadToggle.addEventListener('change', function () {
    useNumberPad = this.checked;
});

numberpadButtons.forEach(button => {
    function handleButtonInteraction(e) {
        console.log('Button interaction event fired', e.type, e.currentTarget);
        e.preventDefault();

        // Log the state before checking
        console.log('Checking canProcessButtonClick state:', {
            isPaused,
            processingAnswer,
            previousNumber,
            correctAnswer,
            currentNumber
        });

        if (!canProcessButtonClick()) {
            console.log('Ignored click. State:', {
                isPaused,
                processingAnswer,
                previousNumber,
                correctAnswer,
                currentNumber
            });
            numberpadButtons.forEach(b => b.classList.remove('selected'));
            return;
        }

        // If we get here, the click is allowed
        console.log('Click allowed. State:', {
            isPaused,
            processingAnswer,
            previousNumber,
            correctAnswer,
            currentNumber
        });

        const btn = e.currentTarget;
        const value = parseInt(btn.getAttribute('data-value'));

        numberpadButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        if (value === correctAnswer) {
            console.log('Processing correct answer:', value);
            processAnswer(value);
            numberpadButtons.forEach(b => b.classList.remove('selected'));
        } else {
            console.log('Incorrect answer:', value, 'Expected:', correctAnswer);
            btn.classList.add('incorrect-selection');
            setTimeout(() => {
                btn.classList.remove('incorrect-selection');
                btn.classList.remove('selected');
            }, 300);
        }
    }

    if (isTouchDevice) {
        button.addEventListener('touchstart', handleButtonInteraction, { passive: false });
    } else {
        button.addEventListener('mousedown', handleButtonInteraction);
    }
});

speechVolume.addEventListener('input', function () {
    const volumeValue = parseInt(this.value * 100);
    speechVolumeValue.textContent = `${volumeValue}%`;
});

// Test audio function
testSpeech.addEventListener('click', function () {
    if (audioTestInProgress) return;

    audioTestInProgress = true;
    testSpeech.disabled = true;
    testSpeech.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg> Testing...';

    setTimeout(() => {
        speakNumber(5).then(() => {
            audioTestInProgress = false;
            audioInitialized = true;
            testSpeech.disabled = false;
            testSpeech.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg> Test Audio';
            audioStatus.textContent = "✓ Audio working correctly";
            audioStatus.className = "audio-status";
        }).catch(() => {
            audioTestInProgress = false;
            testSpeech.disabled = false;
            testSpeech.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg> Try Again';
            audioStatus.textContent = "⚠️ Audio test failed";
            audioStatus.className = "audio-status error";
        });
    }, 200);
});

// Update consecutive counter display
function updateConsecutiveCounter() {
    const dots = document.querySelectorAll('.counter-dot');

    // Reset all dots
    dots.forEach(dot => {
        dot.classList.remove('correct');
        dot.classList.remove('incorrect');
    });

    // Update based on consecutive correct or incorrect
    if (consecutiveCorrect > 0) {
        for (let i = 0; i < Math.min(consecutiveCorrect, 4); i++) {
            dots[i].classList.add('correct');
        }
    } else if (consecutiveIncorrect > 0) {
        for (let i = 0; i < Math.min(consecutiveIncorrect, 4); i++) {
            dots[i].classList.add('incorrect');
        }
    }
}

// Generate a random number between 1-9
function generateNumber() {
    return Math.floor(Math.random() * 9) + 1;
}

// Start session - simplified
function startSession() {
    if (!audioInitialized) {
        audioStatus.textContent = "⚠️ Audio not tested yet - click 'Test Audio' button";
        audioStatus.className = "audio-status warning";
        return;
    }

    // Reset all audio
    stopAllAudio();

    if (useNumberPad) {
        answerInput.style.display = 'none';
        numberpad.style.display = 'grid';
        // Reset all number pad buttons
        numberpadButtons.forEach(btn => btn.classList.remove('selected'));
    } else {
        answerInput.style.display = 'block';
        numberpad.style.display = 'none';
        answerInput.value = '';
        answerInput.style.borderColor = '';
        answerInput.focus();
    }

    // Clear any pending timeouts
    const highestTimeoutId = setTimeout(() => { }, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
    }

    // Switch screens
    descriptionScreen.style.display = 'none';
    trainingScreen.style.display = 'block';
    resultsScreen.style.display = 'none';

    // Initialize session variables
    currentISIValue = selectedISI;
    currentISI.textContent = currentISIValue;
    consecutiveCorrect = 0;
    consecutiveIncorrect = 0;
    remainingTime = sessionDuration * 60;
    sessionHistory = [];
    totalCorrect = 0;
    totalAttempts = 0;
    lowestISI = currentISIValue;
    isPaused = false;
    previousNumber = null;
    currentNumber = null;
    correctAnswer = null;
    lastPresentedNumber = null;
    processingAnswer = false;
    nextPresentationTime = 0;
    forcePresentNextNumber = false;

    // Reset the counter dots display
    updateConsecutiveCounter();

    // Update timer display
    updateTimerDisplay();

    // Clear status message (will be hidden in CSS)
    statusMessage.textContent = "";
    statusMessage.style.color = '';

    // Reset input field
    answerInput.value = '';
    answerInput.style.borderColor = '';
    answerInput.focus();

    // Start the timer
    trainingTimerId = setInterval(updateTimer, 1000);

    // Start presenting numbers after short delay
    setTimeout(() => {
        presentNextNumber();
    }, 1000);
}

// Present next number with timeout handling for incorrect answers
async function presentNextNumber() {
    processingAnswer = false;
    if (isPaused) return;

    // Clear any existing interval
    if (currentIntervalId) {
        clearTimeout(currentIntervalId);
        currentIntervalId = null;
    }

    // Important: Store current time to enforce timing consistency
    const currentTime = Date.now();

    // Only enforce timing if we're not the first number and not forced to present next
    if (previousNumber !== null && !forcePresentNextNumber) {
        // Calculate how much time remains before next presentation should occur
        const timeUntilNextPresentation = nextPresentationTime - currentTime;

        // If we still have time to wait, schedule and return
        if (timeUntilNextPresentation > 0) {
            currentIntervalId = setTimeout(() => {
                if (!isPaused) {
                    presentNextNumber();
                }
            }, timeUntilNextPresentation);
            return;
        }
    }

    // Reset forced presentation flag
    forcePresentNextNumber = false;

    // Save the current number 
    previousNumber = currentNumber;

    // Generate a new number
    currentNumber = generateNumber();

    // Calculate correct answer for the new round (if not the first number)
    if (previousNumber !== null) {
        correctAnswer = Number(previousNumber) + Number(currentNumber);

        // Create and push the trial object immediately
        const currentTrial = {
            previousNumber: previousNumber,
            currentNumber: currentNumber,
            correctAnswer: correctAnswer,
            userAnswer: null,
            correct: null,
            isi: currentISIValue
        };
        sessionHistory.push(currentTrial);
    }

    // Let the system know we're presenting a new number
    lastPresentedNumber = currentNumber;

    // Clear input field 
    if (useNumberPad) {
        numberpadButtons.forEach(btn => btn.classList.remove('selected'));
    } else {
        answerInput.value = '';
        answerInput.focus();
    }

    try {
        // Speak the number
        await speakNumber(currentNumber);

        // After speaking, schedule next number
        if (previousNumber !== null) {
            // Set the next presentation time based on current time + ISI
            nextPresentationTime = Date.now() + currentISIValue;

            // Schedule next number with timeout handler for incorrect answers
            currentIntervalId = setTimeout(() => {
                if (!isPaused) {
                    let finalAnswer = null;

                    if (useNumberPad) {
                        // Check if any button is selected
                        const selectedButton = document.querySelector('.numberpad-button.selected');
                        if (selectedButton) {
                            finalAnswer = parseInt(selectedButton.getAttribute('data-value'));
                        }
                    } else {
                        // Get answer from text input
                        const inputValue = answerInput.value.trim();
                        if (inputValue) {
                            finalAnswer = Number(inputValue);
                        }
                    }

                    // Count both valid answers and empty inputs (which are incorrect)
                    totalAttempts++;

                    // Only update if not already answered
                    const currentTrial = sessionHistory[sessionHistory.length - 1];
                    if (currentTrial.userAnswer === null || currentTrial.userAnswer === undefined) {
                        let userAnswer = null;
                        let isCorrect = false;

                        if (finalAnswer) {
                            userAnswer = Number(finalAnswer);
                            if (!isNaN(userAnswer)) {
                                isCorrect = Number(userAnswer) === Number(correctAnswer);
                            }
                        }

                        currentTrial.userAnswer = userAnswer;
                        currentTrial.correct = isCorrect;

                        // Update streak counters
                        if (isCorrect) {
                            totalCorrect++;
                            consecutiveCorrect++;
                            consecutiveIncorrect = 0;
                        } else {
                            // Play error sound for incorrect answers
                            playErrorSound();
                            consecutiveCorrect = 0;
                            consecutiveIncorrect++;
                        }

                        // Update ISI based on performance
                        if (consecutiveCorrect >= 4) {
                            currentISIValue = Math.max(200, currentISIValue - 100);
                            currentISI.textContent = currentISIValue;
                            lowestISI = Math.min(lowestISI, currentISIValue);
                            consecutiveCorrect = 0;
                        } else if (consecutiveIncorrect >= 4) {
                            currentISIValue = Math.min(5000, currentISIValue + 100);
                            currentISI.textContent = currentISIValue;
                            consecutiveIncorrect = 0;
                        }

                        // Update display
                        updateConsecutiveCounter();
                    }

                    // Move to next number
                    presentNextNumber();
                }
            }, currentISIValue);
        } else {
            // First number in sequence, just schedule next
            nextPresentationTime = Date.now() + currentISIValue;

            currentIntervalId = setTimeout(() => {
                if (!isPaused) {
                    presentNextNumber();
                }
            }, currentISIValue);
        }

    } catch (error) {
        // Recover from errors
        setTimeout(() => {
            if (!isPaused) {
                presentNextNumber();
            }
        }, 1000);
    }
}

// Process answer - no changes here, keeping original 200ms timeout
function processAnswer(userAnswer) {
    if (isPaused || processingAnswer || previousNumber === null) {
        return false;
    }

    processingAnswer = true;

    // Log the current state and trial
    console.log('processAnswer called with:', userAnswer);
    console.log('sessionHistory before update:', JSON.stringify(sessionHistory));
    const currentTrial = sessionHistory[sessionHistory.length - 1];
    console.log('currentTrial before update:', currentTrial);

    if (currentTrial) {
        currentTrial.userAnswer = userAnswer;
        currentTrial.correct = (userAnswer === currentTrial.correctAnswer);
    }

    // Update counters
    totalAttempts++;
    totalCorrect++;
    consecutiveCorrect++;
    consecutiveIncorrect = 0;

    // Update ISI based on performance
    if (consecutiveCorrect >= 4) {
        currentISIValue = Math.max(200, currentISIValue - 100);
        currentISI.textContent = currentISIValue;
        lowestISI = Math.min(lowestISI, currentISIValue);
        consecutiveCorrect = 0;
    }

    // Update display
    updateConsecutiveCounter();

    // Clear input for next number
    if (useNumberPad) {
        numberpadButtons.forEach(btn => btn.classList.remove('selected'));
    } else {
        answerInput.value = '';
    }

    // Clear the timeout for this number
    if (currentIntervalId) {
        clearTimeout(currentIntervalId);
        currentIntervalId = null;
    }

    // Schedule next number with the appropriate ISI
    nextPresentationTime = Date.now() + currentISIValue;
    currentIntervalId = setTimeout(() => {
        if (!isPaused) {
            presentNextNumber();
        }
    }, currentISIValue);

    return true;
}

// Update the timer every second
function updateTimer() {
    if (isPaused) return;

    remainingTime--;
    updateTimerDisplay();

    if (remainingTime <= 0) {
        endSession();
    }
}

// Update the timer display
function updateTimerDisplay() {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    minutesLeft.textContent = minutes.toString().padStart(2, '0');
    secondsLeft.textContent = seconds.toString().padStart(2, '0');

    // Update timer circle
    const progress = (sessionDuration * 60 - remainingTime) / (sessionDuration * 60) * 100;
    timerCircle.style.background = `conic-gradient(var(--primary) 0% ${progress}%, var(--border-light) ${progress}% 100%)`;
}

// Pause or resume the training
function togglePause() {
    isPaused = !isPaused;

    if (isPaused) {
        pauseTraining.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      Resume
    `;

        // Keep input enabled but clear current interval
        if (currentIntervalId) {
            clearTimeout(currentIntervalId);
            currentIntervalId = null;
        }

        // Cancel any ongoing speech
        stopAllAudio();
    } else {
        pauseTraining.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
      Pause
    `;

        // Resume presenting numbers after a brief delay
        setTimeout(() => {
            forcePresentNextNumber = true;
            presentNextNumber();
        }, 1000);
    }
}

// End session function
function endSession() {
    // Stop all audio
    stopAllAudio();

    // Clear timers
    clearInterval(trainingTimerId);

    if (currentIntervalId) {
        clearTimeout(currentIntervalId);
        currentIntervalId = null;
    }

    // Clear any other pending timeouts
    const highestTimeoutId = setTimeout(() => { }, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
    }

    // Reset state
    isPaused = true;

    // Show results screen
    trainingScreen.style.display = 'none';
    resultsScreen.style.display = 'block';

    // Update stats
    correctCount.textContent = totalCorrect;
    totalCount.textContent = totalAttempts;
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    accuracyRate.textContent = `${accuracy}%`;
    minISI.textContent = lowestISI;

    // Update history
    updateHistory();
}

// Update the history display
function updateHistory() {
    historyContainer.innerHTML = '';

    // Group history into blocks of 10 trials
    const blocks = [];
    for (let i = 0; i < sessionHistory.length; i += 10) {
        blocks.push(sessionHistory.slice(i, i + 10));
    }

    // Create a summary for each block
    blocks.forEach((block, index) => {
        const startTrial = index * 10 + 1;
        const endTrial = startTrial + block.length - 1;

        const correctInBlock = block.filter(trial => trial.correct).length;
        const totalInBlock = block.length;
        const accuracyInBlock = totalInBlock > 0 ? Math.round((correctInBlock / totalInBlock) * 100) : 0;

        // Find lowest ISI in this block
        const lowestBlockISI = Math.min(...block.map(trial => trial.isi));

        const blockItem = document.createElement('div');
        blockItem.className = `history-item ${accuracyInBlock >= 70 ? 'correct' : 'incorrect'} animate-slide-up`;
        blockItem.style.animationDelay = `${index * 0.1}s`;

        blockItem.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span class="font-semibold">Trials ${startTrial}-${endTrial}</span>
        <span class="${accuracyInBlock >= 70 ? 'badge badge-success' : 'badge badge-danger'}">${accuracyInBlock}% Accuracy</span>
      </div>
      <div class="grid grid-cols-2 gap-4 mt-2">
        <div>
          <div class="text-muted" style="font-size: 0.75rem;">Correct Answers</div>
          <div class="font-semibold">${correctInBlock}/${totalInBlock}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size: 0.75rem;">Lowest Interval</div>
          <div class="font-semibold">${lowestBlockISI}ms</div>
        </div>
      </div>
    `;

        historyContainer.appendChild(blockItem);
    });
}

function saveUserSettings() {
    const activeISI = document.querySelector('.isi-button.active')?.dataset.isi || 3000;
    const mode = document.getElementById('customMode').classList.contains('active') ? 'custom' : 'standard';
    const duration = document.getElementById('durationSlider').value;
    const speechRate = document.getElementById('speechRate').value;
    const volume = document.getElementById('speechVolume').value;
    const useNumberPad = document.getElementById('useNumberPad').checked;

    const settings = {
        mode,
        activeISI,
        duration,
        speechRate,
        volume,
        useNumberPad
    };

    localStorage.setItem('adaptivePASATSettings', JSON.stringify(settings));
}


// Event listeners
startTraining.addEventListener('click', startSession);
pauseTraining.addEventListener('click', togglePause);
endTraining.addEventListener('click', endSession);

// Save settings whenever the user changes something
document.getElementById('durationSlider').addEventListener('input', saveUserSettings);
document.getElementById('speechRate').addEventListener('input', saveUserSettings);
document.getElementById('speechVolume').addEventListener('input', saveUserSettings);
document.getElementById('useNumberPad').addEventListener('change', saveUserSettings);
document.querySelectorAll('.isi-button').forEach(btn => btn.addEventListener('click', saveUserSettings));
document.getElementById('customMode').addEventListener('click', saveUserSettings);
document.getElementById('standardMode').addEventListener('click', saveUserSettings);
document.getElementById('startTraining').addEventListener('click', saveUserSettings);


startNewTraining.addEventListener('click', function () {
    resultsScreen.style.display = 'none';
    descriptionScreen.style.display = 'block';
});

// Simplified input handler - only process CORRECT answers immediately
answerInput.addEventListener('input', function () {
    // Only check if we have a previous number and not paused
    if (previousNumber === null || isPaused || processingAnswer || audioPlayInProgress) {
        return;
    }

    // Get the current input value
    const userInput = answerInput.value.trim();
    const userAnswer = Number(userInput);

    // ONLY process if it's correct - let incorrect answers stay until timeout
    if (!isNaN(userAnswer) && userInput.length > 0 && Number(userAnswer) === Number(correctAnswer)) {
        processAnswer(userAnswer);
    }
    // If incorrect, do nothing - they can try again or wait for timeout
});

// Enter key handler - same logic, only process if correct
answerInput.addEventListener('keyup', function (event) {
    if (event.key === 'Enter' && answerInput.value.trim() !== '') {
        if (previousNumber === null || isPaused || processingAnswer || audioPlayInProgress) {
            return;
        }

        const userAnswer = Number(answerInput.value);

        // Only process if correct
        if (!isNaN(userAnswer) && Number(userAnswer) === Number(correctAnswer)) {
            processAnswer(userAnswer);
        }
        // If incorrect, do nothing - they can try again until timeout
    }
});

// Initialize app
window.addEventListener('DOMContentLoaded', function () {
    // Initialize Howler audio system
    initializeHowlerAudio();

    // Set initial audio status
    audioStatus.textContent = "Loading audio files...";
    audioStatus.className = "audio-status";

    // Hide the status message div (no feedback)
    statusMessage.style.display = 'none';

    // Set initial mode description with tip
    modeDescription.innerHTML = '<p><strong>Standard Mode:</strong> The training will last for 20 minutes with an initial interval of 3 seconds between numbers. The speed will adjust automatically based on your performance.</p><p class="text-sm text-muted mt-2">💡 <strong>Tip:</strong> If you plan to use intervals below 500ms, consider increasing the speaking speed to prevent audio overlap.</p>';

    // === Load saved user settings from localStorage ===
    function loadUserSettings() {
        const saved = localStorage.getItem('adaptivePASATSettings');
        if (!saved) return;

        const settings = JSON.parse(saved);

        // Restore mode
        if (settings.mode === 'custom') {
            document.getElementById('customMode').classList.add('active');
            document.getElementById('standardMode').classList.remove('active');
            document.getElementById('customModeControls').style.display = 'block';
            document.getElementById('modeDescription').innerHTML = `
            <p><strong>Custom Mode:</strong> Customize the duration and starting speed of your training session.</p>
            <p class="text-sm text-muted mt-2">💡 <strong>Tip:</strong> If you plan to use intervals below 500ms, consider increasing the speaking speed to prevent audio overlap.</p>`;
        } else {
            document.getElementById('standardMode').classList.add('active');
            document.getElementById('customMode').classList.remove('active');
            document.getElementById('customModeControls').style.display = 'none';
        }

        // Restore numeric and toggle settings
        document.getElementById('durationSlider').value = settings.duration;
        document.getElementById('durationValue').textContent = settings.duration;

        document.getElementById('speechRate').value = settings.speechRate;
        document.getElementById('speechRateValue').textContent = `Normal (${settings.speechRate})`;

        document.getElementById('speechVolume').value = settings.volume;
        document.getElementById('speechVolumeValue').textContent = `${Math.round(settings.volume * 100)}%`;

        document.getElementById('useNumberPad').checked = settings.useNumberPad;

        // Restore selected ISI button
        const isiButtons = document.querySelectorAll('.isi-button');
        isiButtons.forEach(btn => {
            if (btn.dataset.isi === settings.activeISI.toString()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        let selectedISI = parseInt(document.querySelector('.isi-button.active')?.getAttribute('data-isi'));
        sessionDuration = durationSlider.value;
        durationValue.textContent = sessionDuration;
        console.log("done");
    }

    loadUserSettings();
});
