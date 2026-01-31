/**
 * Graph Slider Component
 * Handles the interactive time slider on the glucose graph
 */

class GraphSlider {
  constructor() {
    this.svg = null;
    this.sliderLine = null;
    this.sliderHitbox = null;
    this.sliderDot = null;
    this.timeLabel = null;
    this.graphPathBad = null;
    this.graphPathGood = null;

    // Graph boundaries
    this.minX = 0;
    this.maxX = 206; // End of graph (now position)
    this.currentX = this.maxX;
    this.targetX = this.maxX;

    // Spring animation for smooth dot movement
    this.dotSpring = null;
    this.animationId = null;

    // Glucose boundaries (y coordinates)
    this.upperBoundaryY = 96;  // glucose = 10
    this.lowerBoundaryY = 156; // glucose = 4

    // Y range for glucose mapping
    this.minY = 50;   // top of graph area (high glucose ~15)
    this.maxY = 190;  // bottom of graph area (low glucose ~2)

    // Glucose range
    this.minGlucose = 2;
    this.maxGlucose = 15;

    // Store original path data
    this.originalPathData = null;

    // Dragging state
    this.isDragging = false;

    this.init();
  }

  init() {
    this.svg = document.querySelector('.graph-svg');
    this.sliderLine = document.querySelector('.graph-now-line');
    this.sliderHitbox = document.querySelector('.graph-slider-hitbox');
    this.sliderDot = document.querySelector('.graph-now-dot');
    this.timeLabel = document.querySelector('.graph-now-text');
    this.timeLine1 = document.querySelector('.graph-time-line1');
    this.timeLine2 = document.querySelector('.graph-time-line2');
    this.timeBg = document.querySelector('.graph-time-bg');
    this.graphLineBase = document.querySelector('.graph-line-base');
    this.graphLineHighlight = document.querySelector('.graph-line-highlight');
    this.segmentClipRect = document.querySelector('.segment-clip-rect');

    // Default Y position for time label (below lower boundary)
    this.defaultTimeLabelY = 172;

    if (!this.svg || !this.sliderLine || !this.sliderDot) {
      console.warn('Graph slider elements not found');
      return;
    }

    // Store original path for reference
    this.originalPathData = this.graphLineBase?.getAttribute('d');

    // Sample the combined path to get Y values for any X
    this.samplePath();

    // Find boundary crossing points
    this.findBoundaryCrossings();

    // Make slider interactive
    this.setupDragEvents();

    // Initialize spring for smooth dot animation
    this.initDotSpring();

    // Initialize colors for current position (immediate, no animation)
    this.updateSliderPosition(this.currentX, true);
  }

  /**
   * Initialize spring animation for dot movement along curve
   */
  initDotSpring() {
    if (window.Spring && window.SpringPresets) {
      this.dotSpring = new Spring({
        ...SpringPresets.fast,
        initialValue: this.currentX,
        onUpdate: (x) => {
          this.renderDotAtX(x);
        }
      });
    }
  }

  /**
   * Render the dot and related elements at a specific X position
   * This is called by the spring animation for smooth movement
   */
  renderDotAtX(x) {
    // Clamp X to valid range
    x = Math.max(this.minX, Math.min(this.maxX, x));
    this.currentX = x;

    // Get Y position on the curve
    const y = this.getYForX(x);

    // Calculate line bounds based on circular watch shape
    const lineBounds = this.getLineBoundsForX(x);

    // Update slider line position
    this.sliderLine.setAttribute('x1', x);
    this.sliderLine.setAttribute('x2', x);
    this.sliderLine.setAttribute('y1', lineBounds.y1);
    this.sliderLine.setAttribute('y2', lineBounds.y2);

    // Update hitbox position
    if (this.sliderHitbox) {
      this.sliderHitbox.setAttribute('x1', x);
      this.sliderHitbox.setAttribute('x2', x);
      this.sliderHitbox.setAttribute('y1', lineBounds.y1);
      this.sliderHitbox.setAttribute('y2', lineBounds.y2);
    }

    // Update dot position (direct, no CSS transition)
    this.sliderDot.setAttribute('cx', x);
    this.sliderDot.setAttribute('cy', y);

    // Update time label
    this.updateTimeLabel(x, y);

    // Calculate glucose and update colors
    const glucose = this.yToGlucose(y);
    const isLow = y > this.lowerBoundaryY;
    const isHigh = y < this.upperBoundaryY;
    const isDanger = isLow || isHigh;

    // At "now" position, let app.js handle all accent colors via glucoseColorChange event
    // This ensures all colors (text, graph, arrow) transition together with CSS
    const isAtNow = Math.abs(x - this.maxX) < 5;
    if (!isAtNow) {
      // Only update colors when viewing historical positions
      this.updateColors(x, y, isDanger, isLow);
    } else {
      // Still update clip-path at "now" position for proper segment display
      this.updateClipPath(x, y);
    }

    this.updateGlucoseDisplay(glucose, isDanger);
  }

