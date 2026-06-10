# Architecture

## System Design

Carbon Compass follows a modular, layered architecture with strict
separation of concerns. Each module has a single responsibility and
communicates through well-defined interfaces.

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer                          │
│                    app.js                            │
│     DOM manipulation, events, rendering, toast       │
├─────────────┬───────────┬──────────┬────────────────┤
│   Google    │  Storage  │ Access-  │   Analytics    │
│   Tools     │  Layer    │ ibility  │   & Reports    │
│ google-     │ storage.  │ access-  │  analytics.    │
│ tools.js    │ js        │ ibility. │  js            │
│             │           │ js       │                │
├─────────────┴───────────┴──────────┴────────────────┤
│                 Core Engine                          │
│                footprint.js                          │
│    calculate, classify, rank, plan, export           │
├──────────────────┬──────────────────────────────────┤
│    Security      │         Validators               │
│   security.js    │        validators.js              │
│  sanitize, CSV,  │   validate, coerce, Result       │
│  URL, CSP, rate  │   pattern, form validation       │
├──────────────────┴──────────────────────────────────┤
│                Configuration                        │
│                 config.js                            │
│   constants, thresholds, URLs, keys, limits          │
└─────────────────────────────────────────────────────┘
```

## Module Responsibilities

### config.js — Configuration Constants
- Emission factors with EPA/DEFRA sources
- Scoring thresholds
- Google base URLs
- Storage keys
- Application limits
- All values are `Object.freeze()` immutable

### validators.js — Input Validation
- Result pattern: `{ valid, value, error }`
- Field-specific validators (electricity, gas, distance, flights, meals)
- Text validators with length limits
- Commute mode and goal selectors
- Compound form validator

### security.js — Security Utilities
- `sanitizeHtml()` — HTML tag stripping, control char removal
- `encodeUrlParam()` — URL parameter encoding with pre-sanitization
- `isAllowedUrl()` — URL scheme validation (prevents javascript:)
- `escapeCsvCell()` — CSV formula injection prevention
- `buildSafeCsv()` — Full CSV generation with protection
- `safeJsonStringify()` — Circular reference protection
- `generateCspHeader()` — Content Security Policy generation
- `createRateLimiter()` — Token bucket rate limiting

### footprint.js — Core Calculation Engine
- `calculateFootprint()` — Monthly CO₂e from raw inputs
- `classifyScore()` — Three-tier scoring (green/amber/red)
- `rankCategories()` — Category sorting with percentages
- `buildActionPlan()` — Context-aware action recommendations
- `buildComparisons()` — Tangible equivalents (trees, burgers, flights)
- All functions are pure — no side effects, deterministic

### google-tools.js — Google Tool Integration
- `buildMapsUrl()` — Transit direction URLs
- `buildMapsComparisonUrls()` — Multi-mode comparison
- `buildCalendarUrl()` — Event creation URLs
- `buildMonthlyReviewUrl()` — Recurring review events
- `buildGmailUrl()` — Compose email URLs
- `buildShareActionPlanUrl()` — Action plan sharing
- `buildSearchUrl()` — Category-specific queries
- `buildShoppingUrl()` — Eco product discovery
- `buildEarthUrl()` — Climate visualization
- `buildTrendsUrl()` — Sustainability analytics
- `buildScholarUrl()` — Research access
- `buildYouTubeUrl()` — Video content
- `buildGeminiPrompt()` — AI coaching prompts
- `buildDetailedGeminiPrompt()` — Full context prompts
- `getAllToolIntegrations()` — Complete tool registry

### analytics.js — Analytics & Reporting
- Statistical functions (average, median, minMax, standardDeviation)
- Linear regression trend analysis
- Category analysis across assessments
- Enhanced equivalents (8 comparison metrics)
- Text report generation
- Summary generation with highlights

### accessibility.js — WCAG 2.1 AA Compliance
- ARIA live region management
- Focus management and trapping
- Keyboard navigation helpers
- Reduced motion detection
- Color contrast ratio calculation
- WCAG AA compliance checking
- Screen reader text generation

### storage.js — Data Persistence
- Safe localStorage read/write/remove
- Private browsing and quota error handling
- Pledge CRUD operations with validation
- Assessment history with limit enforcement
- User preferences management
- History statistics with trend detection

### app.js — UI Controller
- DOM event binding and delegation
- Form state management
- Dynamic rendering with template literals
- Toast notification system
- Scroll-triggered animations
- SVG chart rendering
- Debounced input handling

## Data Flow

```
User Input → validators.js → footprint.js → analytics.js
                                    ↓
                            google-tools.js → Google URLs
                                    ↓
                              app.js → DOM Rendering
                                    ↓
                            storage.js → localStorage
```

## Security Boundary

```
User Input → sanitizeHtml() ──→ All rendering paths
                              ──→ encodeUrlParam() → Google URLs
                              ──→ escapeCsvCell() → CSV export
                              ──→ safeJsonStringify() → JSON export
```

## Design Decisions

1. **Zero runtime dependencies** — Avoids supply chain attacks, keeps bundle tiny
2. **Pure functions in core** — Enables comprehensive testing without mocking
3. **Result pattern for validation** — Predictable error handling without exceptions
4. **Object.freeze on constants** — Prevents accidental mutation
5. **localStorage abstraction** — Graceful fallback for private browsing
6. **Client-side only** — No server, no API keys, maximum privacy
7. **URL-based Google integration** — No OAuth complexity, instant action
