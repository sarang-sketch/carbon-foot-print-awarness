/**
 * @fileoverview Carbon Compass — Application Controller
 *
 * Orchestrates the UI: form binding, dashboard rendering, Google tool
 * URL generation, pledge management, assessment history, comparison
 * metrics, scroll animations, and toast notifications.
 *
 * @module app
 * @license MIT
 */

import {
  addPledge,
  buildActionPlan,
  buildComparisons,
  buildGeminiPrompt,
  buildGoogleCalendarUrl,
  buildGoogleMapsTransitUrl,
  buildGoogleSearchUrl,
  buildGoogleSheetCsv,
  calculateFootprint,
  CATEGORY_COLORS,
  classifyScore,
  clearHistory,
  deletePledge,
  loadHistory,
  loadPledges,
  rankCategories,
  sanitizeText,
  saveToHistory,
  togglePledge,
} from './footprint.js';

// ─── DOM References ─────────────────────────────────────────────────────────────

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const form = $('#footprint-form');
const result = $('#result');
const planList = $('#plan-list');
const mapsLink = $('#maps-link');
const calendarLink = $('#calendar-link');
const gmailLink = $('#gmail-link');
const searchLink = $('#search-link');
const geminiPrompt = $('#gemini-prompt');
const csvButton = $('#download-csv');
const jsonButton = $('#download-json');
const liveRegion = $('#live-region');
const toastContainer = $('#toast-container');
const pledgeInput = $('#pledge-input');
const pledgeButton = $('#btn-add-pledge');
const pledgeList = $('#pledge-list');
const historyList = $('#history-list');
const clearHistoryBtn = $('#btn-clear-history');

// Comparison elements
const treesValue = $('#trees-value');
const drivingValue = $('#driving-value');
const flightsValue = $('#flights-value');
const globalValue = $('#global-value');
const energyValue = $('#energy-value');
const burgersValue = $('#burgers-value');

/** Latest assessment state */
let latest = null;

/** Debounce timer */
let debounceTimer = null;

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Get a form value by name.
 * @param {string} name - Form field name.
 * @returns {string}
 */
function formValue(name) {
  const field = form.elements[name];
  return field ? field.value : '';
}

/**
 * Collect all form inputs into a structured object.
 * @returns {Object}
 */
function collectInput() {
  return {
    electricityKwh: formValue('electricityKwh'),
    gasTherms: formValue('gasTherms'),
    household: formValue('household'),
    carKm: formValue('carKm'),
    transitKm: formValue('transitKm'),
    flightsShort: formValue('flightsShort'),
    flightsLong: formValue('flightsLong'),
    meatMeals: formValue('meatMeals'),
    dairyMeals: formValue('dairyMeals'),
    shoppingSpend: formValue('shoppingSpend'),
    commuteMode: formValue('commuteMode'),
    goal: formValue('goal'),
  };
}

/**
 * Trigger a file download.
 * @param {string} filename - Download filename.
 * @param {string} mime - MIME type.
 * @param {string} content - File content.
 */
function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Show a toast notification.
 * @param {string} message - Toast message.
 * @param {'success'|'info'} type - Toast type.
 */
function showToast(message, type = 'success') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * Format a number with commas.
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  return num.toLocaleString('en-US');
}

// ─── Rendering Functions ────────────────────────────────────────────────────────

/**
 * Render the category breakdown bars.
 * @param {Object} footprint - Calculated footprint.
 * @returns {string} HTML string.
 */
function renderBreakdown(footprint) {
  const ranked = rankCategories(footprint.breakdown);
  return ranked
    .map(({ category, kg, percentage }) => {
      const color = CATEGORY_COLORS[category] || '#34d399';
      return `<li>
        <span>${category}</span>
        <strong>${kg} kg</strong>
        <div class="bar" aria-hidden="true">
          <span style="width:${percentage}%; background: ${color};"></span>
        </div>
      </li>`;
    })
    .join('');
}

