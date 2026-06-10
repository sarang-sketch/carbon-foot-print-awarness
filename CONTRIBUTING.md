# Contributing to Carbon Compass

Thank you for your interest in contributing! This guide covers our coding standards,
testing practices, and submission guidelines.

## 🏗️ Architecture Overview

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

```
src/
├── config.js         # Centralized constants, thresholds, and URLs
├── validators.js     # Input validation with Result pattern
├── security.js       # Sanitization, encoding, CSV safety, rate limiting
├── footprint.js      # Core calculation engine (pure functions)
├── google-tools.js   # Google tool URL builders (15+ services)
├── analytics.js      # Statistics, trend analysis, report generation
├── accessibility.js  # WCAG compliance utilities
├── storage.js        # localStorage abstraction with error handling
└── app.js            # UI controller (DOM manipulation, events)
```

## 📐 Coding Standards

### General Principles
- **Pure functions** where possible — deterministic, no side effects
- **Object.freeze()** on all exported constants
- **JSDoc** on every exported function and type
- **No runtime dependencies** — zero npm packages in production
- **ES Modules** only — no CommonJS `require()`

### Naming Conventions
- **Files**: `kebab-case.js`
- **Functions**: `camelCase` (verbs: `buildMapsUrl`, `validateNumber`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `EMISSION_FACTORS`)
- **Types/Interfaces**: `PascalCase` in JSDoc `@typedef`

### Security Rules
- All user input must pass through `sanitizeHtml()` before rendering
- All URL parameters must use `encodeUrlParam()` or `encodeURIComponent()`
- CSV exports must use `escapeCsvCell()` for formula injection prevention
- No `eval()`, `new Function()`, or `innerHTML` with user data
- No API keys, tokens, or secrets anywhere in the codebase

### Accessibility Rules
- Every interactive element must have a unique `id`
- All images/SVGs must have `alt` text or `aria-label`
- Form inputs must have associated `<label>` elements
- Dynamic content must use `aria-live` regions
- Animations must respect `prefers-reduced-motion`

## 🧪 Testing

### Running Tests
```bash
npm test           # Run all 213 tests
npm run validate   # Lint + test + size check
```

### Test Structure
```
tests/
├── footprint.test.js       # Core calculation tests
├── google-tools.test.js    # URL builder tests
├── security.test.js        # Sanitization & safety tests
├── validators.test.js      # Input validation tests
├── analytics.test.js       # Statistics & reporting tests
└── accessibility.test.js   # Contrast ratio & WCAG tests
```

### Writing Tests
- Use Node.js native test runner (`node:test`)
- Use strict assertions (`node:assert/strict`)
- Test edge cases: `null`, `undefined`, `NaN`, `Infinity`, empty strings
- Test security: HTML injection, formula injection, URL injection
- Every new function must have at least one test

## 📊 Size Budget

Repository must stay under **10 MB**:
```bash
npm run size  # Check current usage
```

## 🔄 Workflow

1. Create a feature branch
2. Make your changes following the standards above
3. Run `npm run validate` — all checks must pass
4. Submit a pull request with a clear description

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.
