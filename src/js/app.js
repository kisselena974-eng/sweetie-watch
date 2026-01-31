/**
 * Sweetie - Diabetes Management Smartwatch App
 * Main application logic
 */

const screens = ['home', 'assistant', 'tracking'];
let currentScreenIndex = 0;
let glucoseBlob = null;
let currentTrendAngle = 45; // Will be randomized on init
let contextMenuController = null;
let insulinInputController = null;
let medInputController = null;

// Trend angles: 0=up (rising fast), 45=up-right (rising), 90=right (stable), 135=down-right (falling), 180=down (falling fast)
const TREND_ANGLES = [0, 45, 90, 135, 180];
const TREND_ICONS = ['↑', '↗', '→', '↘', '↓'];

// Glucose thresholds and colors
const GLUCOSE_THRESHOLDS = {
  DANGER_LOW: 4.0,
  WARNING_LOW: 4.5,
  WARNING_HIGH: 9.0,
  DANGER_HIGH: 10.0
};

const GLUCOSE_COLORS = {
  SAFE: '#7ED321',
  WARNING: '#FFD700',
  DANGER: '#FF4444'
};

/**
 * Get color for glucose value with smooth transitions
 */
function getColorForGlucose(glucose) {
  if (glucose < GLUCOSE_THRESHOLDS.DANGER_LOW || glucose > GLUCOSE_THRESHOLDS.DANGER_HIGH) {
    return GLUCOSE_COLORS.DANGER;
  }
  if (glucose < GLUCOSE_THRESHOLDS.WARNING_LOW || glucose > GLUCOSE_THRESHOLDS.WARNING_HIGH) {
    return GLUCOSE_COLORS.WARNING;
  }
  return GLUCOSE_COLORS.SAFE;
}

// Swipe detection
let isDragging = false;
let startY = 0;
let currentY = 0;
const SWIPE_THRESHOLD = 50;

/**
 * Navigate to a screen by name with animated transitions
 */
function navigateTo(screenName, direction = 'up') {
  const allScreens = document.querySelectorAll('.screen');
  const currentScreen = document.querySelector('.screen.active');
  const targetScreen = document.querySelector(`[data-screen="${screenName}"]`);

  if (!targetScreen || targetScreen === currentScreen) return;

  const newIndex = screens.indexOf(screenName);

  // Determine exit direction based on navigation
  if (currentScreen) {
    currentScreen.classList.remove('active');
    currentScreen.classList.add(direction === 'up' ? 'exit-up' : 'exit-down');

    // Clean up exit classes after transition
    setTimeout(() => {
      currentScreen.classList.remove('exit-up', 'exit-down');
    }, 350); // Match --duration-long
  }

  // Set enter direction and activate
  targetScreen.classList.add(direction === 'up' ? 'enter-from-bottom' : 'enter-from-top');

  // Force reflow to ensure the enter class is applied before adding active
  targetScreen.offsetHeight;

  targetScreen.classList.remove('enter-from-bottom', 'enter-from-top');
  targetScreen.classList.add('active');

  currentScreenIndex = newIndex;

  // Update nav dots
  updateNavDots(newIndex);
}

/**
 * Update navigation dots to reflect current screen
 */
function updateNavDots(index) {
  // Fixed page dots outside screens
  const pageDots = document.querySelectorAll('.page-dots .page-dot');
  pageDots.forEach((dot, i) => {
    if (i === index) {
      dot.classList.add('active');
      dot.setAttribute('r', '3.5');
    } else {
      dot.classList.remove('active');
      dot.setAttribute('r', '3');
    }
  });
}

/**
 * Navigate to next screen (swipe up)
 */
function nextScreen() {
  if (currentScreenIndex < screens.length - 1) {
    navigateTo(screens[currentScreenIndex + 1], 'up');
  }
}

/**
 * Navigate to previous screen (swipe down)
 */
function prevScreen() {
  if (currentScreenIndex > 0) {
    navigateTo(screens[currentScreenIndex - 1], 'down');
  }
}

/**
 * Handle mouse/touch start
 */
function handleDragStart(e) {
  isDragging = true;
  startY = e.clientY || e.touches?.[0]?.clientY || 0;
  currentY = startY;
}

/**
 * Handle mouse/touch move
 */
function handleDragMove(e) {
  if (!isDragging) return;
  currentY = e.clientY || e.touches?.[0]?.clientY || 0;
}

