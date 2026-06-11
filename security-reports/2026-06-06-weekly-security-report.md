# 🔐 Weekly Security Report — June 6, 2026

*App: personal-os (Next.js + Firebase + Plaid, deployed on Vercel)*
*Scan run automatically. Interpreted with the cybersecurity skill (754-procedure library).*

## Overall Status: 🟢 Healthy

This was a clean week. No secrets are leaking, your environment files are handled correctly, your security headers are strong, and — importantly — your two biggest dependencies (Next.js and React) are both sitting on the exact versions that fix the big May 2026 security wave. Someone updated them recently and did it right.

There is **one medium item** worth a quick look (an out-of-date helper library buried deep in your dependencies) and a couple of low/housekeeping notes. Nothing here is on fire.

One caveat about this run: the scanner could not reach the npm registry (the internet service that lists known-vulnerable packages), so the live `npm audit` and `npm outdated` checks couldn't complete. Instead I compared the exact versions you have installed against this week's published vulnerabilities by hand. That covers the high-impact cases, but a full live `npm audit` should still be run when network access is available (see Low Priority).

---

## Critical & High Priority (fix this week)

**None.** Nothing critical or high-severity was found.

For context, this is meaningful: the two most serious things going around right now are a wave of Next.js flaws and a matching React flaw, both from the May 2026 security releases. You're already patched against both:

- **Next.js** — you're on **15.5.18**, which is the official patched version for the 13 CVEs disclosed in May 2026 (denial-of-service, request-smuggling, SSRF, cache poisoning, XSS). No action needed.
- **React / React-DOM** — you're on **19.2.6**, which is the exact version that fixes CVE-2026-23870 (a denial-of-service bug in React Server Components). The vulnerable range stopped at 19.2.5, so you're clear. No action needed.

---

## Medium Priority (fix within 2–4 weeks)

**1. An old networking helper (`undici`) is bundled deep inside your dependencies**

- **What it is, plainly:** `undici` is a small library that other libraries (Firebase, Google Cloud) use to make web requests on your behalf. You don't call it directly — it rides along as a "dependency of a dependency." You have version **6.19.7**, while the current safe 6.x version is **6.21.1 or later**.
- **Why it matters:** Older `undici` versions had a bug where, if a request got redirected, sensitive headers (like an auth token or cookie) could be forwarded on to the redirect target. For your app the practical risk is low because it's used internally by Google's SDKs, but it's behind on patches and worth clearing.
- **What to do:** Run `npm update undici` (or, more reliably, `npm audit fix`) when you have internet access, then redeploy. If your dependencies pin it, your developer can add an `overrides` entry in `package.json` to force `undici@^6.21.1`. A one-line fix.

**2. Confirm your Firebase access rules are locked down (housekeeping, not a code bug)**

- **What it is, plainly:** Your app exposes seven `NEXT_PUBLIC_FIREBASE_*` values to the browser. **This is correct and expected** — Firebase's client keys are *designed* to be public; they're identifiers, not passwords. The catch is that, with Firebase, your real security wall is the **Firestore/Storage security rules** on Google's side, not the keys.
- **Why it matters:** If those rules were ever left open ("anyone can read/write"), the public keys would let someone reach your data directly. The keys being public is fine; loose rules would not be.
- **What to do:** In the Firebase console, confirm Firestore and Storage rules require an authenticated user (and ideally scope each user to their own records). Also, in Google Cloud console, add **API key restrictions** (limit the browser key to your own domain and to the Firebase APIs you actually use). No code change needed.

---

## Low / Informational (good to know)

- **Run a full `npm audit` when online.** This run couldn't reach the npm registry, so the live vulnerability database wasn't consulted. From a developer machine or CI, run `npm audit` (and `npm audit fix`) to catch anything the manual version-check might have missed. This is the single most useful follow-up.
- **Firebase client SDK is a major version behind.** You're on `firebase` **10.14.1**; the 11.x/12.x lines are out. No known vulnerability forces an upgrade today, but plan a migration at some point so you don't fall too far behind. Your server-side `firebase-admin` is current (**13.10.0**).
- **CSP uses `'unsafe-inline'` for scripts.** Your Content-Security-Policy is otherwise excellent, but it allows inline scripts, which slightly weakens its XSS protection. Your own code comment already flags this as a "tighten to nonces later" item — agreed, it's a nice-to-have, not urgent.
- **No hardcoded secrets found.** The source-code scan for API keys, tokens, and passwords came back completely empty. 👍

---

## Stack-Specific Advisories (new this week)

- **Next.js — May 2026 security release (13 CVEs).** A large coordinated patch covering DoS (CVE-2026-23870/23869), SSRF via WebSocket upgrades (CVE-2026-44578), and a middleware-authorization bypass on the Pages Router with i18n (CVE-2026-44573). **Fixed in 15.5.18 / 16.2.6 — you're on 15.5.18, so covered.**
- **React Server Components — CVE-2026-23870 (DoS, CVSS 7.5).** Crafted requests to a server-function endpoint can spike CPU. **Fixed in 19.2.6 — you're on 19.2.6, so covered.**
- **firebase-admin / Google Cloud Storage — CVE-2026-25128.** A flaw in `fast-xml-parser` (a Google Cloud Storage dependency) was fixed by bumping `@google-cloud/storage` to 7.19.0. **You have @google-cloud/storage 7.19.0 and fast-xml-parser 5.8.0 — already patched.**
- **Plaid SDK (42.2.0):** No new advisories surfaced this week. Keep an eye out, since it touches financial data, but nothing actionable right now.
- **Node.js (running v22):** No new critical Node advisories relevant to this stack this week.

---

## What Looked Good ✅

- **No secrets in the code.** Clean scan for keys, tokens, and passwords.
- **Environment files handled correctly.** `.env.local` is *not* tracked in git; only the safe `.env.local.example` template is committed. Your `.gitignore` explicitly excludes all `.env*` variants, `*.pem` files, and the local database.
- **Strong security headers** in `next.config.js`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy`, and a thorough Content-Security-Policy with `frame-ancestors 'none'`, `base-uri 'self'`, and `object-src 'none'`.
- **Scheduled (cron) endpoints are protected.** All 13 Vercel cron jobs map to API routes that check a `CRON_SECRET` before running — so an outsider can't trigger your daily-briefing, Plaid-sync, or Gmail-agent jobs by guessing the URL.
- **Top-line dependencies are current and patched** — Next.js 15.5.18, React 19.2.6, firebase-admin 13.10.0, @google-cloud/storage 7.19.0. Whoever updated these recently did exactly the right thing.

---

### One-line summary for the week
You're in good shape. Do one small thing soon — bump the bundled `undici` library to 6.21.1+ (via `npm audit fix`) and run a full `npm audit` from an online machine — and otherwise just keep doing what you're doing.

*Scan limitations: npm registry was unreachable from the scan environment, so live `npm audit`/`npm outdated` did not run; findings above are from a manual version-vs-CVE comparison plus full local code, config, git, and secrets scans. Re-run `npm audit` with network access to confirm.*