  /**
   * Update time label position and text
   */
  updateTimeLabel(x, y) {
    const fuzzyTime = this.getFuzzyTime(x);
    if (this.timeLine1 && this.timeLine2) {
      this.timeLine1.textContent = fuzzyTime.line1;
      this.timeLine2.textContent = fuzzyTime.line2;
      this.timeLine1.setAttribute('x', x);
      this.timeLine2.setAttribute('x', x);
    }

    // Position time label
    const safeMargin = 8;
    let maxY = y;
    for (let sampleX = Math.max(x - 25, this.minX); sampleX <= Math.min(x + 25, this.maxX); sampleX += 3) {
      const sampleY = this.getYForX(sampleX);
      if (sampleY > maxY) maxY = sampleY;
    }

    const minTextY = maxY + safeMargin;
    let textY = this.defaultTimeLabelY;
    if (minTextY > this.defaultTimeLabelY - 5) {
      textY = minTextY + 5;
    }
    textY = Math.min(textY, 210);

    this.timeLabel.setAttribute('y', textY);
    this.timeLabel.setAttribute('x', x);

    // Update background rect
    if (this.timeBg) {
      let bgWidth, bgHeight, bgYOffset;

      if (fuzzyTime.line2) {
        bgWidth = 45;
        bgHeight = 26;
        bgYOffset = 9;
      } else if (fuzzyTime.line1 === 'now') {
        bgWidth = 30;
        bgHeight = 16;
        bgYOffset = 11;
      } else if (fuzzyTime.line1 === 'just now') {
        bgWidth = 50;
        bgHeight = 16;
        bgYOffset = 11;
      } else {
        bgWidth = 62;
        bgHeight = 16;
        bgYOffset = 11;
      }

      this.timeBg.setAttribute('x', x - bgWidth / 2);
      this.timeBg.setAttribute('y', textY - bgYOffset);
      this.timeBg.setAttribute('width', bgWidth);
      this.timeBg.setAttribute('height', bgHeight);
    }
  }

  /**
   * Animate dot to target X position using spring physics
   */
  animateToX(targetX) {
    targetX = Math.max(this.minX, Math.min(this.maxX, targetX));
    this.targetX = targetX;

    if (this.dotSpring) {
      this.dotSpring.setTarget(targetX);
    } else {
      // Fallback: direct update without spring
      this.renderDotAtX(targetX);
    }
  }

  /**
   * Sample the path to create a lookup table of Y values for X positions
   */
  samplePath() {
    this.pathSamples = [];

    // Create a temporary path element
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', this.originalPathData);
    this.svg.appendChild(tempPath);

    const pathLength = tempPath.getTotalLength();
    const numSamples = 200;

    for (let i = 0; i <= numSamples; i++) {
      const point = tempPath.getPointAtLength((i / numSamples) * pathLength);
      this.pathSamples.push({ x: point.x, y: point.y });
    }

    // Sort by X for easier lookup
    this.pathSamples.sort((a, b) => a.x - b.x);

    // Remove temp path
    tempPath.remove();
  }

  /**
   * Find X coordinates where the graph crosses boundary lines
   * Includes warning zone boundaries
   */
  findBoundaryCrossings() {
    this.boundaryCrossings = [];

    // All boundary Y values
    const boundaries = [
      { y: 96, name: 'danger-high' },    // glucose = 10
      { y: 106, name: 'warning-high' },  // glucose = 9
      { y: 151, name: 'warning-low' },   // glucose = 4.5
      { y: 156, name: 'danger-low' }     // glucose = 4
    ];

    for (let i = 1; i < this.pathSamples.length; i++) {
      const prev = this.pathSamples[i - 1];
      const curr = this.pathSamples[i];

      for (const boundary of boundaries) {
        if ((prev.y < boundary.y && curr.y >= boundary.y) ||
            (prev.y >= boundary.y && curr.y < boundary.y)) {
          const t = (boundary.y - prev.y) / (curr.y - prev.y);
          const crossX = prev.x + t * (curr.x - prev.x);
          this.boundaryCrossings.push({ x: crossX, y: boundary.y, boundary: boundary.name });
        }
      }
    }

    // Sort by X position
    this.boundaryCrossings.sort((a, b) => a.x - b.x);

    // Build segments array
    this.buildSegments();
  }

  /**
   * Build segments between boundary crossings
   */
  buildSegments() {
    this.segments = [];
    let lastX = this.minX;

    for (const crossing of this.boundaryCrossings) {
      // Determine zone type based on the Y at midpoint
      const midX = (lastX + crossing.x) / 2;
      let midY = this.getYForX(midX);

      const zone = this.getZoneNameForY(midY);

      this.segments.push({
        startX: lastX,
        endX: crossing.x,
        zone: zone
      });

      lastX = crossing.x;
    }

    // Add final segment
    const midX = (lastX + this.maxX) / 2;
    let midY = this.getYForX(midX);
    const zone = this.getZoneNameForY(midY);

    this.segments.push({
      startX: lastX,
      endX: this.maxX,
      zone: zone
    });
  }

