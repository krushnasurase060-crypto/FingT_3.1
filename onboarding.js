/**
 * Onboarding Module for FingT
 * 4-step onboarding system with device detection and video guide
 * Shows only on first visit, then hidden via localStorage flag
 */

(function(global) {
  'use strict';

  const Onboarding = {
    // Configuration
    config: {
      storageKey: 'fingt_onboarding_seen',
      totalSteps: 4,
      currentStep: 1
    },

    // State
    state: {
      selectedDevice: null,
      detectedDevice: null,
      isVisible: false
    },

    // DOM elements
    dom: {
      overlay: null,
      steps: {},
      nextBtn: null,
      backBtn: null,
      progressDots: {},
      videoElement: null,
      deviceButtons: {}
    },

    // ======================== INITIALIZATION ========================
    init: function() {
      // Check if onboarding has already been completed
      const onboardingCompleted = localStorage.getItem(this.config.storageKey);
      
      if (onboardingCompleted) {
        // Skip onboarding - user has seen it before
        return;
      }

      // Cache DOM elements
      this.cacheDOMElements();

      if (!this.dom.overlay) {
        console.warn('Onboarding overlay not found in DOM');
        return;
      }

      // Initialize event listeners
      this.attachEventListeners();

      // Auto-detect device
      this.state.detectedDevice = this.detectDevice();
      this.state.selectedDevice = this.state.detectedDevice;

      // Show the onboarding overlay
      this.show();
      
      console.log(`Onboarding initialized. Detected device: ${this.state.detectedDevice}`);
    },

    // ======================== DOM CACHING ========================
    cacheDOMElements: function() {
      this.dom.overlay = document.getElementById('onboardingOverlay');
      
      // Cache all step divs
      for (let i = 1; i <= this.config.totalSteps; i++) {
        this.dom.steps[i] = document.getElementById(`onb-step-${i}`);
      }

      // Cache navigation buttons
      this.dom.nextBtn = document.getElementById('onb-next-btn');
      this.dom.backBtn = document.getElementById('onb-back-btn');

      // Cache progress dots
      const dots = document.querySelectorAll('.progress-dot');
      dots.forEach((dot, idx) => {
        this.dom.progressDots[idx + 1] = dot;
      });

      // Cache video element
      this.dom.videoElement = document.getElementById('onb-video');

      // Cache device buttons
      this.dom.deviceButtons.desktop = document.getElementById('device-desktop');
      this.dom.deviceButtons.mobile = document.getElementById('device-mobile');
    },

    // ======================== DEVICE DETECTION ========================
    detectDevice: function() {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'windows phone', 'blackberry', 'tablet'];
      
      const isMobile = mobileKeywords.some(keyword => userAgent.includes(keyword));
      return isMobile ? 'mobile' : 'desktop';
    },

    // ======================== EVENT LISTENERS ========================
    attachEventListeners: function() {
      // Next button
      if (this.dom.nextBtn) {
        this.dom.nextBtn.addEventListener('click', () => this.goToNextStep());
      }

      // Back button
      if (this.dom.backBtn) {
        this.dom.backBtn.addEventListener('click', () => this.goToPreviousStep());
      }

      // Device selection buttons
      if (this.dom.deviceButtons.desktop) {
        this.dom.deviceButtons.desktop.addEventListener('click', () => this.selectDevice('desktop'));
      }

      if (this.dom.deviceButtons.mobile) {
        this.dom.deviceButtons.mobile.addEventListener('click', () => this.selectDevice('mobile'));
      }

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this.state.isVisible) return;
        
        if (e.key === 'ArrowRight') this.goToNextStep();
        if (e.key === 'ArrowLeft') this.goToPreviousStep();
      });
    },

    // ======================== VISIBILITY CONTROL ========================
    show: function() {
      if (this.dom.overlay) {
        this.dom.overlay.style.display = 'flex';
        this.state.isVisible = true;
        document.body.style.overflow = 'hidden'; // Prevent scrolling
      }
    },

    hide: function() {
      if (this.dom.overlay) {
        this.dom.overlay.style.display = 'none';
        this.state.isVisible = false;
        document.body.style.overflow = 'auto'; // Re-enable scrolling
      }
    },

    // ======================== STEP NAVIGATION ========================
    goToStep: function(stepNumber) {
      // Validate step number
      if (stepNumber < 1 || stepNumber > this.config.totalSteps) {
        return;
      }

      this.config.currentStep = stepNumber;

      // Hide all steps
      Object.keys(this.dom.steps).forEach(step => {
        if (this.dom.steps[step]) {
          this.dom.steps[step].style.display = 'none';
        }
      });

      // Show current step
      if (this.dom.steps[stepNumber]) {
        this.dom.steps[stepNumber].style.display = 'block';
      }

      // Update progress dots
      this.updateProgressDots();

      // Update navigation buttons
      this.updateNavigationButtons();

      // Handle step-specific logic
      this.handleStepTransition(stepNumber);
    },

    goToNextStep: function() {
      // Special handling for step 2 (device selection)
      if (this.config.currentStep === 2 && !this.state.selectedDevice) {
        alert('Please select a device first');
        return;
      }

      if (this.config.currentStep < this.config.totalSteps) {
        this.goToStep(this.config.currentStep + 1);
      } else {
        // Onboarding complete
        this.complete();
      }
    },

    goToPreviousStep: function() {
      if (this.config.currentStep > 1) {
        this.goToStep(this.config.currentStep - 1);
      }
    },

    // ======================== PROGRESS INDICATOR ========================
    updateProgressDots: function() {
      Object.keys(this.dom.progressDots).forEach(step => {
        const dot = this.dom.progressDots[step];
        if (dot) {
          if (parseInt(step) === this.config.currentStep) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        }
      });
    },

    // ======================== NAVIGATION BUTTONS ========================
    updateNavigationButtons: function() {
      // Back button visibility
      if (this.dom.backBtn) {
        this.dom.backBtn.style.display = this.config.currentStep > 1 ? 'block' : 'none';
      }

      // Next button text
      if (this.dom.nextBtn) {
        if (this.config.currentStep === this.config.totalSteps) {
          this.dom.nextBtn.textContent = 'Get Started 🚀';
        } else {
          this.dom.nextBtn.textContent = 'Next →';
        }
      }
    },

    // ======================== DEVICE SELECTION ========================
    selectDevice: function(device) {
      this.state.selectedDevice = device;

      // Update button styles
      Object.keys(this.dom.deviceButtons).forEach(btn => {
        const button = this.dom.deviceButtons[btn];
        if (button) {
          if (btn === device) {
            button.classList.add('active');
          } else {
            button.classList.remove('active');
          }
        }
      });

      // Update video source when in step 3
      if (this.config.currentStep === 3) {
        this.updateVideoSource();
      }
    },

    // ======================== VIDEO HANDLING ========================
    updateVideoSource: function() {
      if (!this.dom.videoElement || !this.state.selectedDevice) {
        return;
      }

      const videoPath = `video/${this.state.selectedDevice}.mp4`;
      const sourceElement = this.dom.videoElement.querySelector('source');
      
      if (sourceElement) {
        sourceElement.src = videoPath;
        this.dom.videoElement.load();
      }
    },

    // ======================== STEP TRANSITIONS ========================
    handleStepTransition: function(stepNumber) {
      switch (stepNumber) {
        case 1:
          // Welcome step - nothing special
          break;

        case 2:
          // Device selection - highlight pre-detected device
          setTimeout(() => {
            const preSelectButton = this.dom.deviceButtons[this.state.detectedDevice];
            if (preSelectButton && !this.state.selectedDevice) {
              preSelectButton.click();
            }
          }, 100);
          break;

        case 3:
          // Video guide - update video source
          this.updateVideoSource();
          break;

        case 4:
          // Ready step - nothing special
          break;
      }
    },

    // ======================== COMPLETION ========================
    complete: function() {
      // Mark onboarding as seen
      localStorage.setItem(this.config.storageKey, 'true');

      // Hide the overlay with smooth transition
      if (this.dom.overlay) {
        this.dom.overlay.style.opacity = '0';
        this.dom.overlay.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
          this.hide();
          // Reset opacity for potential future use
          this.dom.overlay.style.opacity = '1';
          this.dom.overlay.style.transition = 'none';
        }, 300);
      }

      document.body.style.overflow = 'auto';
      
      console.log('Onboarding completed');
    },

    // ======================== PUBLIC METHODS ========================
    // Reset onboarding (for testing/debugging)
    reset: function() {
      localStorage.removeItem(this.config.storageKey);
      console.log('Onboarding reset. Reload page to see onboarding again.');
    },

    // Show onboarding again (User Manual button)
    showManual: function() {
      // Re-cache DOM elements (in case we're on a different page)
      this.cacheDOMElements();
      
      // Re-attach event listeners
      this.attachEventListeners();
      
      // Remove the seen flag so onboarding shows again
      localStorage.removeItem(this.config.storageKey);
      
      // Reset to step 1
      this.config.currentStep = 1;
      this.state.selectedDevice = this.state.detectedDevice;
      this.state.isVisible = true;
      
      // Show overlay and first step
      if (this.dom.overlay) {
        this.dom.overlay.style.display = 'flex';
        this.goToStep(1);
      }
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      console.log('User Manual opened');
    }
  };

  // Expose to global scope
  global.Onboarding = Onboarding;

})(window);