/**
 * Handle mouse/touch end
 */
function handleDragEnd() {
  if (!isDragging) return;
  isDragging = false;

  // Don't change page if blob is being dragged
  if (glucoseBlob && glucoseBlob.isDragging) {
    return;
  }

  const deltaY = startY - currentY;

  if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
    if (deltaY > 0) {
      nextScreen(); // Swipe up
    } else {
      prevScreen(); // Swipe down
    }
  }
}

/**
 * Handle touch start (mobile)
 */
function handleTouchStart(e) {
  // Don't interfere with button clicks
  if (e.target.closest('button') || e.target.closest('.context-btn')) {
    return;
  }
  isDragging = true;
  startY = e.touches[0].clientY;
  currentY = startY;
}

/**
 * Handle touch move (mobile)
 */
function handleTouchMove(e) {
  if (!isDragging) return;
  currentY = e.touches[0].clientY;
}

/**
 * Handle touch end (mobile)
 */
function handleTouchEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  // Don't change page if blob is being dragged
  if (glucoseBlob && glucoseBlob.isDragging) {
    return;
  }

  const deltaY = startY - currentY;

  if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
    if (deltaY > 0) {
      nextScreen(); // Swipe up
    } else {
      prevScreen(); // Swipe down
    }
  }
}

/**
 * Update all time displays with current time
 */
function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  // Update fixed time elements (base and knockout)
  const fixedTime = document.querySelector('.fixed-time-text textPath');
  const fixedTimeKnockout = document.querySelector('.fixed-time-text-knockout textPath');

  if (fixedTime) {
    fixedTime.textContent = timeString;
  }
  if (fixedTimeKnockout) {
    fixedTimeKnockout.textContent = timeString;
  }
}

/**
 * Initialize the app
 */
function init() {
  const display = document.querySelector('.watch-display');

  // Mouse events for desktop
  display.addEventListener('mousedown', handleDragStart);
  display.addEventListener('mousemove', handleDragMove);
  display.addEventListener('mouseup', handleDragEnd);
  display.addEventListener('mouseleave', handleDragEnd);

  // Touch events for mobile
  display.addEventListener('touchstart', handleTouchStart, { passive: false });
  display.addEventListener('touchmove', handleTouchMove, { passive: false });
  display.addEventListener('touchend', handleTouchEnd);

  // Prevent text selection while dragging
  display.addEventListener('selectstart', e => e.preventDefault());

  // Initialize time display and update every minute
  updateTime();
  setInterval(updateTime, 1000); // Update every second for accuracy

  console.log('Sweetie app initialized');
}

/**
 * Home screen - Add context button handler and glucose blob
 */
function initHomeScreen() {
  const addContextBtn = document.querySelector('.add-context-btn');
  const homeScreen = document.querySelector('[data-screen="home"]');

  // Context menu is initialized separately via ContextMenuController
  // The controller handles the add-context-btn click events

  // Initialize the glucose blob
  if (homeScreen) {
    // Listen for color changes BEFORE creating blob (so initial event is caught)
    homeScreen.addEventListener('glucoseColorChange', (e) => {
      const color = e.detail.color;
      updateGlucoseTextColor(color); // Graph elements

      // Update glucose text and arrow to match blob
      const glucoseText = document.querySelector('.nav-circle-base .nav-glucose');
      const arrow = document.querySelector('.nav-circle-base .nav-arrow path');
      if (glucoseText) glucoseText.style.fill = color;
      if (arrow) {
        arrow.style.fill = color;
        arrow.style.stroke = color;
      }
    });

    // Get initial glucose from the display (parse from text)
    const glucoseText = document.querySelector('.nav-circle-base .nav-glucose textPath');
    const initialGlucose = glucoseText
      ? parseFloat(glucoseText.textContent.replace(',', '.'))
      : 6.5;

    glucoseBlob = new GlucoseBlob(homeScreen, {
      initialGlucose,
      baseSize: 85
    });

    // Expose globally for transitions
    window.glucoseBlob = glucoseBlob;

    // Set initial arrow position and trend
    updateArrowPosition();
    glucoseBlob.setTrendDirection(currentTrendAngle);

    // Make blob clickable to show graph (but not when dragging)
    setTimeout(() => {
      const blobElement = homeScreen.querySelector('.glucose-blob');
      if (blobElement) {
        blobElement.addEventListener('click', () => {
          // Don't toggle graph if blob was just dragged
          if (glucoseBlob && glucoseBlob.wasRecentlyDragged()) {
            return;
          }
          toggleGraphView();
        });
      }
    }, 100);
  }

  // Initialize graph toggle
  initGraphToggle();
}