  /**
   * Get zone type for a Y coordinate
   */
  getZoneForY(y) {
    if (y < this.upperBoundaryY) return 'high';  // Above upper boundary (high glucose)
    if (y > this.lowerBoundaryY) return 'low';   // Below lower boundary (low glucose)
    return 'good';  // Between boundaries
  }

  /**
   * Get color for a Y coordinate with smooth transitions
   * Blending: 9.5-10 (y 96-101) and 4.0-4.5 (y 151-156)
   *
   * Y coordinates:
   * - y <= 96: Danger high (glucose >= 10)
   * - y 96-101: Blend yellow→red (glucose 9.5-10)
   * - y 101-106: Warning high, pure yellow (glucose 9-9.5)
   * - y 106-151: Safe (glucose 4.5-9)
   * - y 151-156: Blend yellow→red (glucose 4-4.5)
   * - y >= 156: Danger low (glucose <= 4)
   */
  getColorForY(y) {
    const COLORS = {
      safe: '#7ED321',
      warning: '#FFD700',
      danger: '#FF4444'
    };

    // Y boundaries for zones
    const DANGER_HIGH_Y = 96;    // glucose = 10
    const BLEND_HIGH_Y = 101;    // glucose = 9.5
    const WARNING_HIGH_Y = 106;  // glucose = 9
    const WARNING_LOW_Y = 151;   // glucose = 4.5
    const DANGER_LOW_Y = 156;    // glucose = 4

    // Danger zones (pure red)
    if (y <= DANGER_HIGH_Y || y >= DANGER_LOW_Y) {
      return COLORS.danger;
    }

    // Safe zone (pure green)
    if (y >= WARNING_HIGH_Y && y <= WARNING_LOW_Y) {
      return COLORS.safe;
    }

    // High warning zone (y 96-106, glucose 9-10)
    if (y > DANGER_HIGH_Y && y < WARNING_HIGH_Y) {
      if (y <= BLEND_HIGH_Y) {
        // Blend yellow to red (y 96-101, glucose 9.5-10)
        const t = (BLEND_HIGH_Y - y) / 5;
        return this.blendColors(COLORS.warning, COLORS.danger, t);
      }
      // Pure yellow (y 101-106, glucose 9-9.5)
      return COLORS.warning;
    }

    // Low warning zone (y 151-156, glucose 4-4.5) - blend throughout
    if (y > WARNING_LOW_Y && y < DANGER_LOW_Y) {
      // Blend yellow to red (as y increases / glucose decreases)
      const t = (y - WARNING_LOW_Y) / 5;
      return this.blendColors(COLORS.warning, COLORS.danger, t);
    }

    return COLORS.safe;
  }

