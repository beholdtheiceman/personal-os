import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { executeTool, type ToolInput } from "@/lib/tool-executor";

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { name?: unknown; arguments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { name, arguments: args } = body;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing tool name" }, { status: 400 });
  }

  try {
    const result = await executeTool(uid, name, (args ?? {}) as ToolInput, today);
    return NextResponse.json({ result });
  } catch (err) {
    console.error(`Tool execute error [${name}]:`, err);
    return NextResponse.json({ error: "Tool execution failed" }, { status: 500 });
  }
}