/**
 * Render the donut chart SVG.
 * @param {Object} breakdown - Category breakdown.
 * @param {number} totalKg - Total emissions.
 * @returns {string} SVG HTML string.
 */
function renderDonutChart(breakdown, totalKg) {
  const categories = Object.entries(breakdown);
  const circumference = 2 * Math.PI * 45;
  let offset = 0;

  const circles = categories
    .map(([category, kg]) => {
      const pct = totalKg > 0 ? kg / totalKg : 0;
      const dashArray = pct * circumference;
      const color = CATEGORY_COLORS[category] || '#34d399';
      const circle = `<circle cx="50" cy="50" r="45" stroke="${color}" stroke-dasharray="${dashArray} ${circumference - dashArray}" stroke-dashoffset="${-offset}" style="filter: drop-shadow(0 0 4px ${color}40);" />`;
      offset += dashArray;
      return circle;
    })
    .join('');

  return `
    <div class="chart-container">
      <svg class="donut-chart" viewBox="0 0 100 100" aria-label="Carbon footprint breakdown donut chart" role="img">
        <title>Carbon footprint breakdown: ${totalKg} kg CO₂e/month</title>
        ${circles}
      </svg>
      <div class="chart-center">
        <span class="total-value">${totalKg}</span>
        <span class="total-label">kg CO₂e</span>
      </div>
    </div>
  `;
}

/**
 * Render comparison metrics.
 * @param {number} totalKg - Total monthly emissions.
 */
function renderComparisons(totalKg) {
  const comp = buildComparisons(totalKg);
  if (treesValue) treesValue.textContent = formatNumber(comp.treesNeeded);
  if (drivingValue) drivingValue.textContent = `${formatNumber(comp.equivalentCarKm)} km`;
  if (flightsValue) flightsValue.textContent = comp.equivalentFlights;
  if (globalValue) globalValue.textContent = comp.vsGlobalAverage;
  if (energyValue) energyValue.textContent = formatNumber(comp.lightbulbHours);
  if (burgersValue) burgersValue.textContent = formatNumber(comp.beefBurgers);
}

/**
 * Render the pledge list.
 */
function renderPledges() {
  if (!pledgeList) return;
  const pledges = loadPledges();

  if (pledges.length === 0) {
    pledgeList.innerHTML = '<li style="color: var(--color-text-muted); font-size: 0.875rem; padding: 1rem; text-align: center;">No pledges yet. Add your first commitment above!</li>';
    return;
  }

  pledgeList.innerHTML = pledges
    .map(
      (pledge) => `
      <li class="pledge-item ${pledge.completed ? 'completed' : ''}" data-id="${pledge.id}">
        <button type="button" class="pledge-check" aria-label="${pledge.completed ? 'Mark as incomplete' : 'Mark as complete'}" data-action="toggle" data-id="${pledge.id}"></button>
        <span>${pledge.text}</span>
        <button type="button" style="margin-left: auto; background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 1rem; padding: 0.25rem;" aria-label="Delete pledge" data-action="delete" data-id="${pledge.id}">✕</button>
      </li>`,
    )
    .join('');
}

/**
 * Render assessment history.
 */
function renderHistory() {
  if (!historyList) return;
  const history = loadHistory();

  if (history.length === 0) {
    historyList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.875rem;">No assessments recorded yet. Run a calculation to start tracking.</p>';
    return;
  }

  historyList.innerHTML = history
    .slice(0, 10) // Show last 10
    .map(
      (entry) => `
      <div class="card" style="padding: 1rem 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-family: var(--font-mono); color: var(--color-accent-green);">${entry.footprint?.totalKg ?? '?'} kg</strong>
            <span class="rank rank-${entry.score?.color || 'amber'}" style="margin-left: 0.5rem; font-size: 0.7rem;">${entry.score?.rank || 'N/A'}</span>
          </div>
          <time style="font-size: 0.75rem; color: var(--color-text-muted);">${new Date(entry.timestamp || entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
        </div>
      </div>`,
    )
    .join('');
}

