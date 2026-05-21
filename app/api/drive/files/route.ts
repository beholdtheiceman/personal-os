// GET /api/drive/files?uid=&q=&pageToken= — list/search Drive files
import { NextRequest, NextResponse } from "next/server";
import { refreshDriveToken } from "@/lib/drive-token";

const FIELDS = "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents),nextPageToken";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? "";
  const folderId = req.nextUrl.searchParams.get("folderId") ?? "";

  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const accessToken = await refreshDriveToken(uid);

    // Build query
    let query = "trashed = false";
    if (q) {
      query += ` and (name contains '${q.replace(/'/g, "\\'")}' or fullText contains '${q.replace(/'/g, "\\'")}')`;
    }
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    const params = new URLSearchParams({
      q: query,
      fields: FIELDS,
      orderBy: q ? "relevance" : "modifiedTime desc",
      pageSize: "50",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (data.error) return NextResponse.json({ connected: false, files: [], error: data.error.message ?? JSON.stringify(data.error) });

    return NextResponse.json({
      connected: true,
      files: data.files ?? [],
      nextPageToken: data.nextPageToken ?? null,
    });
  } catch (err) {
    console.error("Drive files error:", err);
    return NextResponse.json({ connected: false, files: [], error: String(err) });
  }
}
