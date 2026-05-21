// POST /api/media/upload — uploads a local audio file to Vercel Blob, returns public URL
// Auth: Firebase ID token in Authorization header
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const maxDuration = 60;

function getAdminAuth() {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!clientEmail || !privateKey || privateKey === '""') {
    throw new Error("Firebase Admin not configured");
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getAuth();
}

const ALLOWED_EXTENSIONS = /\.(mp3|m4a|ogg|wav|webm|aac|flac)$/i;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Verify auth token
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      return NextResponse.json({ error: "Invalid token", detail: String(e) }, { status: 401 });
    }

    // 2. Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      return NextResponse.json({ error: "Failed to parse form data", detail: String(e) }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file instanceof File ? file.name : "track.mp3";

    // 3. Validate
    if (!ALLOWED_EXTENSIONS.test(fileName)) {
      return NextResponse.json({ error: `File type not allowed. Use: mp3, m4a, ogg, wav, webm, aac, flac` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max 50 MB, got ${(file.size / 1024 / 1024).toFixed(1)} MB)` }, { status: 400 });
    }

    // 4. Upload to Vercel Blob
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `crate/${uid}/${Date.now()}_${safeName}`;

    let blobUrl: string;
    try {
      const blob = await put(blobPath, file, {
        access: "public",
        contentType: file.type || "audio/mpeg",
        addRandomSuffix: false,
      });
      blobUrl = blob.url;
    } catch (e) {
      return NextResponse.json({ error: "Blob upload failed", detail: String(e) }, { status: 502 });
    }

    return NextResponse.json({ url: blobUrl });
  } catch (e) {
    console.error("[upload] unhandled error:", e);
    return NextResponse.json({ error: "Internal server error", detail: String(e) }, { status: 500 });
  }
}