// ─── Core Update Function ───────────────────────────────────────────────────────

/**
 * Recalculate and render the entire dashboard.
 */
function update() {
  const input = collectInput();
  const footprint = calculateFootprint(input);
  const score = classifyScore(footprint.totalKg);
  const profile = {
    commuteMode: sanitizeText(input.commuteMode),
    household: sanitizeText(input.household),
    goal: sanitizeText(input.goal),
  };
  const plan = buildActionPlan({ profile, footprint });
  const topCat = plan[0]?.category ?? 'transport';

  latest = {
    createdAt: new Date().toISOString(),
    footprint,
    score,
    profile,
    plan,
  };

  // ── Render result card ──
  if (result) {
    result.innerHTML = `
      <p class="eyebrow">Monthly Carbon Estimate</p>
      ${renderDonutChart(footprint.breakdown, footprint.totalKg)}
      <h2>${footprint.totalKg} kg CO₂e</h2>
      <p class="rank rank-${score.color}">${score.emoji} ${score.rank}</p>
      <p>${score.message}</p>
      <p style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--color-text-muted);">Per capita: ${footprint.perCapita} kg/month</p>
      <ul class="breakdown" aria-label="Emission breakdown">${renderBreakdown(footprint)}</ul>
    `;
  }

  // ── Render action plan ──
  if (planList) {
    planList.innerHTML = plan
      .map(
        (item) => `
        <li>
          <strong>${item.title}</strong>
          <span>${item.impact}</span>
          <em>${item.googleTool}: ${item.action}</em>
        </li>`,
      )
      .join('');
  }

  // ── Update Google tool links ──
  const origin = sanitizeText(input.origin || formValue('origin')) || 'Home';
  const destination = sanitizeText(input.destination || formValue('destination')) || 'Work';

  if (mapsLink) {
    mapsLink.href = buildGoogleMapsTransitUrl(origin, destination);
  }

  if (calendarLink) {
    calendarLink.href = buildGoogleCalendarUrl({
      title: 'Carbon footprint review',
      details: `Review ${footprint.totalKg} kg CO2e footprint and action plan. Top category: ${topCat}.`,
      start: new Date(Date.now() + 86400000).toISOString(),
      end: new Date(Date.now() + 88200000).toISOString(),
    });
  }

  if (gmailLink) {
    const emailBody = encodeURIComponent(
      `Hi,\n\nI just calculated my carbon footprint using Carbon Compass.\n\nMy monthly estimate: ${footprint.totalKg} kg CO₂e\nRank: ${score.rank}\nTop category: ${topCat}\nTop action: ${plan[0]?.title}\n\nTry it yourself and let's reduce our impact together!\n\n— Sent from Carbon Compass`,
    );
    gmailLink.href = `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent('My Carbon Action Plan — Carbon Compass')}&body=${emailBody}`;
  }

  if (searchLink) {
    searchLink.href = buildGoogleSearchUrl(topCat);
  }

  if (geminiPrompt) {
    geminiPrompt.value = buildGeminiPrompt({ totalKg: footprint.totalKg, topCategory: topCat });
  }

  // ── Update comparisons ──
  renderComparisons(footprint.totalKg);

  // ── Announce to screen readers ──
  if (liveRegion) {
    liveRegion.textContent = `Updated footprint: ${footprint.totalKg} kilograms CO2 equivalent. Rank: ${score.rank}. Top category: ${topCat}.`;
  }
}

// ─── Debounced Update ───────────────────────────────────────────────────────────

/**
 * Debounced version of update for real-time form changes.
 */
function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(update, 150);
}

// ─── Event Listeners ────────────────────────────────────────────────────────────