/**
 * Update graph elements color (follows blob's smooth color)
 */
function updateGlucoseTextColor(color) {
  // Update graph elements to match blob color
  const graphHighlight = document.querySelector('.graph-line-highlight');
  const graphDot = document.querySelector('.graph-now-dot');
  const graphLine = document.querySelector('.graph-now-line');
  const graphText = document.querySelector('.graph-now-text');

  if (graphHighlight) {
    graphHighlight.style.stroke = color;
  }
  if (graphDot) {
    graphDot.style.fill = color;
  }
  if (graphLine) {
    graphLine.style.stroke = color;
  }
  if (graphText) {
    graphText.style.fill = color;
  }

  // Update debug trend arrow color too
  const trendArrowPath = document.querySelector('.trend-arrow-btn path');
  if (trendArrowPath) {
    trendArrowPath.style.fill = color;
  }
}

/**
 * Update glucose value (can be called externally)
 */
function setGlucoseValue(value) {
  if (glucoseBlob) {
    glucoseBlob.setGlucose(value);
  }

  // Format with comma for European style
  const formattedValue = value.toFixed(1).replace('.', ',');

  // Update the displayed value (base layer)
  const glucoseText = document.querySelector('.nav-circle-base .nav-glucose textPath');
  if (glucoseText) {
    glucoseText.textContent = formattedValue;
  }

  // Update knockout layer glucose text (for AAA contrast knockout effect)
  const glucoseTextKnockout = document.querySelector('.nav-circle-knockout .nav-glucose-knockout textPath');
  if (glucoseTextKnockout) {
    glucoseTextKnockout.textContent = formattedValue;
  }

  // Use blob's color for glucose text and arrow (matches blob exactly)
  const blobColor = glucoseBlob ? glucoseBlob.getColor() : getColorForGlucose(value);
  const glucoseTextElement = document.querySelector('.nav-circle-base .nav-glucose');
  const glucoseArrow = document.querySelector('.nav-circle-base .nav-arrow path');

  if (glucoseTextElement) {
    glucoseTextElement.style.fill = blobColor;
  }
  if (glucoseArrow) {
    glucoseArrow.style.fill = blobColor;
    glucoseArrow.style.stroke = blobColor;
  }

  // Update arrow position based on text width
  updateArrowPosition();
}

/**
 * Update arrow position to maintain consistent spacing from glucose text
 */
function updateArrowPosition() {
  const glucoseTextElement = document.querySelector('.nav-circle-base .nav-glucose');
  const arrow = document.querySelector('.nav-circle-base .nav-arrow');
  const arrowKnockout = document.querySelector('.nav-circle-knockout .nav-arrow-knockout');

  if (!glucoseTextElement || !arrow) return;

  // Get the bounding box of the glucose text
  const textBBox = glucoseTextElement.getBBox();

  // Arrow should be positioned with consistent gap after text
  // New arrow is 13x13, center at 6.5, so offset Y to align with text
  const gap = 2;
  const arrowX = textBBox.x + textBBox.width + gap;
  const arrowY = textBBox.y + (textBBox.height / 2) - 8;  // Slightly above center

  // Include rotation based on current trend
  // Arrow icon points straight up (0°), rotate by trend angle
  // Rotation center is at the center of the 13x13 arrow
  const arrowCenterX = 6.5;
  const arrowCenterY = 6.5;
  const rotation = currentTrendAngle;
  const transform = `translate(${arrowX}, ${arrowY}) rotate(${rotation}, ${arrowCenterX}, ${arrowCenterY})`;

  arrow.setAttribute('transform', transform);

  // Update knockout layer arrow position to match
  if (arrowKnockout) {
    arrowKnockout.setAttribute('transform', transform);
  }
}

/**
 * Set the trend direction and update blob movement
 */
function setTrendDirection(stepIndex) {
  currentTrendAngle = TREND_ANGLES[stepIndex];
  updateArrowPosition();

  // Update blob movement direction
  if (glucoseBlob) {
    glucoseBlob.setTrendDirection(currentTrendAngle);
  }
}

/**
 * Update trend direction from a discrete angle (0, 45, 90, 135, 180)
 * Called by graph slider when slope changes
 */
