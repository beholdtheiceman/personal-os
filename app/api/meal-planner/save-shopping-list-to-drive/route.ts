// POST /api/meal-planner/save-shopping-list-to-drive
// Body: { weekStart: "YYYY-MM-DD" }
// Builds the shopping list .docx and uploads it to the user's Google Drive,
// auto-converting to a Google Doc so they can edit it inline on any device.
// Returns { fileId, webViewLink, name }.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { refreshDriveToken } from "@/lib/drive-token";
import { buildShoppingListDocx, type ShoppingListDocItem } from "@/lib/shopping-list-docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GDOC_MIME = "application/vnd.google-apps.document";

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { weekStart } = (await req.json()) as { weekStart?: string };
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "Missing or invalid weekStart" }, { status: 400 });
    }

    // 1. Load the list
    const snap = await getAdminDb().doc(`users/${decoded.uid}/shopping_lists/${weekStart}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "No shopping list for that week" }, { status: 404 });
    }
    const items = ((snap.data()?.items ?? []) as ShoppingListDocItem[]);

    // 2. Build the .docx
    const docxBuffer = await buildShoppingListDocx(weekStart, items);

    // 3. Get a Drive access token. May throw "Drive not connected" if integration is missing,
    //    or "Token refresh failed" if the refresh token was revoked.
    let accessToken: string;
    try {
      accessToken = await refreshDriveToken(decoded.uid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Drive not connected";
      return NextResponse.json({ error: msg, needsReconnect: true }, { status: 401 });
    }

    // 4. Multipart upload to Drive — auto-convert .docx to Google Doc by setting target mimeType.
    const fileName = `Shopping List — Week of ${weekStart}`;
    const boundary = `----------os-${Date.now()}`;
    const metadata = { name: fileName, mimeType: GDOC_MIME };

    const head =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${DOCX_MIME}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;

    // Concatenate text head, binary body, text tail into a single Uint8Array body.
    const headBytes = Buffer.from(head, "utf8");
    const tailBytes = Buffer.from(tail, "utf8");
    const body = Buffer.concat([headBytes, docxBuffer, tailBytes]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body: new Uint8Array(body),
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[save-to-drive] upload failed:", uploadRes.status, errText);
      // 403 with "insufficientPermissions" or "insufficient authentication" means the
      // user authorized Drive before drive.file scope was added — they need to reconnect.
      const needsReconnect =
        uploadRes.status === 401 ||
        uploadRes.status === 403 ||
        /insufficient/i.test(errText);
      return NextResponse.json(
        {
          error:
            needsReconnect
              ? "Drive doesn't have permission to create files. Reconnect Drive to grant write access."
              : `Drive upload failed (${uploadRes.status})`,
          needsReconnect,
        },
        { status: needsReconnect ? 401 : 500 }
      );
    }

    const fileData = (await uploadRes.json()) as {
      id?: string;
      name?: string;
      webViewLink?: string;
    };

    return NextResponse.json({
      fileId: fileData.id,
      name: fileData.name,
      webViewLink: fileData.webViewLink,
    });
  } catch (err) {
    console.error("[save-shopping-list-to-drive] error:", err);
    return NextResponse.json({ error: "Failed to save to Drive" }, { status: 500 });
  }
}
