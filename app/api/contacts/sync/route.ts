// GET /api/contacts/sync — Vercel cron route
// Weekly: re-syncs Google Contacts for all users who have a connected google_contacts integration.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";

// ── Google People API types ──────────────────────────────────────────────────

interface GoogleName      { displayName?: string }
interface GoogleEmail     { value?: string }
interface GooglePhone     { value?: string }
interface GoogleOrg       { name?: string; title?: string }
interface GoogleAddress   { city?: string; region?: string }
interface GoogleBirthday  { date?: { year?: number; month?: number; day?: number } }
interface GoogleBio       { value?: string }

interface GooglePerson {
  names?:          GoogleName[];
  emailAddresses?: GoogleEmail[];
  phoneNumbers?:   GooglePhone[];
  organizations?:  GoogleOrg[];
  addresses?:      GoogleAddress[];
  birthdays?:      GoogleBirthday[];
  biographies?:    GoogleBio[];
}

// ── Helpers (mirrored from contacts-callback) ────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function buildBirthday(bd: GoogleBirthday): string | undefined {
  const d = bd.date;
  if (!d?.month || !d?.day) return undefined;
  const year = d.year ?? 1900;
  return `${year}-${pad(d.month)}-${pad(d.day)}`;
}

function mapPerson(g: GooglePerson, now: string): Record<string, unknown> | null {
  const name = g.names?.[0]?.displayName?.trim();
  if (!name) return null;

  const obj: Record<string, unknown> = {
    name,
    relationship: "other",
    created_at: now,
    updated_at: now,
  };

  const email = g.emailAddresses?.[0]?.value?.trim();
  if (email) obj.email = email;

  const phone = g.phoneNumbers?.[0]?.value?.trim();
  if (phone) obj.phone = phone;

  const org = g.organizations?.[0];
  if (org?.name) obj.company = org.title ? `${org.name} — ${org.title}` : org.name;

  const addr = g.addresses?.[0];
  if (addr?.city) obj.location = addr.region ? `${addr.city}, ${addr.region}` : addr.city;

  const bday = g.birthdays?.[0];
  if (bday) { const b = buildBirthday(bday); if (b) obj.birthday = b; }

  const bio = g.biographies?.[0]?.value?.trim();
  if (bio) obj.notes = bio.slice(0, 500);

  return obj;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: validate CRON_SECRET if set
  const cronSecret = getEnv("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getAdminDb();
  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;

  let checked = 0;
  const results: Array<{
    uid: string;
    status: "skipped" | "error" | "ok";
    reason?: string;
    updated?: number;
    created?: number;
  }> = [];

  try {
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      checked++;

      // ── Load integration doc ───────────────────────────────────────────────
      const integRef = db.doc(`users/${uid}/integrations/google_contacts`);
      const integSnap = await integRef.get();

      if (!integSnap.exists || !integSnap.data()?.refresh_token) {
        results.push({ uid, status: "skipped", reason: "no integration or missing refresh_token" });
        continue;
      }

      const integData = integSnap.data()!;
      const refreshToken = integData.refresh_token as string;

      // ── Refresh access token ───────────────────────────────────────────────
      let accessToken: string;
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type:    "refresh_token",
          }),
        });
        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error(tokens.error_description ?? tokens.error);
        accessToken = tokens.access_token as string;
        const expiresIn = (tokens.expires_in as number | undefined) ?? 3600;
        // Persist updated token
        await integRef.set(
          {
            access_token: accessToken,
            expires_at: Date.now() + expiresIn * 1000,
          },
          { merge: true },
        );
      } catch (err) {
        results.push({ uid, status: "error", reason: `token refresh failed: ${String(err)}` });
        continue;
      }

      // ── Fetch all contacts (paginated) ─────────────────────────────────────
      const googlePeople: GooglePerson[] = [];
      let pageToken: string | undefined;

      try {
        do {
          const params = new URLSearchParams({
            personFields: "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,biographies",
            pageSize: "1000",
            ...(pageToken ? { pageToken } : {}),
          });

          const res = await fetch(
            `https://people.googleapis.com/v1/people/me/connections?${params}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);

          googlePeople.push(...(data.connections ?? []));
          pageToken = data.nextPageToken;
        } while (pageToken);
      } catch (err) {
        results.push({ uid, status: "error", reason: `people API failed: ${String(err)}` });
        continue;
      }

      // ── Load existing people for matching ──────────────────────────────────
      const peopleSnap = await db.collection(`users/${uid}/people`).get();

      // Build lookup maps: email → docId, name (lowercase) → docId
      const emailToDocId = new Map<string, string>();
      const nameToDocId  = new Map<string, string>();
      for (const doc of peopleSnap.docs) {
        const d = doc.data();
        const existingEmail = (d.email as string | undefined)?.trim().toLowerCase();
        const existingName  = (d.name  as string | undefined)?.trim().toLowerCase();
        if (existingEmail) emailToDocId.set(existingEmail, doc.id);
        if (existingName)  nameToDocId.set(existingName, doc.id);
      }

      // ── Upsert contacts ────────────────────────────────────────────────────
      const now = new Date().toISOString();
      let updated = 0;
      let created = 0;

      // Use batched writes; Firestore batch limit is 500 ops — flush when needed
      let batch = db.batch();
      let batchCount = 0;

      const flushBatch = async () => {
        if (batchCount > 0) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      };

      for (const gp of googlePeople) {
        const mapped = mapPerson(gp, now);
        if (!mapped) continue;

        const email = (mapped.email as string | undefined)?.toLowerCase();
        const name  = (mapped.name  as string).toLowerCase();

        // Find existing doc: email match first, then name match
        let existingDocId: string | undefined =
          (email ? emailToDocId.get(email) : undefined) ?? nameToDocId.get(name);

        if (existingDocId) {
          // Update — preserve original created_at
          const { created_at: _drop, ...updateFields } = mapped;
          const ref = db.collection(`users/${uid}/people`).doc(existingDocId);
          batch.set(ref, { ...updateFields, updated_at: now }, { merge: true });
          updated++;
        } else {
          // Create new
          const ref = db.collection(`users/${uid}/people`).doc();
          batch.set(ref, mapped);
          // Register in maps so later entries in the same sync don't create dupes
          if (email) emailToDocId.set(email, ref.id);
          nameToDocId.set(name, ref.id);
          created++;
        }

        batchCount++;
        if (batchCount >= 400) await flushBatch();
      }

      await flushBatch();

      // ── Mark last_synced ───────────────────────────────────────────────────
      await integRef.set({ last_synced: now }, { merge: true });

      results.push({ uid, status: "ok", updated, created });
    }

    const synced_users = results.filter((r) => r.status === "ok").length;

    return NextResponse.json({ checked, synced_users, results });
  } catch (err) {
    console.error("contacts/sync error:", err);
    return NextResponse.json(
      { error: String(err), checked, results },
      { status: 500 },
    );
  }
}