function updateTrendFromAngle(angle) {
  // Angle is already one of 5 discrete values: 0, 45, 90, 135, 180
  currentTrendAngle = angle;

  // Update blob movement direction
  if (glucoseBlob) {
    glucoseBlob.setTrendDirection(angle);
  }

  // Update debug trend button rotation
  const trendArrowBtn = document.querySelector('.trend-arrow-btn svg');
  if (trendArrowBtn) {
    trendArrowBtn.style.transform = `rotate(${angle}deg)`;
  }

  // Update arrow on the watch display
  updateArrowPosition();
}

// Expose for external use
window.Sweetie = {
  setGlucose: setGlucoseValue,
  setTrend: setTrendDirection,
  updateTrendFromAngle: updateTrendFromAngle,
  generateGraphForTrend: generateGraphForTrend
};

/**
 * Toggle between blob view and graph view
 */
let isGraphVisible = false;
let isAnimating = false;

function toggleGraphView() {
  const graph = document.querySelector('.glucose-graph');
  const blobContainer = document.querySelector('.glucose-blob');

  if (!graph || isAnimating) return;

  isAnimating = true;
  isGraphVisible = !isGraphVisible;

  // Timing constants (match CSS variables)
  const DURATION_SHORT = 140;
  const DURATION_MEDIUM = 210;
  const DURATION_LONG = 350;

  if (isGraphVisible) {
    // Show graph: spring squish blob, then fade to graph
    if (blobContainer) {
      // Use spring physics for expressive squish animation
      if (window.animateBlobSquish) {
        window.animateBlobSquish(blobContainer, () => {
          // After spring squish, begin fade transition
          blobContainer.classList.add('fade-out');
          graph.classList.remove('hidden');

          requestAnimationFrame(() => {
            graph.classList.add('visible');
          });

          // Hide blob completely after fade
          setTimeout(() => {
            blobContainer.style.display = 'none';
            blobContainer.classList.remove('fade-out');
            isAnimating = false;

            // Initialize graph slider and update trend arrow from graph slope
            if (window.initGraphSlider) {
              const slider = window.initGraphSlider();
              slider.updateSliderPosition(slider.currentX);
            }

            // Ensure graph colors match blob's color (single source of truth)
            if (glucoseBlob) {
              updateGlucoseTextColor(glucoseBlob.getColor());
            }
          }, DURATION_LONG);
        });
      } else {
        // Fallback if spring not loaded
        blobContainer.classList.add('fade-out');
        graph.classList.remove('hidden');
        requestAnimationFrame(() => {
          graph.classList.add('visible');
        });
        setTimeout(() => {
          blobContainer.style.display = 'none';
          blobContainer.classList.remove('fade-out');
          isAnimating = false;

          // Ensure graph colors match blob's color
          if (glucoseBlob) {
            updateGlucoseTextColor(glucoseBlob.getColor());
          }
        }, DURATION_LONG);
      }
    }
  } else {
    // Show blob: fade out graph, fade in blob
    graph.classList.remove('visible');

    // Restore glucose display to current blob value (don't reset slider position yet)
    if (glucoseBlob) {
      setGlucoseValue(glucoseBlob.glucoseValue);
    }

    setTimeout(() => {
      graph.classList.add('hidden');

      // Reset graph slider while hidden (user won't see it)
      if (window.initGraphSlider) {
        const slider = window.initGraphSlider();
        slider.reset();
      }

      if (blobContainer) {
        blobContainer.style.display = '';
        blobContainer.style.opacity = '0';

        requestAnimationFrame(() => {
          // Use CSS variable for transition
          blobContainer.style.transition = `opacity var(--duration-long, ${DURATION_LONG}ms) var(--motion-effects, cubic-bezier(0.3, 0.0, 0.0, 1.0))`;
          blobContainer.style.opacity = '1';
        });

        setTimeout(() => {
          blobContainer.style.transition = '';
          isAnimating = false;
        }, DURATION_LONG);
      }
    }, DURATION_LONG);
  }
}

/**
 * Reset to home view (hide graph, show blob)
 * Called when returning from other screens like insulin input
 */