  /**
   * Blend two hex colors
   * @param {string} color1 - First hex color
   * @param {string} color2 - Second hex color
   * @param {number} t - Blend factor (0 = color1, 1 = color2)
   */
  blendColors(color1, color2, t) {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    // Return hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get zone name for color (for segment clipping)
   */
  getZoneNameForY(y) {
    const DANGER_HIGH_Y = 96;
    const WARNING_HIGH_Y = 106;
    const WARNING_LOW_Y = 151;
    const DANGER_LOW_Y = 156;

    if (y < DANGER_HIGH_Y) return 'danger-high';
    if (y <= WARNING_HIGH_Y) return 'warning-high';
    if (y < WARNING_LOW_Y) return 'safe';
    if (y <= DANGER_LOW_Y) return 'warning-low';
    return 'danger-low';
  }

  /**
   * Get the segment that contains a given X position
   */
  getSegmentForX(x) {
    for (const segment of this.segments) {
      if (x >= segment.startX && x <= segment.endX) {
        return segment;
      }
    }
    return this.segments[this.segments.length - 1]; // Default to last segment
  }

  /**
   * Get Y value on the path for a given X
   */
  getYForX(x) {
    // Find the two samples that bracket this X
    let lower = this.pathSamples[0];
    let upper = this.pathSamples[this.pathSamples.length - 1];

    for (let i = 0; i < this.pathSamples.length - 1; i++) {
      if (this.pathSamples[i].x <= x && this.pathSamples[i + 1].x >= x) {
        lower = this.pathSamples[i];
        upper = this.pathSamples[i + 1];
        break;
      }
    }

    // Linear interpolation
    if (upper.x === lower.x) return lower.y;
    const t = (x - lower.x) / (upper.x - lower.x);
    return lower.y + t * (upper.y - lower.y);
  }

  /**
   * Convert Y coordinate to glucose value
   * Calibrated so y=96 → glucose=10 and y=156 → glucose=4
   */
  yToGlucose(y) {
    // Linear mapping based on boundary lines
    // Upper boundary: y=96 → glucose=10
    // Lower boundary: y=156 → glucose=4
    // Rate: (10-4)/(156-96) = 6/60 = 0.1 glucose per pixel
    const glucosePerPixel = 6 / 60; // 0.1
    return 10 - (y - this.upperBoundaryY) * glucosePerPixel;
  }

  /**
   * Get fuzzy time text based on slider position
   * Returns object with line1 and line2 - uses two lines only for longer text
   */
  getFuzzyTime(x) {
    const ratio = (this.maxX - x) / this.maxX;
    const minutesAgo = ratio * 360; // Assume 6 hours of history

    if (minutesAgo < 1) return { line1: 'now', line2: '' };
    if (minutesAgo < 5) return { line1: 'just now', line2: '' };
    if (minutesAgo < 30) return { line1: 'few min', line2: 'ago' };
    if (minutesAgo < 60) return { line1: '30 min ago', line2: '' };
    if (minutesAgo < 120) return { line1: '1 h ago', line2: '' };
    if (minutesAgo < 180) return { line1: '2 h ago', line2: '' };
    if (minutesAgo < 240) return { line1: '3 h ago', line2: '' };
    if (minutesAgo < 300) return { line1: '4 h ago', line2: '' };
    if (minutesAgo < 360) return { line1: '5 h ago', line2: '' };
    return { line1: '6 h ago', line2: '' };
  }

  /**
   * Calculate the Y bounds for the dashed line based on X position
   * Line goes edge-to-edge by default, but smoothly avoids obstacles:
   * - Time display at top (follows curved arc)
   * - Glucose value at bottom (follows curved arc)
   * Transition starts only when line reaches the element
   */
  getLineBoundsForX(x) {
    const centerX = 126;
    const centerY = 126;
    const arcRadius = 111; // Nav circle radius (where time and glucose sit)

    let y1 = 0;   // Default: top edge of screen
    let y2 = 252; // Default: bottom edge of screen

    // Smooth interpolation function (ease in-out)
    const smoothstep = (t) => t * t * (3 - 2 * t);

    const transitionWidth = 8; // Very small transition - starts right at the element
    const margin = 12; // Small breathing room from text

    // === TOP: Time text area (more margin at center) ===
    const timeMinX = 105;
    const timeMaxX = 147;

    if (x >= timeMinX - transitionWidth && x <= timeMaxX + transitionWidth) {
      const dx = x - centerX;
      if (Math.abs(dx) < arcRadius) {
        const arcY = centerY - Math.sqrt(arcRadius * arcRadius - dx * dx);

        // More margin when closer to center (where numbers are)
        const distFromCenter = Math.abs(x - centerX);
        const maxDist = (timeMaxX - timeMinX) / 2;
        const centerFactor = 1 - Math.min(distFromCenter / maxDist, 1);
        const dynamicMargin = margin + centerFactor * 12; // Extra margin at center

        const targetY1 = arcY + dynamicMargin;

        if (x < timeMinX) {
          // Quick smooth transition in
          const t = (x - (timeMinX - transitionWidth)) / transitionWidth;
          y1 = smoothstep(t) * targetY1;
        } else if (x > timeMaxX) {
          // Quick smooth transition out
          const t = ((timeMaxX + transitionWidth) - x) / transitionWidth;
          y1 = smoothstep(t) * targetY1;
        } else {
          // In the avoidance zone - follow the arc with dynamic margin
          y1 = targetY1;
        }
      }
    }

    // === BOTTOM: Glucose value area (narrow zone, more margin at center) ===
    const glucoseMinX = 115;
    const glucoseMaxX = 158;

    if (x >= glucoseMinX - transitionWidth && x <= glucoseMaxX + transitionWidth) {
      const dx = x - centerX;
      if (Math.abs(dx) < arcRadius) {
        const arcY = centerY + Math.sqrt(arcRadius * arcRadius - dx * dx);

        // More margin when closer to center (where numbers are)
        const distFromCenter = Math.abs(x - centerX);
        const maxDist = (glucoseMaxX - glucoseMinX) / 2;
        const centerFactor = 1 - Math.min(distFromCenter / maxDist, 1);
        const dynamicMargin = margin + 3 + centerFactor * 15; // +3px base to avoid arrow

        const targetY2 = arcY - dynamicMargin;

        if (x < glucoseMinX) {
          // Quick smooth transition in
          const t = (x - (glucoseMinX - transitionWidth)) / transitionWidth;
          y2 = 252 - smoothstep(t) * (252 - targetY2);
        } else if (x > glucoseMaxX) {
          // Quick smooth transition out
          const t = ((glucoseMaxX + transitionWidth) - x) / transitionWidth;
          y2 = 252 - smoothstep(t) * (252 - targetY2);
        } else {
          // In the avoidance zone - follow the arc with dynamic margin
          y2 = targetY2;
        }
      }
    }

    return { y1, y2 };
  }

  /**
   * Update slider position and all related elements
   * @param {number} x - Target X position
   * @param {boolean} immediate - If true, skip animation (used during drag)
   */
  updateSliderPosition(x, immediate = false) {
    if (immediate || !this.dotSpring) {
      // Direct render without animation (during drag or if spring not available)
      this.renderDotAtX(x);
    } else {
      // Animate to position using spring physics
      this.animateToX(x);
    }
  }

  /**
   * Update only the clip-path (without changing colors)
   * Used at "now" position where colors are handled by app.js
   */
  updateClipPath(x, y) {
    const currentSegment = this.getSegmentForX(x);

    // Zone boundaries for clip
    const DANGER_HIGH_Y = 96;
    const WARNING_HIGH_Y = 106;
    const WARNING_LOW_Y = 151;
    const DANGER_LOW_Y = 156;

    let clipY, clipHeight;
    if (y < DANGER_HIGH_Y) {
      clipY = 0; clipHeight = DANGER_HIGH_Y;
    } else if (y < WARNING_HIGH_Y) {
      clipY = DANGER_HIGH_Y; clipHeight = WARNING_HIGH_Y - DANGER_HIGH_Y;
    } else if (y < WARNING_LOW_Y) {
      clipY = WARNING_HIGH_Y; clipHeight = WARNING_LOW_Y - WARNING_HIGH_Y;
    } else if (y < DANGER_LOW_Y) {
      clipY = WARNING_LOW_Y; clipHeight = DANGER_LOW_Y - WARNING_LOW_Y;
    } else {
      clipY = DANGER_LOW_Y; clipHeight = 252 - DANGER_LOW_Y;
    }

    if (this.segmentClipRect && currentSegment) {
      const startX = Math.floor(currentSegment.startX) - 2;
      const endX = Math.ceil(currentSegment.endX) + 3;
      this.segmentClipRect.setAttribute('x', startX);
      this.segmentClipRect.setAttribute('y', clipY);
      this.segmentClipRect.setAttribute('width', endX - startX);
      this.segmentClipRect.setAttribute('height', clipHeight);
    }
  }

  /**
   * Update colors with a specific color (used when at "now" position to match blob)
   */
  updateColorsWithColor(x, y, color) {
    // Update slider elements with provided color
    this.sliderDot.style.fill = color;
    this.sliderLine.style.stroke = color;
    this.timeLabel.style.fill = color;

    // Update highlight color
    if (this.graphLineHighlight) {
      this.graphLineHighlight.style.stroke = color;
    }

    // Still need to update clip-path based on position
    const currentSegment = this.getSegmentForX(x);

    // Zone boundaries for clip
    const DANGER_HIGH_Y = 96;
    const WARNING_HIGH_Y = 106;
    const WARNING_LOW_Y = 151;
    const DANGER_LOW_Y = 156;

    let clipY, clipHeight;
    if (y < DANGER_HIGH_Y) {
      clipY = 0; clipHeight = DANGER_HIGH_Y;
    } else if (y < WARNING_HIGH_Y) {
      clipY = DANGER_HIGH_Y; clipHeight = WARNING_HIGH_Y - DANGER_HIGH_Y;
    } else if (y < WARNING_LOW_Y) {
      clipY = WARNING_HIGH_Y; clipHeight = WARNING_LOW_Y - WARNING_HIGH_Y;
    } else if (y < DANGER_LOW_Y) {
      clipY = WARNING_LOW_Y; clipHeight = DANGER_LOW_Y - WARNING_LOW_Y;
    } else {
      clipY = DANGER_LOW_Y; clipHeight = 252 - DANGER_LOW_Y;
    }

    if (this.segmentClipRect && currentSegment) {
      const startX = Math.floor(currentSegment.startX) - 2;
      const endX = Math.ceil(currentSegment.endX) + 3;
      this.segmentClipRect.setAttribute('x', startX);
      this.segmentClipRect.setAttribute('y', clipY);
      this.segmentClipRect.setAttribute('width', endX - startX);
      this.segmentClipRect.setAttribute('height', clipHeight);
    }
  }

  /**
   * Update colors based on slider position
   * Each zone (safe/warning/danger) has its own color, clip shows only current zone segment
   */
  updateColors(x, y, isDanger, isLow) {
    // Zone boundaries
    const DANGER_HIGH_Y = 96;    // glucose = 10
    const WARNING_HIGH_Y = 106;  // glucose = 9
    const WARNING_LOW_Y = 151;   // glucose = 4.5
    const DANGER_LOW_Y = 156;    // glucose = 4

    // Get blended color based on Y position (matches blob's color logic)
    const segmentColor = this.getColorForY(y);

    // Determine clip zone based on Y position
    let clipY, clipHeight;

    if (y < DANGER_HIGH_Y) {
      // Danger high zone (glucose > 10)
      clipY = 0;
      clipHeight = DANGER_HIGH_Y;
    } else if (y < WARNING_HIGH_Y) {
      // Warning high zone (glucose 9-10)
      clipY = DANGER_HIGH_Y;
      clipHeight = WARNING_HIGH_Y - DANGER_HIGH_Y;
    } else if (y < WARNING_LOW_Y) {
      // Safe zone (glucose 4.5-9)
      clipY = WARNING_HIGH_Y;
      clipHeight = WARNING_LOW_Y - WARNING_HIGH_Y;
    } else if (y < DANGER_LOW_Y) {
      // Warning low zone (glucose 4-4.5)
      clipY = WARNING_LOW_Y;
      clipHeight = DANGER_LOW_Y - WARNING_LOW_Y;
    } else {
      // Danger low zone (glucose < 4)
      clipY = DANGER_LOW_Y;
      clipHeight = 252 - DANGER_LOW_Y;
    }

    // Get current segment (X boundaries)
    const currentSegment = this.getSegmentForX(x);

    // Update slider elements with zone color
    this.sliderDot.style.fill = segmentColor;
    this.sliderLine.style.stroke = segmentColor;
    this.timeLabel.style.fill = segmentColor;

    // Update highlight color
    if (this.graphLineHighlight) {
      this.graphLineHighlight.style.stroke = segmentColor;
    }

    // Update clip-path: X from segment, Y from zone
    if (this.segmentClipRect && currentSegment) {
      const startX = Math.floor(currentSegment.startX) - 2;
      const endX = Math.ceil(currentSegment.endX) + 3;
      this.segmentClipRect.setAttribute('x', startX);
      this.segmentClipRect.setAttribute('y', clipY);
      this.segmentClipRect.setAttribute('width', endX - startX);
      this.segmentClipRect.setAttribute('height', clipHeight);
    }
  }

  /**
   * Calculate the slope (derivative) of the graph at a given X position
   * Returns one of 5 discrete angles: 0°, 45°, 90°, 135°, 180°
   * - 0° = pointing straight up (rising fast)
   * - 45° = pointing up-right (rising)
   * - 90° = pointing right (stable)
   * - 135° = pointing down-right (falling)
   * - 180° = pointing down (falling fast)
   */
  getSlopeAngleAtX(x) {
    // Sample points before and after current position to calculate slope
    const delta = 8; // Sample distance
    const x1 = Math.max(this.minX, x - delta);
    const x2 = Math.min(this.maxX, x + delta);

    const y1 = this.getYForX(x1);
    const y2 = this.getYForX(x2);

    // Calculate slope (rise over run)
    // Note: In SVG, Y increases downward, so positive slope = falling glucose
    const slope = (y2 - y1) / (x2 - x1);

    // Map slope to one of 5 discrete trend angles
    // Thresholds based on typical graph slopes
    // slope < -0.8 → rising fast (0°)
    // slope -0.8 to -0.2 → rising (45°)
    // slope -0.2 to 0.2 → stable (90°)
    // slope 0.2 to 0.8 → falling (135°)
    // slope > 0.8 → falling fast (180°)

    const TREND_ANGLES = [0, 45, 90, 135, 180];

    if (slope < -0.8) return TREND_ANGLES[0];      // Rising fast
    if (slope < -0.2) return TREND_ANGLES[1];      // Rising
    if (slope < 0.2) return TREND_ANGLES[2];       // Stable
    if (slope < 0.8) return TREND_ANGLES[3];       // Falling
    return TREND_ANGLES[4];                         // Falling fast
  }

  /**
   * Get trend index (0-4) from angle
   */
  getTrendIndexFromAngle(angle) {
    const TREND_ANGLES = [0, 45, 90, 135, 180];
    return TREND_ANGLES.indexOf(angle);
  }

  /**
   * Get color for glucose value with smooth blending at thresholds
   * Blending happens: 9.5-10 (yellow→red) and 4.0-4.5 (yellow→red)
   */
  getColorForGlucose(glucose) {
    const COLORS = {
      SAFE: '#7ED321',
      WARNING: '#FFD700',
      DANGER: '#FF4444'
    };

    // Danger zones (pure red)
    if (glucose <= 4.0 || glucose >= 10.0) {
      return COLORS.DANGER;
    }

    // Safe zone (pure green)
    if (glucose >= 4.5 && glucose <= 9.0) {
      return COLORS.SAFE;
    }

    // High warning zone (9.0 - 10.0)
    if (glucose > 9.0 && glucose < 10.0) {
      if (glucose >= 9.5) {
        // Blend from yellow to red (9.5 to 10)
        const t = (glucose - 9.5) / 0.5;
        return this.blendColors(COLORS.WARNING, COLORS.DANGER, t);
      }
      // Pure yellow (9.0 to 9.5)
      return COLORS.WARNING;
    }

    // Low warning zone (4.0 - 4.5) - blend throughout
    if (glucose > 4.0 && glucose < 4.5) {
      // Blend from yellow (at 4.5) to red (at 4.0)
      const t = (4.5 - glucose) / 0.5;
      return this.blendColors(COLORS.WARNING, COLORS.DANGER, t);
    }

    return COLORS.SAFE;
  }

  /**
   * Update the glucose value display at the bottom
   */
  updateGlucoseDisplay(glucose, isDanger) {
    const glucoseText = document.querySelector('.nav-circle-base .nav-glucose textPath');
    const glucoseArrow = document.querySelector('.nav-circle-base .nav-arrow path');
    const glucoseTextElement = document.querySelector('.nav-circle-base .nav-glucose');
    const arrow = document.querySelector('.nav-circle-base .nav-arrow');

    // Use blended colors for glucose text and arrow (matches blob)
    const color = this.getColorForGlucose(glucose);

    if (glucoseTextElement) {
      glucoseTextElement.style.fill = color;
    }

    if (glucoseArrow) {
      glucoseArrow.style.fill = color;
      glucoseArrow.style.stroke = color;
    }

    const displayValue = glucose.toFixed(1).replace('.', ',');

    if (glucoseText) {
      glucoseText.textContent = displayValue;
    }

    // Calculate trend angle from graph slope at current position
    const trendAngle = this.getSlopeAngleAtX(this.currentX);

    // Update arrow position and rotation based on text width and graph slope
    if (glucoseTextElement && arrow) {
      const textBBox = glucoseTextElement.getBBox();
      const gap = 2;
      const arrowX = textBBox.x + textBBox.width + gap;
      const arrowY = textBBox.y + (textBBox.height / 2) - 8;

      // Arrow icon points straight up (0°), rotate by trend angle
      // Center of rotation is at the center of the 13x13 arrow (6.5, 6.5)
      arrow.setAttribute('transform', `translate(${arrowX}, ${arrowY}) rotate(${trendAngle.toFixed(1)}, 6.5, 6.5)`);
    }

    // Update the blob trend direction and debug button if graph is visible
    if (window.Sweetie && typeof window.Sweetie.updateTrendFromAngle === 'function') {
      window.Sweetie.updateTrendFromAngle(trendAngle);
    }
  }

  /**
   * Generate a random graph path that ends at a specific Y value
   * @param {number} endY - The Y coordinate at the end (current glucose)
   * @param {number} trendAngle - Optional trend angle (0, 45, 90, 135, 180) to determine end slope
   */
  generateRandomPath(endY, trendAngle = null) {
    const endX = 206;
    const startX = 0;

    // Calculate target slope at end based on trend angle
    // trendAngle: 0=rising fast, 45=rising, 90=stable, 135=falling, 180=falling fast
    let endSlope = 0;
    if (trendAngle !== null) {
      const slopeMap = {
        0: -1.2,    // Rising fast
        45: -0.5,   // Rising
        90: 0,      // Stable
        135: 0.5,   // Falling
        180: 1.2    // Falling fast
      };
      endSlope = slopeMap[trendAngle] || 0;
    }

    // Start Y is completely random within safe display range
    // This ensures variety - graph doesn't just follow end value
    const startY = 70 + Math.random() * 100; // Random between 70-170 (covers all zones)

    // Generate 4-5 control points
    const numPoints = 4 + Math.floor(Math.random() * 2);
    const points = [{x: startX, y: startY}];

    // Middle points are random - independent of end value
    for (let i = 1; i < numPoints; i++) {
      const progress = i / numPoints;
      const x = startX + progress * (endX - startX);

      let y;
      if (progress < 0.7) {
        // First 70% of graph: completely random, creates variety
        y = 60 + Math.random() * 130; // Random between 60-190
      } else {
        // Last 30%: transition toward end point with correct slope
        const remainingX = endX - x;
        const slopeBias = endSlope * remainingX * 0.5;
        y = endY + slopeBias + (Math.random() - 0.5) * 25;
      }

      // Clamp to visible bounds
      points.push({x, y: Math.max(50, Math.min(200, y))});
    }

    // Add end point (this is the only fixed point based on glucose value)
    points.push({x: endX, y: endY});

    // Build smooth bezier path
    let path = `M${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Calculate control points for smooth curve
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C${cp1x.toFixed(0)},${cp1y.toFixed(0)} ${cp2x.toFixed(0)},${cp2y.toFixed(0)} ${p2.x.toFixed(0)},${p2.y.toFixed(0)}`;
    }

    return path;
  }

