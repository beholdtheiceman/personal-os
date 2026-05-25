# Password Vault Integration — Implementation Guide

## Overview

Surface your password manager inside the app so you can look up credentials, generate strong passwords, and flag reused or weak passwords — without ever storing secrets in your own database. The app acts as a secure interface, not a second vault.

**Estimated effort:** 1–2 days  
**Recommended approach:** Bitwarden (self-host option, open-source, has a real REST API)  
**Alternative:** 1Password (excellent API but paid; better for teams)  
**Hard no:** Building your own credential storage — never store raw passwords in Firestore

---

## Why Bitwarden

- Open-source; you can audit the encryption
- Free tier covers everything you need
- Has a proper **REST API** (Bitwarden Vault Management API via the CLI server)
- Can be self-hosted on a $5/month VPS if you want full control
- The CLI (`bw`) can be wrapped as a server-side process for API calls

---

## Architecture Options

### Option A: Bitwarden CLI wrapper (Recommended for self-hosters)

Run `bw serve` as a sidecar process. It exposes a local HTTP API on port 8087 that your app calls server-side. Your Bitwarden master password unlocks the vault once per session.

```
Personal OS Server
       │
       ├─ /api/vault/* ──────────────────► bw serve (localhost:8087)
       │                                          │
       │                                          ▼
       │                               Bitwarden cloud / self-hosted
       │                               (encrypted vault, you have the key)
       │
       ◄── encrypted credentials returned, decrypted locally by bw
```

### Option B: Bitwarden Public API (for cloud users)

Bitwarden's cloud API requires an API key (client_id + client_secret from your account). Returns items from the vault but requires server-side decryption using the SDK.

### Option C: Read-only import (simplest, least useful)

Export your vault as an encrypted JSON from Bitwarden, import once into an app-specific encrypted store. No ongoing sync. Useful only if you don't need live data.

**Recommendation: Option A if you can run a persistent server process; Option B if fully serverless (Vercel).**

---

## Option A: CLI Wrapper Implementation

### Prerequisites

Install the Bitwarden CLI on your server:
```bash
npm install -g @bitwarden/cli
bw login  # authenticate once
bw unlock  # generates session key
bw serve --port 8087 &  # start the local API server
```

Store the session key as an env var: `BW_SESSION=your_session_key`

### `app/api/vault/search/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

const BW_BASE = "http://localhost:8087";

async function bwFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BW_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

// Unlock vault (call this if session expires)
async function unlockVault() {
  return bwFetch("/unlock", {
    method: "POST",
    body: JSON.stringify({ password: process.env.BW_MASTER_PASSWORD }),
  });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { uid } = await getAdminAuth().verifyIdToken(token!);

  const query = req.nextUrl.searchParams.get("q") || "";
  
  // Search vault items
  const data = await bwFetch(`/list/object/items?search=${encodeURIComponent(query)}`);

  if (data.success === false) {
    // Session expired — try to unlock
    await unlockVault();
    const retry = await bwFetch(`/list/object/items?search=${encodeURIComponent(query)}`);
    return NextResponse.json(sanitizeItems(retry.data?.data || []));
  }

  return NextResponse.json(sanitizeItems(data.data?.data || []));
}