function resetToHomeView() {
  const graph = document.querySelector('.glucose-graph');
  const blobContainer = document.querySelector('.glucose-blob');

  // Sakrij graf
  if (graph) {
    graph.classList.remove('visible');
    graph.classList.add('hidden');
  }

  // Prikaži blob
  if (blobContainer) {
    blobContainer.style.display = '';
    blobContainer.classList.remove('fade-out');
  }

  // Resetiraj stanje
  isGraphVisible = false;
  isAnimating = false;

  // Resetiraj graph slider
  if (window.initGraphSlider) {
    const slider = window.initGraphSlider();
    slider.reset();
  }
}

// Izloži globalno
window.resetToHomeView = resetToHomeView;

/**
 * Initialize graph toggle via nav dot click
 */
function initGraphToggle() {
  // Click on first page dot to return to blob when graph is visible
  const pageDots = document.querySelectorAll('.page-dots .page-dot');
  const firstDot = pageDots[0];

  if (firstDot) {
    firstDot.style.cursor = 'pointer';
    firstDot.style.pointerEvents = 'auto';

    firstDot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isGraphVisible) {
        toggleGraphView();
      }
    });
  }
}

/**
 * Initialize debug slider for glucose testing
 */
function initDebugSlider() {
  const debugPanel = document.querySelector('.debug-panel');
  const toggleBtn = document.querySelector('.debug-toggle');
  const slider = document.getElementById('glucose-slider');
  const valueDisplay = document.querySelector('.glucose-value');

  if (!toggleBtn || !slider) return;

  // Toggle panel visibility
  toggleBtn.addEventListener('click', () => {
    debugPanel.classList.toggle('open');
  });

  // Update glucose on slider change
  slider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setGlucoseValue(value);
    valueDisplay.textContent = value.toFixed(1).replace('.', ',');

    // Update slider thumb and value display color (includes warning yellow)
    const color = glucoseBlob ? glucoseBlob.getColor() : getColorForGlucose(value);
    slider.style.setProperty('--thumb-color', color);
    valueDisplay.style.color = color;

    // Update thumb color via CSS variable
    document.documentElement.style.setProperty('--slider-thumb-color', color);
  });

  // Generate new graph when slider is released (using current trend)
  const generateGraphForGlucose = () => {
    const graphSlider = window.initGraphSlider ? window.initGraphSlider() : null;
    if (graphSlider && graphSlider.generateRandomPath && graphSlider.glucoseToY) {
      const value = parseFloat(slider.value);
      const targetY = graphSlider.glucoseToY(value);
      // Use current trend angle when generating new graph
      const newPath = graphSlider.generateRandomPath(targetY, currentTrendAngle);
      graphSlider.updateGraphPath(newPath);
    }
  };

  slider.addEventListener('mouseup', generateGraphForGlucose);
  slider.addEventListener('touchend', generateGraphForGlucose);

  // Trend arrow button
  const trendArrowBtn = document.querySelector('.trend-arrow-btn');
  let currentTrendIndex = TREND_ANGLES.indexOf(currentTrendAngle);
  if (currentTrendIndex === -1) currentTrendIndex = 1;

  if (trendArrowBtn) {

    trendArrowBtn.addEventListener('click', () => {
      // Cycle through 5 positions: 0 → 1 → 2 → 3 → 4 → 0
      currentTrendIndex = (currentTrendIndex + 1) % 5;
      setTrendDirection(currentTrendIndex);
      updateTrendArrowButton(trendArrowBtn, currentTrendIndex);

      // Generate new graph with matching trend direction
      generateGraphForTrend(TREND_ANGLES[currentTrendIndex]);
    });
  }
}

/**
 * Generate a new graph that matches the given trend angle
 */
function generateGraphForTrend(trendAngle) {
  const graphSlider = window.initGraphSlider ? window.initGraphSlider() : null;
  const glucoseSlider = document.getElementById('glucose-slider');

  if (graphSlider && graphSlider.generateRandomPath && graphSlider.glucoseToY) {
    // Get current glucose value
    const glucoseValue = glucoseSlider ? parseFloat(glucoseSlider.value) : 6.5;
    const targetY = graphSlider.glucoseToY(glucoseValue);

    // Generate new path with the specified trend
    const newPath = graphSlider.generateRandomPath(targetY, trendAngle);
    graphSlider.updateGraphPath(newPath);
  }
}

/**
 * Update the trend arrow button rotation
 */
function updateTrendArrowButton(btn, index) {
  const svg = btn.querySelector('svg');
  if (svg) {
    svg.style.transform = `rotate(${TREND_ANGLES[index]}deg)`;
  }
}

