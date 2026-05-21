// POST /api/media/upload — uploads a local MP3 to Vercel Blob, returns public URL
// Auth: Firebase ID token in Authorization header
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ADMIN_CONFIGURED =
  !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  !!process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY !== '""';

function getAdminAuth() {
  if (!ADMIN_CONFIGURED) throw new Error("Firebase Admin not configured");
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getAuth();
}

const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/webm"];
const MAX_SIZE_MB = 50;

export async function POST(req: NextRequest) {
  // Verify Firebase ID token
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|m4a|ogg|wav|webm)$/i)) {
    return NextResponse.json({ error: "Only audio files are allowed" }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File too large (max ${MAX_SIZE_MB}MB)` }, { status: 400 });
  }

  // Sanitize filename and scope under user's uid so uploads are namespaced
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `suno/${uid}/${Date.now()}_${safeName}`;

  const blob = await put(blobPath, file, {
    access: "public",
    contentType: file.type || "audio/mpeg",
  });

  return NextResponse.json({ url: blob.url });
}