// NEVER return passwords to the client — return metadata only
function sanitizeItems(items: any[]) {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    username: item.login?.username || "",
    uris: item.login?.uris?.map((u: any) => u.uri) || [],
    hasTotp: !!item.login?.totp,
    notes: item.notes || null,
    folderId: item.folderId,
    type: item.type, // 1=login, 2=secure note, 3=card, 4=identity
    created: item.creationDate,
    modified: item.revisionDate,
  }));
}
```

### `app/api/vault/password/route.ts`

```ts
// Get just the password for a specific item — never cached, never logged
export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { uid } = await getAdminAuth().verifyIdToken(token!);
  
  const { itemId } = await req.json();
  
  const data = await bwFetch(`/object/item/${itemId}`);
  
  // Return only the password, directly — client should use it and discard
  return NextResponse.json({
    password: data.data?.login?.password || null,
    totp: data.data?.login?.totp || null,
  });
}
```

### `app/api/vault/generate/route.ts`

```ts
// Generate a strong password using bw's built-in generator
export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  await getAdminAuth().verifyIdToken(token!);

  const { length = 20, uppercase = true, numbers = true, special = true } = await req.json();

  const params = new URLSearchParams({
    length: String(length),
    uppercase: String(uppercase),
    number: String(numbers),
    special: String(special),
  });

  const data = await bwFetch(`/generate?${params}`);
  return NextResponse.json({ password: data.data?.data });
}
```

---

## Option B: Bitwarden API (Cloud, Serverless)

For Vercel deployments where you can't run a persistent process:

```ts
// lib/bitwarden-api.ts
const BW_IDENTITY = "https://identity.bitwarden.com";
const BW_API = "https://api.bitwarden.com";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getBWToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  const res = await fetch(`${BW_IDENTITY}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "api",
      client_id: process.env.BW_CLIENT_ID!,
      client_secret: process.env.BW_CLIENT_SECRET!,
    }),
  });

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function searchVaultItems(query: string) {
  const token = await getBWToken();
  const res = await fetch(`${BW_API}/ciphers?search=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Note: items returned are still encrypted; you need the Bitwarden SDK
  // to decrypt them client-side or via a self-hosted server
  return res.json();
}
```

> **Note:** The Bitwarden cloud API returns encrypted ciphers. Full decryption requires the Bitwarden SDK and your master password — this is by design. For a true serverless implementation, consider the [Bitwarden Secrets Manager](https://bitwarden.com/products/secrets-manager/) instead, or use the SDK in a serverless function that accepts the master password once per session and holds the decrypted vault in memory.

---

## UI — Vault Page

```
┌──────────────────────────────────────────────┐
│  🔒 Vault                    [+ Generate]     │
│                                              │
│  🔍 [Search passwords...]                    │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🌐 Google                            │   │
│  │   larry@gmail.com                    │   │
│  │   accounts.google.com                │   │
│  │   [Copy user] [Copy pass] [Open]     │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ 💳 Chase Bank                        │   │
│  │   larry_sports                       │   │
│  │   chase.com                          │   │
│  │   [Copy user] [Copy pass] [Open]     │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

Security notes for the UI:
- Passwords shown only on explicit user tap, hidden after 30 seconds
- Copy to clipboard, then auto-clear clipboard after 60 seconds
- No passwords stored in React state longer than the copy operation
- Session requires re-authentication after 15 minutes of inactivity

---

## Password Health Check

A background scan that surfaces:
- **Reused passwords** — same password hash across multiple items
- **Weak passwords** — short, no special chars, common patterns
- **Old passwords** — items not updated in 2+ years

```ts
// app/api/vault/health/route.ts
// Returns stats only, not actual passwords
// e.g., { weak: 3, reused: 7, old: 12, total: 89 }
```

Show as a "Vault Health" card on the `/vault` page and optionally on the dashboard.

---

## Chat Tools

Keep vault tools read-only and metadata-only from chat — never return actual passwords through the LLM:

```ts
{ 
  name: "search_vault", 
  description: "Search password vault for a login by site name or username. Returns metadata only (no passwords).",
  input_schema: { 
    type: "object", 
    properties: { query: { type: "string" } },
    required: ["query"]
  } 
},
{ 
  name: "generate_password", 
  description: "Generate a strong random password",
  input_schema: { 
    type: "object", 
    properties: { 
      length: { type: "number" },
      include_special: { type: "boolean" }
    } 
  } 
},
{
  name: "get_vault_health",
  description: "Get a summary of password health (weak, reused, old — counts only)",
  input_schema: { type: "object", properties: {} }
},
```

**Critical:** The LLM (Claude) should never see actual passwords. The `search_vault` tool returns username + URL only. If the user asks Claude to "get my Chase password," Claude should direct them to the vault UI rather than returning it through chat.

---

## Security Hardening

- All vault API routes require Firebase ID token verification
- `BW_MASTER_PASSWORD` and `BW_SESSION` stored in Vercel environment secrets, never in code
- Vault routes excluded from any response caching
- Audit log: every vault access writes to `users/{uid}/vault_access_log` (timestamp, item name only — not password)
- Rate limit vault endpoints: max 30 requests/minute per user
- Consider requiring a second factor (PIN) before any vault access within the app

---

## Env Vars

```
# Option A (CLI)
BW_MASTER_PASSWORD=your_master_password
BW_SESSION=auto_populated_by_bw_unlock

# Option B (Cloud API)
BW_CLIENT_ID=user.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BW_CLIENT_SECRET=your_client_secret
```

Get these from: Bitwarden Settings → Security → API Key

---

## Suggested Build Order

1. Set up `bw serve` on a persistent server or Render.com (not Vercel — serverless can't run background processes)
2. Build `/api/vault/search` with sanitized responses
3. Build `/vault` page with search + copy-to-clipboard
4. Password generator
5. Vault health check
6. Chat tools (metadata only)
7. Dashboard health badge