/**
 * Generate random initial glucose and trend values
 */
function randomizeInitialValues() {
  // Random glucose between 3.5 and 11.0
  const randomGlucose = (Math.random() * 7.5 + 3.5).toFixed(1);
  const formattedGlucose = randomGlucose.replace('.', ',');

  // Random trend angle from TREND_ANGLES
  const randomTrendIndex = Math.floor(Math.random() * TREND_ANGLES.length);
  currentTrendAngle = TREND_ANGLES[randomTrendIndex];

  // Update HTML glucose values
  const glucoseTextBase = document.querySelector('.nav-circle-base .nav-glucose textPath');
  const glucoseTextKnockout = document.querySelector('.nav-circle-knockout .nav-glucose-knockout textPath');
  if (glucoseTextBase) glucoseTextBase.textContent = formattedGlucose;
  if (glucoseTextKnockout) glucoseTextKnockout.textContent = formattedGlucose;

  // Update debug slider
  const slider = document.getElementById('glucose-slider');
  const valueDisplay = document.querySelector('.glucose-value');
  if (slider) slider.value = randomGlucose;
  if (valueDisplay) valueDisplay.textContent = formattedGlucose;

  // Update debug slider colors
  const color = getColorForGlucose(parseFloat(randomGlucose));
  if (valueDisplay) valueDisplay.style.color = color;
  document.documentElement.style.setProperty('--slider-thumb-color', color);

  // Update trend arrow button rotation
  const trendArrowBtn = document.querySelector('.trend-arrow-btn svg');
  if (trendArrowBtn) {
    trendArrowBtn.style.transform = `rotate(${currentTrendAngle}deg)`;
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  randomizeInitialValues();
  init();
  initHomeScreen();
  initDebugSlider();

  // Initialize context menu controller
  if (window.ContextMenuController) {
    contextMenuController = new ContextMenuController();
  }

  // Initialize insulin input controller
  if (window.InsulinInputController) {
    insulinInputController = new InsulinInputController();
  }

  // Initialize med input controller
  if (window.MedInputController) {
    medInputController = new MedInputController();
  }

  // Listen for context menu actions
  document.addEventListener('contextMenuAction', (e) => {
    const action = e.detail.action;
    console.log(`Handling context action: ${action}`);

    // Handle different context actions
    switch (action) {
      case 'insulin':
        // Show insulin input screen immediately (on top of context menu)
        if (insulinInputController) {
          insulinInputController.show();
        }

        // After insulin screen is visible, reset context menu and hide home
        setTimeout(() => {
          const homeScreen = document.querySelector('[data-screen="home"]');
          if (homeScreen) homeScreen.classList.remove('active');

          if (contextMenuController) {
            contextMenuController.resetState();
          }
        }, 300);
        break;

      case 'med':
        // Show med input screen immediately (on top of context menu)
        if (medInputController) {
          medInputController.show();
        }

        // After med screen is visible, reset context menu and hide home
        setTimeout(() => {
          const homeScreen = document.querySelector('[data-screen="home"]');
          if (homeScreen) homeScreen.classList.remove('active');

          if (contextMenuController) {
            contextMenuController.resetState();
          }
        }, 300);
        break;

      case 'meal':
      case 'activity':
        console.log(`${action} input - coming soon`);
        break;
    }
  });

  // Listen for insulin logged event
  document.addEventListener('insulinLogged', (e) => {
    console.log('Insulin logged:', e.detail);
  });

  // Listen for med logged event
  document.addEventListener('medLogged', (e) => {
    console.log('Med logged:', e.detail);
  });

  // Generate initial graph with current random trend
  setTimeout(() => {
    generateGraphForTrend(currentTrendAngle);

    // Update ALL colors to match blob
    if (glucoseBlob) {
      const color = glucoseBlob.getColor();

      // Debug slider
      const valueDisplay = document.querySelector('.glucose-value');
      if (valueDisplay) valueDisplay.style.color = color;
      document.documentElement.style.setProperty('--slider-thumb-color', color);

      // Glucose text and arrow on watch face
      const glucoseText = document.querySelector('.nav-circle-base .nav-glucose');
      const arrow = document.querySelector('.nav-circle-base .nav-arrow path');
      if (glucoseText) glucoseText.style.fill = color;
      if (arrow) {
        arrow.style.fill = color;
        arrow.style.stroke = color;
      }
    }
  }, 100);
});
