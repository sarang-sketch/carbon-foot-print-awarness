/**
 * @fileoverview Accessibility utilities for Carbon Compass.
 *
 * Provides functions for WCAG 2.1 AA compliance including:
 * - ARIA live region announcements
 * - Focus management
 * - Keyboard navigation helpers
 * - Reduced motion detection
 * - Color contrast validation
 * - Screen reader text generation
 *
 * @module accessibility
 * @license MIT
 */

// ─── ARIA Live Region ───────────────────────────────────────────────────────────

/**
 * Announce a message to screen readers via an ARIA live region.
 * Uses a debounce to prevent rapid-fire announcements.
 *
 * @param {string} message - The message to announce.
 * @param {string} [regionId='live-region'] - ID of the live region element.
 * @param {'polite'|'assertive'} [priority='polite'] - Announcement urgency.
 */
export function announce(message, regionId = 'live-region', priority = 'polite') {
  const region = document.getElementById(regionId);
  if (!region) return;

  region.setAttribute('aria-live', priority);

  // Clear then set — forces screen readers to re-announce
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * Create an ARIA live region element if one doesn't exist.
 *
 * @param {string} [id='live-region'] - Element ID.
 * @returns {HTMLElement} The live region element.
 */
export function ensureLiveRegion(id = 'live-region') {
  let region = document.getElementById(id);

  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    document.body.appendChild(region);
  }

  return region;
}

// ─── Focus Management ───────────────────────────────────────────────────────────

/**
 * Move focus to an element by ID.
 * Sets tabindex if the element isn't naturally focusable.
 *
 * @param {string} elementId - Target element ID.
 * @returns {boolean} True if focus was set.
 */
export function focusElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return false;

  // Make non-interactive elements focusable
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }

  element.focus();
  return true;
}

/**
 * Trap focus within a container (for modals, dialogs).
 * Returns a cleanup function to remove the trap.
 *
 * @param {HTMLElement} container - Container to trap focus within.
 * @returns {() => void} Cleanup function.
 */
export function trapFocus(container) {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  const firstFocusable = focusable[0];
  const lastFocusable = focusable[focusable.length - 1];

  function handleKeydown(event) {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);
  firstFocusable?.focus();

  return () => container.removeEventListener('keydown', handleKeydown);
}

// ─── Keyboard Navigation ────────────────────────────────────────────────────────

/**
 * Add keyboard navigation support to a list of items.
 * Arrow keys move focus; Enter/Space activates.
 *
 * @param {HTMLElement} container - Container element.
 * @param {string} itemSelector - CSS selector for navigable items.
 * @param {(item: HTMLElement) => void} onActivate - Callback when item is activated.
 * @returns {() => void} Cleanup function.
 */
export function addKeyboardNav(container, itemSelector, onActivate) {
  function handleKeydown(event) {
    const items = Array.from(container.querySelectorAll(itemSelector));
    const currentIndex = items.indexOf(document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        items[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (items[currentIndex]) onActivate(items[currentIndex]);
        break;
      }
      default:
        break;
    }
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}

// ─── Motion Preferences ─────────────────────────────────────────────────────────

/**
 * Check if the user prefers reduced motion.
 *
 * @returns {boolean} True if user has enabled "prefers-reduced-motion: reduce".
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Listen for changes to reduced motion preference.
 *
 * @param {(reduced: boolean) => void} callback - Called when preference changes.
 * @returns {() => void} Cleanup function to stop listening.
 */
export function onMotionPreferenceChange(callback) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');

  function handler(event) {
    callback(event.matches);
  }

  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

// ─── Color Contrast ─────────────────────────────────────────────────────────────

/**
 * Calculate the relative luminance of a hex color.
 * Per WCAG 2.1 definition.
 *
 * @param {string} hex - Hex color string (e.g., '#34d399').
 * @returns {number} Relative luminance value (0-1).
 */
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const sRgb = channel / 255;
    return sRgb <= 0.03928
      ? sRgb / 12.92
      : Math.pow((sRgb + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert a hex color to RGB components.
 *
 * @param {string} hex - Hex color string.
 * @returns {{ r: number, g: number, b: number }|null}
 */
export function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Calculate the contrast ratio between two colors.
 * WCAG 2.1 AA requires at least 4.5:1 for normal text, 3:1 for large text.
 *
 * @param {string} foreground - Foreground hex color.
 * @param {string} background - Background hex color.
 * @returns {number} Contrast ratio (1:1 to 21:1).
 *
 * @example
 * contrastRatio('#34d399', '#0a0e1a') // ~8.2:1 (passes AA)
 */
export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA contrast requirements.
 *
 * @param {string} foreground - Foreground hex color.
 * @param {string} background - Background hex color.
 * @param {'normal'|'large'} [textSize='normal'] - Text size category.
 * @returns {{ passes: boolean, ratio: number, required: number }}
 */
export function meetsContrastRequirement(foreground, background, textSize = 'normal') {
  const ratio = contrastRatio(foreground, background);
  const required = textSize === 'large' ? 3 : 4.5;

  return {
    passes: ratio >= required,
    ratio: Math.round(ratio * 10) / 10,
    required,
  };
}

// ─── Screen Reader Text ─────────────────────────────────────────────────────────

/**
 * Generate accessible description for a carbon footprint value.
 *
 * @param {number} totalKg - Total monthly CO₂e in kg.
 * @param {string} rank - Score rank name.
 * @param {string} topCategory - Highest impact category.
 * @returns {string} Human-readable screen reader description.
 */
export function generateFootprintDescription(totalKg, rank, topCategory) {
  return `Your estimated monthly carbon footprint is ${totalKg} kilograms of CO2 equivalent. ` +
    `You are ranked as a ${rank}. ` +
    `Your highest impact category is ${topCategory}.`;
}

/**
 * Generate accessible label for a breakdown chart.
 *
 * @param {Record<string, number>} breakdown - Category emissions.
 * @returns {string} Screen reader chart description.
 */
export function generateChartDescription(breakdown) {
  const entries = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, kg]) => `${cat}: ${kg} kilograms`)
    .join(', ');

  return `Carbon footprint breakdown chart showing: ${entries}.`;
}
