# Security Policy

## Overview

Carbon Compass is a client-side web application with no server-side code, no API keys, no user authentication, and no data transmission. All data processing and storage occurs exclusively in the user's browser.

## Security Measures

### Input Sanitization
- **`sanitizeText()`** strips all HTML tags, control characters (U+0000–U+001F, U+007F), and normalizes whitespace from user input before rendering or URL construction.
- Applied to all user-facing inputs: form fields, text areas, and any value used in Google URLs or rendered HTML.

### URL Encoding
- All user inputs used in Google Maps, Calendar, Gmail, and Search URLs are encoded via `encodeURIComponent()`.
- Prevents URL injection, parameter pollution, and open redirect attacks.

### CSV Formula Injection Prevention
- CSV export cells are wrapped in double quotes.
- Values starting with `=`, `+`, `-`, or `@` are prefixed with a single quote (`'`) to prevent spreadsheet formula execution attacks when imported into Google Sheets or Excel.

### No Secrets or API Keys
- The platform uses Google URL deep linking — no OAuth tokens, API keys, or service accounts required.
- No `.env` files, no secret management, no server-side proxying.

### No External Tracking
- No analytics scripts, tracking pixels, or third-party cookies.
- No data is transmitted to any external server.
- All user data stays in `localStorage` on the user's device.

### Content Security Policy (CSP) Readiness
- No inline scripts (all JS in external modules).
- No `eval()`, `new Function()`, or dynamic code execution.
- Safe for strict CSP headers deployment.

## Data Storage

| Data | Storage | Persistence | Encryption |
|------|---------|-------------|------------|
| User inputs | In-memory (form state) | Session only | N/A |
| Pledges | localStorage | Persistent | Plain text |
| Assessment history | localStorage | Persistent | Plain text |
| Exported CSV/JSON | User's filesystem | User-managed | N/A |

## Threat Model

| Threat | Mitigation | Status |
|--------|------------|--------|
| XSS via user input | HTML sanitization, no `innerHTML` from user data | ✅ Mitigated |
| URL injection | `encodeURIComponent()` on all URL parameters | ✅ Mitigated |
| CSV formula injection | Quote-prefixing on `=`, `+`, `-`, `@` characters | ✅ Mitigated |
| API key exposure | No API keys used | ✅ N/A |
| Data interception | No network transmission | ✅ N/A |
| CSRF | No server-side state | ✅ N/A |
| Supply chain attacks | Zero npm runtime dependencies | ✅ Mitigated |

## Reporting

If you discover a security issue, please open a GitHub issue or contact the repository maintainer.

## Dependencies

**Runtime:** Zero (no npm packages used in production)  
**Development:** Node.js native test runner only (no test framework packages)
