# 🔐 Weekly Security Report — May 30, 2026

## Overall Status: 🟡 Needs Attention

One high-severity issue requires attention this month (a Firebase SDK update). Everything else is in reasonable shape — no secrets leaked, no .env files in git, and your security headers are genuinely well-configured.

---

## Critical & High Priority (fix this week)

### 🔴 Firebase SDK is running vulnerable networking code (undici)

**What it is:** Your Firebase packages (firebase 10.14.1) bundle an older version of `undici`, which is the internal networking library Node.js uses to make HTTP requests. That older version has 8 known security issues.

**Why it matters in plain English:** The most serious ones could let a malicious server:
- Crash your app by sending an oversized WebSocket message
- Exhaust your server's memory via a specially crafted HTTP response
- Inject unexpected behavior into HTTP requests/responses ("request smuggling")

These are harder to exploit than a simple "click this link" attack — they generally require a compromised external service or a network attacker. But since this app talks to Firebase, Anthropic, and Plaid, the attack surface is real.

**CVSS scores:** Three issues score 7.5/10 (High). The rest are Moderate (4.6–6.8).

**How to fix it:**
```bash
cd /path/to/personal-os
npm install firebase@latest
```
This upgrades Firebase from 10.14.1 → 12.14.0, which includes the fixed `undici`. Test auth, Firestore reads/writes, and push notifications after upgrading — Firebase 12 has some API changes from v10.

---

## Medium Priority (fix within 2–4 weeks)

### 🟡 Next.js is due for an upgrade (bundles old PostCSS)

**What it is:** Your Next.js version (15.5.18) bundles an older version of PostCSS, which has a moderate XSS vulnerability — a specially crafted CSS string containing `</style>` could inject HTML into a page.

**Why it matters:** Only a risk if your app renders user-supplied CSS, which it likely doesn't. Still worth fixing.

**How to fix:**
```bash
npm install next@latest eslint-config-next@latest
```
This goes from 15.5.18 → 16.2.6. Check the [Next.js 16 upgrade guide](https://nextjs.org/docs/upgrading) for any breaking changes before deploying.

### 🟡 Firebase Admin SDK has moderate uuid issues

**What it is:** `firebase-admin` (server-side) depends on Google Cloud libraries that use an older version of `uuid`, which can generate less-random IDs in some environments.

**Why it matters:** Less-random IDs could theoretically be guessed, but this is low-likelihood in practice. Still a good cleanup item.

**How to fix:**
```bash
npm install firebase-admin@latest
```
Check that your server-side admin initialization code still works after upgrading.

### 🟡 Anthropic SDK is very outdated

**What it is:** You're on `@anthropic-ai/sdk` version 0.36.3. The current version is 0.100.1 — that's a significant gap (64 minor versions).

**Why it matters:** Newer versions have bug fixes, new model support, and improved streaming. You're likely missing features and could hit unexpected behavior. Not a CVE, but a meaningful maintenance gap given this is core to your app.

**How to fix:**
```bash
npm install @anthropic-ai/sdk@latest
```
Check your AI API calls after upgrading — there may be minor interface changes in the SDK between major versions.

---

## Low / Informational (good to know)

**Content Security Policy uses `unsafe-inline`** — Your CSP is good overall, but allows inline scripts/styles (required by Next.js). Your code comment notes this should be tightened with nonces in a future pass. That's the right plan — no action needed now, just keep it on the roadmap.

**Vercel Authentication is disabled** — Noted in your config file. Presumably intentional since this is a personal app you access from multiple places. Just confirming it's a known setting.

**Several major version upgrades available** — TypeScript 5 → 6, Tailwind 3 → 4. These are not security issues, just maintenance. Tailwind 4 in particular has significant config changes — save for a dedicated upgrade session.

**Missing HSTS header** — `Strict-Transport-Security` isn't set in your Next.js config. In practice, Vercel adds this header automatically at the edge, so this is likely a non-issue. But if you ever run this app locally over HTTP or on a different host, it won't be enforced.

---

## Stack-Specific Advisories

**Next.js 16** released in May 2026 — the main security-relevant change is the updated Turbopack bundler and stricter CSP handling. No new CVEs in 15.x this week.

**Firebase v12** (the fix target above) deprecated several legacy compat APIs (`firebase/compat/*`). If your code imports from those paths, you'll need to migrate to the modular SDK. Check your imports before upgrading.

**Node.js 20 LTS** (which you appear to be using based on `@types/node`) remains in active support through April 2026 — you're current. No urgent action.

**Plaid SDK** — No new CVEs reported this week for the Plaid JavaScript SDK.

---

## What Looked Good ✅

- **No hardcoded secrets** — scanned all `.ts`, `.tsx`, `.js`, and `.json` files in the repo. Zero API keys, passwords, or tokens found in source code.
- **No .env files committed to git** — only `.env.local.example` (the blank template) is tracked. Your actual `.env.local` with real keys is properly gitignored.
- **Security headers are well-configured** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a thorough Content-Security-Policy are all set in `next.config.js`. This is better than most personal projects.
- **`frame-ancestors: none`** in CSP — prevents clickjacking. Good.
- **`object-src: none`** in CSP — blocks Flash/plugin-based attacks. Good.
- **Firebase config in NEXT_PUBLIC_ vars** — this looks alarming but is intentional and correct. Firebase web config (API key, project ID, etc.) is designed to be public — it identifies your project but doesn't grant admin access. Your Firebase Security Rules are what actually protect your data.

---

## Recommended Action This Week

1. `npm install firebase@latest` — fixes the high-severity undici issues
2. Test the app (auth, Firestore, push notifications)
3. `npm install firebase-admin@latest` — fixes the uuid moderate issues
4. Schedule the Next.js 16 upgrade for next week

Total estimated dev time: ~2 hours including testing.