  /**
   * Update the graph path and re-initialize
   */
  updateGraphPath(newPath) {
    // Update both base and highlight paths
    if (this.graphLineBase) {
      this.graphLineBase.setAttribute('d', newPath);
    }
    if (this.graphLineHighlight) {
      this.graphLineHighlight.setAttribute('d', newPath);
    }

    // Store new path and re-sample
    this.originalPathData = newPath;
    this.samplePath();
    this.findBoundaryCrossings();

    // Reset spring to current position
    if (this.dotSpring) {
      this.dotSpring.setValue(this.currentX);
    }

    // Update slider position to refresh colors/segments (immediate, no animation)
    this.updateSliderPosition(this.currentX, true);
  }

  /**
   * Convert glucose value to Y coordinate
   */
  glucoseToY(glucose) {
    // Linear mapping based on boundary lines
    // Upper boundary: y=96 → glucose=10
    // Lower boundary: y=156 → glucose=4
    const glucosePerPixel = 6 / 60; // 0.1
    return this.upperBoundaryY + (10 - glucose) / glucosePerPixel;
  }

  /**
   * Setup drag events for the slider
   */
  setupDragEvents() {
    const handleStart = (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.sliderDot.style.cursor = 'grabbing';

      // Stop any ongoing spring animation during drag
      if (this.dotSpring) {
        this.dotSpring.stop();
      }
    };

    const handleMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault(); // Prevent page scroll on mobile

      const svgRect = this.svg.getBoundingClientRect();
      const clientX = e.clientX || e.touches?.[0]?.clientX;

      // Convert screen coordinates to SVG coordinates
      const svgX = ((clientX - svgRect.left) / svgRect.width) * 252;

      // Immediate update during drag for responsive feel
      this.updateSliderPosition(svgX, true);
    };

