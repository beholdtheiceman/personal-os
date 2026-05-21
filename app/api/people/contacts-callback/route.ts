// GET /api/people/contacts-callback — fetches Google Contacts and imports into Firestore
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

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

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const uid   = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !uid) {
    return NextResponse.redirect(`${req.nextUrl.origin}/people?error=contacts_oauth_denied`);
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri:  `${req.nextUrl.origin}/api/people/contacts-callback`,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description);

    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = (tokens.expires_in as number | undefined) ?? 3600;

    // Persist the integration so the chat tools (list_google_contacts, create_google_contact, etc.)
    // can refresh and call People API later. If refresh_token isn't returned (already authorized
    // previously without prompt:'consent'), preserve any existing one.
    {
      const db = getAdminDb();
      const integRef = db.doc(`users/${uid}/integrations/google_contacts`);
      const existing = await integRef.get();
      const existingRefresh = existing.exists ? (existing.data()?.refresh_token as string | undefined) : undefined;
      await integRef.set({
        access_token: accessToken,
        refresh_token: refreshToken ?? existingRefresh ?? null,
        expires_at: Date.now() + expiresIn * 1000,
        scope: "https://www.googleapis.com/auth/contacts",
        connected_at: new Date().toISOString(),
      }, { merge: true });
    }

    // Fetch all contacts from Google People API (paginated)
    const googlePeople: GooglePerson[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        personFields: "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,biographies",
        pageSize: "1000",
        ...(pageToken ? { pageToken } : {}),
      });

      const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      googlePeople.push(...(data.connections ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Load existing people to avoid duplicates
    const db = getAdminDb();
    const existingSnap = await db.collection(`users/${uid}/people`).get();
    const existingNames = new Set(
      existingSnap.docs.map((d) => (d.data().name as string)?.toLowerCase().trim())
    );

    // Map and write new contacts
    const now = new Date().toISOString();
    let imported = 0;
    let skipped  = 0;

    const batch = db.batch();
    for (const gp of googlePeople) {
      const mapped = mapPerson(gp, now);
      if (!mapped) continue;
      if (existingNames.has((mapped.name as string).toLowerCase())) { skipped++; continue; }
      const ref = db.collection(`users/${uid}/people`).doc();
      batch.set(ref, mapped);
      imported++;
    }
    await batch.commit();

    return NextResponse.redirect(
      `${req.nextUrl.origin}/people?imported=${imported}&skipped=${skipped}`
    );
  } catch (err) {
    console.error("Contacts import error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/people?error=contacts_import_failed`);
  }
}