// Form input handling
form.addEventListener('input', debouncedUpdate);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();

  // Save to history on explicit submit
  if (latest) {
    saveToHistory(latest);
    renderHistory();
    showToast('Assessment saved to history!', 'success');
  }
});

// CSV export
csvButton?.addEventListener('click', () => {
  if (!latest) update();
  const rows = Object.entries(latest.footprint.breakdown).map(([category, kg]) => ({
    category,
    kg,
    note: `${category} emissions — Carbon Compass — ${latest.createdAt}`,
  }));
  download('carbon-compass-google-sheets.csv', 'text/csv', buildGoogleSheetCsv(rows));
  showToast('CSV exported! Import into Google Sheets.', 'success');
});

// JSON export
jsonButton?.addEventListener('click', () => {
  if (!latest) update();
  download('carbon-compass-drive-backup.json', 'application/json', JSON.stringify(latest, null, 2));
  showToast('JSON backup downloaded for Google Drive.', 'success');
});

// Pledge system
pledgeButton?.addEventListener('click', () => {
  const text = pledgeInput?.value?.trim();
  if (!text) {
    showToast('Please enter a pledge first.', 'info');
    return;
  }
  addPledge(text);
  pledgeInput.value = '';
  renderPledges();
  showToast('Pledge added! 🌱', 'success');
});

pledgeInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    pledgeButton?.click();
  }
});

pledgeList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === 'toggle') {
    togglePledge(id);
    renderPledges();
  } else if (action === 'delete') {
    deletePledge(id);
    renderPledges();
    showToast('Pledge removed.', 'info');
  }
});

// Clear history
clearHistoryBtn?.addEventListener('click', () => {
  clearHistory();
  renderHistory();
  showToast('History cleared.', 'info');
});

// ─── Scroll Animations (Intersection Observer) ──────────────────────────────────

/**
 * Initialize scroll-triggered fade-in animations.
 */
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Add fade-in class to sections
  const sections = $$('section, .card, .feature-card, .insight-card, .quality-grid article, .stat-item, .tip-card');
  sections.forEach((el) => {
    el.classList.add('fade-in');
    observer.observe(el);
  });
}

// ─── Smooth Nav Scroll ──────────────────────────────────────────────────────────

/**
 * Add smooth scrolling to nav links with offset for fixed nav.
 */
function initSmoothScroll() {
  $$('nav a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        const offset = 80; // nav height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ─── Keyboard Accessibility ─────────────────────────────────────────────────────

/**
 * Add keyboard support for interactive elements.
 */
function initKeyboardSupport() {
  // Allow Enter/Space on card-like clickable elements
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Close any open modals or toasts
      const toasts = $$('.toast');
      toasts.forEach((t) => t.remove());
    }
  });
}

// ─── Mouse Glow Effect ──────────────────────────────────────────────────────────

/**
 * Track mouse position for glow effect on cards.
 */
function initMouseGlow() {
  document.addEventListener('mousemove', (event) => {
    $$('.card').forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

// ─── Counter Animation ──────────────────────────────────────────────────────────

/**
 * Animate stat counter values.
 */
function animateCounters() {
  $$('.stat-value').forEach((el) => {
    const target = el.textContent;
    if (target.includes('+')) return; // Skip "12+"
    const num = parseInt(target, 10);
    if (isNaN(num)) return;

    let current = 0;
    const duration = 1000;
    const step = Math.ceil(num / (duration / 16));
    const timer = setInterval(() => {
      current = Math.min(current + step, num);
      el.textContent = current;
      if (current >= num) clearInterval(timer);
    }, 16);
  });
}

// ─── Initialization ─────────────────────────────────────────────────────────────

// Initial render
update();
renderPledges();
renderHistory();

// Initialize UI enhancements
initScrollAnimations();
initSmoothScroll();
initKeyboardSupport();
initMouseGlow();

// Animate counters after a short delay
setTimeout(animateCounters, 500);
