// GET /api/drive/file?uid=&id= — read file content (exports Google Docs as plain text)
import { NextRequest, NextResponse } from "next/server";
import { refreshDriveToken } from "@/lib/drive-token";

const GOOGLE_DOC_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const id  = req.nextUrl.searchParams.get("id");

  if (!uid || !id) return NextResponse.json({ error: "Missing uid or id" }, { status: 400 });

  try {
    const accessToken = await refreshDriveToken(uid);
    const auth = { Authorization: `Bearer ${accessToken}` };

    // First get file metadata to know the mimeType
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,size`,
      { headers: auth }
    );
    const meta = await metaRes.json();
    if (meta.error) return NextResponse.json({ error: meta.error.message }, { status: 400 });

    const exportMime = GOOGLE_DOC_TYPES[meta.mimeType];

    let content = "";

    if (exportMime) {
      // Google Workspace doc — export as plain text
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { headers: auth }
      );
      content = await exportRes.text();
    } else if (meta.mimeType?.startsWith("text/") || meta.mimeType === "application/json") {
      // Plain text or JSON file — download directly
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        { headers: auth }
      );
      content = await dlRes.text();
    } else {
      return NextResponse.json({
        error: `Cannot read file type: ${meta.mimeType}. Only Google Docs, Sheets, Slides, and plain text files are supported.`,
      }, { status: 400 });
    }

    // Trim to 50k chars to avoid context blowout
    const trimmed = content.length > 50000
      ? content.slice(0, 50000) + "\n\n[...content truncated at 50,000 characters]"
      : content;

    return NextResponse.json({ name: meta.name, mimeType: meta.mimeType, content: trimmed });
  } catch (err) {
    console.error("Drive file error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