    const handleEnd = () => {
      this.isDragging = false;
      this.sliderDot.style.cursor = 'grab';
    };

    // Make dot and line draggable
    this.sliderDot.style.cursor = 'grab';
    this.sliderDot.style.pointerEvents = 'auto';
    this.sliderLine.style.pointerEvents = 'none'; // Use hitbox instead

    if (this.sliderHitbox) {
      this.sliderHitbox.style.cursor = 'grab';
      this.sliderHitbox.style.pointerEvents = 'auto';
    }

    // Mouse events
    this.sliderDot.addEventListener('mousedown', handleStart);
    if (this.sliderHitbox) {
      this.sliderHitbox.addEventListener('mousedown', handleStart);
    }
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    // Touch events
    this.sliderDot.addEventListener('touchstart', handleStart, { passive: false });
    if (this.sliderHitbox) {
      this.sliderHitbox.addEventListener('touchstart', handleStart, { passive: false });
    }
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    // Click anywhere on graph - animate to that position
    this.svg.addEventListener('click', (e) => {
      if (e.target === this.sliderDot || e.target === this.sliderLine || e.target === this.sliderHitbox) return;
      if (this.isDragging) return;

      const svgRect = this.svg.getBoundingClientRect();
      const svgX = ((e.clientX - svgRect.left) / svgRect.width) * 252;

      // Animate to clicked position with spring physics
      this.updateSliderPosition(svgX, false);
    });
  }

  /**
   * Reset slider to "now" position and restore default colors
   */
  reset() {
    // Stop any ongoing animation
    if (this.dotSpring) {
      this.dotSpring.stop();
      this.dotSpring.setValue(this.maxX);
    }

    // Reset position immediately (no animation)
    this.currentX = this.maxX;
    this.targetX = this.maxX;
    this.renderDotAtX(this.maxX);

    // Reset colors to CSS defaults
    this.sliderDot.style.fill = '';
    this.sliderLine.style.stroke = '';
    this.timeLabel.style.fill = '';

    // Reset highlight
    if (this.graphLineHighlight) {
      this.graphLineHighlight.style.stroke = '';
    }

    // Reset clip based on current position's zone
    if (this.segmentClipRect && this.segments && this.segments.length > 0) {
      const lastSegment = this.segments[this.segments.length - 1];
      const y = this.getYForX(this.maxX);

      const startX = Math.floor(lastSegment.startX) - 2;
      const endX = Math.ceil(lastSegment.endX) + 3;

      // Determine clip Y based on zone
      const DANGER_HIGH_Y = 96;
      const WARNING_HIGH_Y = 106;
      const WARNING_LOW_Y = 151;
      const DANGER_LOW_Y = 156;

      let clipY, clipHeight;
      if (y < DANGER_HIGH_Y) {
        clipY = 0; clipHeight = DANGER_HIGH_Y;
      } else if (y < WARNING_HIGH_Y) {
        clipY = DANGER_HIGH_Y; clipHeight = WARNING_HIGH_Y - DANGER_HIGH_Y;
      } else if (y < WARNING_LOW_Y) {
        clipY = WARNING_HIGH_Y; clipHeight = WARNING_LOW_Y - WARNING_HIGH_Y;
      } else if (y < DANGER_LOW_Y) {
        clipY = WARNING_LOW_Y; clipHeight = DANGER_LOW_Y - WARNING_LOW_Y;
      } else {
        clipY = DANGER_LOW_Y; clipHeight = 252 - DANGER_LOW_Y;
      }

      this.segmentClipRect.setAttribute('x', startX);
      this.segmentClipRect.setAttribute('y', clipY);
      this.segmentClipRect.setAttribute('width', endX - startX);
      this.segmentClipRect.setAttribute('height', clipHeight);
    }
  }
}

// Initialize when DOM is ready and graph is visible
let graphSlider = null;

function initGraphSlider() {
  if (!graphSlider) {
    graphSlider = new GraphSlider();
  }
  return graphSlider;
}

// Export for use in app.js
window.initGraphSlider = initGraphSlider;
