/**
 * Sweetie - Animated Glucose Blob Component
 *
 * An organic, fluid blob that represents glucose levels through:
 * - Color: green (safe), yellow (borderline), red (dangerous)
 * - Size: scales with glucose value (0.3x to 1.8x)
 * - Movement: continuous floating motion within watch bounds
 * - Shape: constantly morphing organic form
 */

// Glucose thresholds (mmol/L)
const GLUCOSE_RANGES = {
  DANGER_LOW: 4.0,
  WARNING_LOW: 4.5,
  WARNING_HIGH: 9.0,
  DANGER_HIGH: 10.0,
  // For size scaling
  MIN_VALUE: 2.0,
  MAX_VALUE: 15.0
};

// Colors
const COLORS = {
  SAFE: '#7ED321',
  WARNING: '#FFD700',
  DANGER: '#FF4444'
};

// Simplified noise function for organic movement
class SimplexNoise {
  constructor() {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x, y) {
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (hash, x, y) => {
      const h = hash & 3;
      const u = h < 2 ? x : y;
      const v = h < 2 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };

    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  }
}

/**
 * Main Blob class
 */
class GlucoseBlob {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      console.error('GlucoseBlob: Container not found');
      return;
    }

    // Configuration
    this.options = {
      baseSize: options.baseSize || 80,
      watchRadius: options.watchRadius || 126,
      movementSpeed: options.movementSpeed || 0.00015,  // Slower movement
      morphSpeed: options.morphSpeed || 0.0003,          // Much slower morphing
      colorTransitionDuration: options.colorTransitionDuration || 500,
      ...options
    };

    // State
    this.glucoseValue = options.initialGlucose || 6.5;
    this.currentColor = this.getColorForGlucose(this.glucoseValue);
    this.targetColor = this.currentColor;
    this.currentScale = this.getScaleForGlucose(this.glucoseValue);

    // Animation state
    this.time = Math.random() * 1000;
    this.noise = new SimplexNoise();
    this.posX = 0.5;
    this.posY = 0.5;
    this.animationId = null;

    // Trend direction (0=up, 45=up-right, 90=right, 135=down-right, 180=down)
    this.trendAngle = options.initialTrend || 45;

    // Center lock - when true, blob stays at center (for transitions)
    this.centerLock = false;
    this.centerLockEaseOut = false;
    this.centerLockEaseStart = 0;
    this.centerLockEaseDuration = 800; // ms to ease out from center
    this.oscillationPhaseOffset = 0; // To reset oscillation phase when unlocking

    // Drag state
    this.isDragging = false;
    this.wasDragged = false; // Flag to prevent click after drag
    this.hasMoved = false; // Track if blob actually moved during drag
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartPosX = 0;
    this.dragStartPosY = 0;

    // Edge return easing - smooth transition from edge back to normal movement zone
    this.edgeReturnEasing = false;
    this.edgeReturnStart = 0;
    this.edgeReturnDuration = 600; // ms to ease back from edge
    this.edgeReturnStartX = 0;
    this.edgeReturnStartY = 0;

    // Create SVG element
    this.createSVG();

    // Start animation
    this.animate();
  }

  /**
   * Create the SVG blob element
   */
  createSVG() {
    // Remove existing blob if present
    const existing = this.container.querySelector('.glucose-blob');
    if (existing) existing.remove();

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('glucose-blob');
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.style.cssText = `
      position: absolute;
      width: ${this.options.baseSize}px;
      height: ${this.options.baseSize}px;
      transform: translate(-50%, -50%);
      transition: width var(--duration-medium, 210ms) var(--motion-spatial, cubic-bezier(0.2, 0.0, 0.0, 1.0)),
                  height var(--duration-medium, 210ms) var(--motion-spatial, cubic-bezier(0.2, 0.0, 0.0, 1.0));
      pointer-events: auto;
      cursor: grab;
      overflow: visible;
    `;

    // Create the blob path (sharp edges, no blur)
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.path.setAttribute('fill', this.currentColor);
    this.path.style.cssText = `
      transition: fill var(--duration-medium, 210ms) var(--motion-effects, cubic-bezier(0.3, 0.0, 0.0, 1.0));
    `;
    this.svg.appendChild(this.path);

    this.container.appendChild(this.svg);

    // Setup drag events
    this.setupDragEvents();
  }

  /**
   * Setup drag event listeners for manual blob movement
   */
  setupDragEvents() {
    // Mouse events
    this.svg.addEventListener('mousedown', (e) => this.handleDragStart(e));
    document.addEventListener('mousemove', (e) => this.handleDragMove(e));
    document.addEventListener('mouseup', () => this.handleDragEnd());

    // Touch events
    this.svg.addEventListener('touchstart', (e) => this.handleDragStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
    document.addEventListener('touchend', () => this.handleDragEnd());
  }

  /**
   * Handle drag start
   */
  handleDragStart(e) {
    if (this.centerLock) return; // Don't allow drag when locked

    e.preventDefault();
    // Don't stopPropagation - let click events through

    this.isDragging = true;
    this.hasMoved = false; // Reset movement flag
    this.svg.style.cursor = 'grabbing';

    // Get pointer position
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragStartPosX = this.posX;
    this.dragStartPosY = this.posY;
  }

  /**
   * Handle drag move
   */
  handleDragMove(e) {
    if (!this.isDragging) return;

    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Calculate delta in pixels
    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;

    // Mark as moved if moved more than 5 pixels (to distinguish from click)
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      this.hasMoved = true;
    }

    // Convert to percentage of container
    const containerRect = this.container.getBoundingClientRect();
    const deltaXPercent = deltaX / containerRect.width;
    const deltaYPercent = deltaY / containerRect.height;

    // Update position
    this.posX = this.dragStartPosX + deltaXPercent;
    this.posY = this.dragStartPosY + deltaYPercent;

    // Clamp to watch bounds (circular) - allow to edge
    const centerX = 0.5;
    const centerY = 0.5;
    const maxRadius = 0.48;

    const dx = this.posX - centerX;
    const dy = this.posY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
      this.posX = centerX + (dx / dist) * maxRadius;
      this.posY = centerY + (dy / dist) * maxRadius;
    }
  }

  /**
   * Handle drag end
   */
  handleDragEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.svg.style.cursor = 'grab';

    // Only set wasDragged if blob actually moved (to allow clicks)
    if (this.hasMoved) {
      this.wasDragged = true;

      // Reset oscillation phase to continue movement from current position
      this.oscillationPhaseOffset = this.time;

      // Store current position as the new "center" for oscillation
      this.dragEndPosX = this.posX;
      this.dragEndPosY = this.posY;

      // Check if released beyond normal movement radius - trigger smooth return
      const centerX = 0.5;
      const centerY = 0.5;
      const normalRadius = 0.35;
      const dx = this.posX - centerX;
      const dy = this.posY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > normalRadius) {
        // Start edge return easing - blob smoothly returns from edge
        this.edgeReturnEasing = true;
        this.edgeReturnStart = this.time;
        this.edgeReturnStartX = this.posX;
        this.edgeReturnStartY = this.posY;
      }

      // Clear wasDragged flag after a short delay
      setTimeout(() => {
        this.wasDragged = false;
      }, 100);
    }
  }

  /**
   * Check if blob was just dragged (to prevent click)
   */
  wasRecentlyDragged() {
    return this.wasDragged;
  }

  /**
   * Generate organic blob path using noise - mimics hand-drawn bezier blob
   * Uses only 4 anchor points with large, sweeping control handles
   */
  generateBlobPath(time) {
    const cx = 50;  // Center X
    const cy = 50;  // Center Y
    const baseRadius = 32;

    // Calculate morph intensity (reduced when easing out from center)
    let morphIntensity = 1;
    if (this.centerLock) {
      morphIntensity = 0.1; // Minimal morphing when locked
    } else if (this.centerLockEaseOut) {
      const elapsed = time - this.centerLockEaseStart;
      const t = Math.min(1, elapsed / this.centerLockEaseDuration);
      // Gradually increase morphing
      morphIntensity = 0.1 + t * 0.9;
    }

    // 4 anchor points with noise-based variation
    const points = [];
    const numPoints = 4;

    for (let i = 0; i < numPoints; i++) {
      const baseAngle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;

      // Add noise to angle and radius for organic movement (scaled by morph intensity)
      const angleNoise = this.noise.noise2D(
        i * 3.7 + time * this.options.morphSpeed,
        time * this.options.morphSpeed * 0.7
      ) * 0.4 * morphIntensity;

      const radiusNoise = this.noise.noise2D(
        i * 2.3 + time * this.options.morphSpeed * 0.8,
        i * 1.7 + time * this.options.morphSpeed * 0.5
      ) * morphIntensity;

      const angle = baseAngle + angleNoise;
      const radius = baseRadius + radiusNoise * 12;

      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle: angle
      });
    }

    return this.createOrganicBlobPath(points, time, morphIntensity);
  }

  /**
   * Create organic blob with large, flowing bezier curves
   * Mimics the hand-crafted SVG blobs from the design
   */
  createOrganicBlobPath(points, time, morphIntensity = 1) {
    const n = points.length;
    const cx = 50;
    const cy = 50;

    // Start path at first point
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < n; i++) {
      const current = points[i];
      const next = points[(i + 1) % n];

      // Calculate large, sweeping control points
      // Control point distance varies with noise for organic feel (scaled by morph intensity)
      const handleNoise1 = this.noise.noise2D(
        i * 5.1 + time * this.options.morphSpeed * 0.6,
        time * this.options.morphSpeed * 0.4
      ) * morphIntensity;
      const handleNoise2 = this.noise.noise2D(
        (i + 0.5) * 5.1 + time * this.options.morphSpeed * 0.6,
        time * this.options.morphSpeed * 0.4 + 50
      ) * morphIntensity;

      // Large handle lengths for sweeping curves (like in design)
      const handleLen1 = 20 + handleNoise1 * 8;
      const handleLen2 = 20 + handleNoise2 * 8;

      // Control point angles - perpendicular to radius for smooth flow
      const angle1 = current.angle + Math.PI / 2;
      const angle2 = next.angle - Math.PI / 2;

      const cp1x = current.x + Math.cos(angle1) * handleLen1;
      const cp1y = current.y + Math.sin(angle1) * handleLen1;
      const cp2x = next.x + Math.cos(angle2) * handleLen2;
      const cp2y = next.y + Math.sin(angle2) * handleLen2;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    path += ' Z';
    return path;
  }

  /**
   * Calculate position based on trend direction
   * The blob moves in the direction the arrow points
   * Supports manual dragging - continues from drag end position
   */
  updatePosition(time) {
    // If being dragged, position is set by drag handler
    if (this.isDragging) {
      return;
    }

    const centerX = 0.5;
    const centerY = 0.5;

    // If center locked, stay at center (for smooth transitions)
    if (this.centerLock) {
      this.posX = centerX;
      this.posY = centerY;
      return;
    }

    const maxRadius = 0.18; // Smaller radius to stay away from UI elements

    // Convert trend angle to radians (0° = up, clockwise)
    // In screen coords: up = -Y, right = +X
    const angleRad = (this.trendAngle - 90) * (Math.PI / 180);

    // Direction vector from trend
    let dirX = Math.cos(angleRad);
    let dirY = Math.sin(angleRad);

    // Use drag end position as base, or center if never dragged
    let baseX = this.dragEndPosX !== undefined ? this.dragEndPosX : centerX;
    let baseY = this.dragEndPosY !== undefined ? this.dragEndPosY : centerY;

    // Handle smooth return from edge (like a little game!)
    const normalRadius = 0.35;
    if (this.edgeReturnEasing) {
      const elapsed = time - this.edgeReturnStart;
      const t = Math.min(1, elapsed / this.edgeReturnDuration);
      // Smooth ease-out curve
      const easeT = 1 - Math.pow(1 - t, 3);

      // Calculate clamped target base position (within normal radius)
      const edgeDx = this.edgeReturnStartX - centerX;
      const edgeDy = this.edgeReturnStartY - centerY;
      const edgeDist = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
      const clampedBaseX = centerX + (edgeDx / edgeDist) * normalRadius;
      const clampedBaseY = centerY + (edgeDy / edgeDist) * normalRadius;

      // Interpolate base position from edge toward clamped position
      baseX = this.edgeReturnStartX + (clampedBaseX - this.edgeReturnStartX) * easeT;
      baseY = this.edgeReturnStartY + (clampedBaseY - this.edgeReturnStartY) * easeT;

      // Update stored drag end position so it continues smoothly after easing
      this.dragEndPosX = baseX;
      this.dragEndPosY = baseY;

      // End easing when complete
      if (t >= 1) {
        this.edgeReturnEasing = false;
      }
    }

    // Check if base position is far from center (e.g., after dragging to edge)
    const baseDx = baseX - centerX;
    const baseDy = baseY - centerY;
    const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
    const returnThreshold = 0.2; // Start reversing direction when beyond this

    if (baseDist > returnThreshold) {
      // Direction from center to base (outward from blob's position)
      const outwardX = baseDx / baseDist;
      const outwardY = baseDy / baseDist;

      // Check if trend direction points outward (would push blob further from center)
      const dotProduct = dirX * outwardX + dirY * outwardY;

      if (dotProduct > 0) {
        // Reverse direction to push toward center instead
        dirX = -dirX;
        dirY = -dirY;
      }
    }

    // Use adjusted time for oscillation (starts from 0 after unlocking/drag end)
    const oscillationTime = time - this.oscillationPhaseOffset;

    // Oscillate along the trend direction using sine wave (slower)
    const oscillation = Math.sin(oscillationTime * this.options.movementSpeed * 0.8) * maxRadius;

    // Add subtle perpendicular wobble for organic feel
    const wobble = this.noise.noise2D(time * this.options.movementSpeed * 0.5, 0) * 0.05;
    const perpX = -dirY * wobble;
    const perpY = dirX * wobble;

    // Calculate target position along trend direction from base position
    let targetX = baseX + dirX * oscillation + perpX;
    let targetY = baseY + dirY * oscillation + perpY;

    // Ensure target stays within circular watch bounds
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const absoluteMaxRadius = 0.48; // Same as drag limit - no jump

    if (dist > absoluteMaxRadius) {
      targetX = centerX + (dx / dist) * absoluteMaxRadius;
      targetY = centerY + (dy / dist) * absoluteMaxRadius;
    }

    // If easing out from center lock, smoothly interpolate
    if (this.centerLockEaseOut) {
      const elapsed = time - this.centerLockEaseStart;
      const t = Math.min(1, elapsed / this.centerLockEaseDuration);
      // Smooth ease-out curve (cubic)
      const easeT = 1 - Math.pow(1 - t, 3);

      this.posX = centerX + (targetX - centerX) * easeT;
      this.posY = centerY + (targetY - centerY) * easeT;

      // End ease out when complete
      if (t >= 1) {
        this.centerLockEaseOut = false;
      }
    } else {
      this.posX = targetX;
      this.posY = targetY;
    }
  }

  /**
   * Set trend direction (0=up, 45=up-right, 90=right, 135=down-right, 180=down)
   */
  setTrendDirection(angle) {
    this.trendAngle = angle;
  }

  /**
   * Lock blob to center position (for smooth transitions)
   */
  lockToCenter() {
    this.centerLock = true;
    this.centerLockEaseOut = false;
    // Reset drag end position so blob returns to center-based movement
    this.dragEndPosX = undefined;
    this.dragEndPosY = undefined;
  }

  /**
   * Unlock blob from center with smooth ease-out transition
   */
  unlockFromCenter() {
    this.centerLock = false;
    this.centerLockEaseOut = true;
    this.centerLockEaseStart = this.time;
    // Reset oscillation phase so movement starts from center (sin(0) = 0)
    this.oscillationPhaseOffset = this.time;
    // Reset drag end position so blob oscillates around center
    this.dragEndPosX = undefined;
    this.dragEndPosY = undefined;
  }

  /**
   * Get color based on glucose level with smooth transitions
   * Uses blending for warning zones to create smooth color gradients
   */
  getColorForGlucose(glucose) {
    // Pure danger zones
    if (glucose < GLUCOSE_RANGES.DANGER_LOW - 0.3 || glucose > GLUCOSE_RANGES.DANGER_HIGH + 0.3) {
      return COLORS.DANGER;
    }

    // Pure safe zone
    if (glucose > GLUCOSE_RANGES.WARNING_LOW + 0.3 && glucose < GLUCOSE_RANGES.WARNING_HIGH - 0.3) {
      return COLORS.SAFE;
    }

    // High warning zone with blending (9.0 - 10.0)
    if (glucose >= GLUCOSE_RANGES.WARNING_HIGH - 0.3 && glucose <= GLUCOSE_RANGES.DANGER_HIGH + 0.3) {
      if (glucose > GLUCOSE_RANGES.DANGER_HIGH) {
        // Blend warning to danger
        const t = Math.min(1, (glucose - GLUCOSE_RANGES.DANGER_HIGH) / 0.5);
        return this.blendColors(COLORS.WARNING, COLORS.DANGER, t);
      } else if (glucose < GLUCOSE_RANGES.WARNING_HIGH) {
        // Blend safe to warning
        const t = Math.min(1, (GLUCOSE_RANGES.WARNING_HIGH - glucose) / 0.5);
        return this.blendColors(COLORS.WARNING, COLORS.SAFE, t);
      }
      return COLORS.WARNING;
    }

    // Low warning zone with blending (4.0 - 4.5)
    if (glucose >= GLUCOSE_RANGES.DANGER_LOW - 0.3 && glucose <= GLUCOSE_RANGES.WARNING_LOW + 0.3) {
      if (glucose < GLUCOSE_RANGES.DANGER_LOW) {
        // Blend warning to danger
        const t = Math.min(1, (GLUCOSE_RANGES.DANGER_LOW - glucose) / 0.5);
        return this.blendColors(COLORS.WARNING, COLORS.DANGER, t);
      } else if (glucose > GLUCOSE_RANGES.WARNING_LOW) {
        // Blend safe to warning
        const t = Math.min(1, (glucose - GLUCOSE_RANGES.WARNING_LOW) / 0.5);
        return this.blendColors(COLORS.WARNING, COLORS.SAFE, t);
      }
      return COLORS.WARNING;
    }

    return COLORS.SAFE;
  }

  /**
   * Blend two hex colors
   */
  blendColors(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get scale based on glucose value (0.3x to 1.8x)
   * Dramatic size range so users can estimate glucose at a glance
   */
  getScaleForGlucose(glucose) {
    const minScale = 0.3;
    const maxScale = 1.8;
    const clampedGlucose = Math.max(GLUCOSE_RANGES.MIN_VALUE,
      Math.min(GLUCOSE_RANGES.MAX_VALUE, glucose));

    const normalized = (clampedGlucose - GLUCOSE_RANGES.MIN_VALUE) /
      (GLUCOSE_RANGES.MAX_VALUE - GLUCOSE_RANGES.MIN_VALUE);

    return minScale + normalized * (maxScale - minScale);
  }

  /**
   * Update glucose value
   */
  setGlucose(value) {
    this.glucoseValue = value;
    this.targetColor = this.getColorForGlucose(value);
    this.currentScale = this.getScaleForGlucose(value);

    // Update path color
    this.path.setAttribute('fill', this.targetColor);
    this.currentColor = this.targetColor;

    // Update size
    const newSize = this.options.baseSize * this.currentScale;
    this.svg.style.width = `${newSize}px`;
    this.svg.style.height = `${newSize}px`;

    // Dispatch event for external listeners (e.g., to update glucose text color)
    this.container.dispatchEvent(new CustomEvent('glucoseColorChange', {
      detail: { color: this.currentColor, glucose: value }
    }));
  }

  /**
   * Main animation loop
   */
  animate() {
    this.time += 16; // Approximate 60fps timestep

    // Update blob shape
    const pathData = this.generateBlobPath(this.time);
    this.path.setAttribute('d', pathData);

    // Update position
    this.updatePosition(this.time);

    // Apply position as percentage of container
    const containerRect = this.container.getBoundingClientRect();
    const x = this.posX * containerRect.width;
    const y = this.posY * containerRect.height;

    this.svg.style.left = `${this.posX * 100}%`;
    this.svg.style.top = `${this.posY * 100}%`;

    // Update knockout clip path to follow blob position
    this.updateKnockoutClip();

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update the knockout clip path to follow blob shape and position
   * This enables the dual-layer text knockout effect (AAA contrast)
   */
  updateKnockoutClip() {
    const clipPath = document.getElementById('blobClipPath');
    if (!clipPath) return;

    // Get the current blob path data
    const pathData = this.path.getAttribute('d');
    if (!pathData) return;

    // Set the same path shape
    clipPath.setAttribute('d', pathData);

    // Calculate transform to position the path correctly
    // Blob path is in 0-100 viewBox, centered at (50, 50)
    // Nav-circle is 0-252 viewBox
    //
    // Transform order (right to left):
    // 1. translate(-50, -50) - move blob center to origin
    // 2. scale(s) - scale to display size
    // 3. translate(tx, ty) - move to blob position in nav-circle coords

    const tx = this.posX * 252;
    const ty = this.posY * 252;
    const scale = (this.options.baseSize * this.currentScale) / 100;

    clipPath.setAttribute('transform',
      `translate(${tx}, ${ty}) scale(${scale}) translate(-50, -50)`
    );
  }

  /**
   * Stop animation
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.svg && this.svg.parentNode) {
      this.svg.remove();
    }
  }

  /**
   * Get current color
   */
  getColor() {
    return this.currentColor;
  }
}

/**
 * Initialize blob on a screen element
 */
function initGlucoseBlob(containerSelector, initialGlucose = 6.5) {
  const blob = new GlucoseBlob(containerSelector, {
    initialGlucose,
    baseSize: 85
  });

  return blob;
}

// Make available globally
window.GlucoseBlob = GlucoseBlob;
window.initGlucoseBlob = initGlucoseBlob;
