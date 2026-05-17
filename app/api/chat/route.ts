// POST /api/chat — Claude chat with full tool use across all Personal OS data
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { searchSecondBrain, captureToInbox, getSecondBrainContext } from "@/lib/second-brain";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

function today() { return new Date().toISOString().slice(0, 10); }

// Find a doc in a collection by approximate title/name match
async function findDoc(uid: string, collection: string, searchField: string, searchValue: string) {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/${collection}`).get();
  const lower = searchValue.toLowerCase();
  const doc = snap.docs.find((d) => (d.data()[searchField] as string)?.toLowerCase().includes(lower));
  return doc ?? null;
}

async function refreshGmailToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const doc = await db.doc(`users/${uid}/integrations/gmail`).get();
  if (!doc.exists) throw new Error("Gmail not connected");
  const data = doc.data()!;
  let accessToken: string = data.access_token;
  if (Date.now() > data.expires_at - 60000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshed = await res.json();
    if (refreshed.error) throw new Error(refreshed.error_description);
    accessToken = refreshed.access_token;
    await doc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
  }
  return accessToken;
}

async function refreshCalendarToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
  if (!tokenDoc.exists) throw new Error("Google Calendar not connected");
  const tokenData = tokenDoc.data()!;
  let accessToken: string = tokenData.access_token;
  if (Date.now() > tokenData.expires_at - 60000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description);
    accessToken = data.access_token;
    await tokenDoc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
  }
  return accessToken;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── Tasks ──
  {
    name: "add_task",
    description: "Add a new task or to-do item.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string", enum: ["personal", "business", "health", "finance"] } },
        due_date: { type: "string", description: "YYYY-MM-DD, only if mentioned" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task — mark complete, change due date, reprioritize, or delete it. Search by title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title_search: { type: "string", description: "Partial title to find the task" },
        status: { type: "string", enum: ["active", "completed", "archived"], description: "New status" },
        due_date: { type: "string", description: "New due date YYYY-MM-DD" },
        priority_score: { type: "number", description: "New priority score 1-100" },
        delete: { type: "boolean", description: "Set true to delete the task entirely" },
      },
      required: ["title_search"],
    },
  },

  // ── Calendar ──
  {
    name: "add_calendar_event",
    description: "Add an event to Google Calendar.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        start_datetime: { type: "string", description: "ISO 8601 e.g. 2025-05-20T14:00:00" },
        end_datetime: { type: "string", description: "ISO 8601. Assume 1 hour if duration not given." },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["title", "start_datetime", "end_datetime"],
    },
  },

  // ── Habits ──
  {
    name: "add_habit",
    description: "Create a new recurring habit to track.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        category: { type: "string", description: "e.g. Health, Fitness, Learning, Mindfulness" },
        target_days: { type: "array", items: { type: "number" }, description: "Days of week to target: 0=Sun,1=Mon,...,6=Sat. Use [0,1,2,3,4,5,6] for daily." },
      },
      required: ["name"],
    },
  },
  {
    name: "log_habit_today",
    description: "Mark a habit as completed for today, or undo that completion. Search by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string", description: "Partial habit name to find it" },
        completed: { type: "boolean", description: "true = mark done, false = undo" },
      },
      required: ["name_search", "completed"],
    },
  },

  // ── Nutrition ──
  {
    name: "log_meal",
    description: "Log a meal with nutritional estimates. You provide the macro estimates based on the description.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "What they ate" },
        meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        calories_estimated: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
      required: ["description", "meal", "calories_estimated", "protein_g", "carbs_g", "fat_g"],
    },
  },
  {
    name: "build_nutrition_plan",
    description: "Build a full day nutrition plan by logging multiple planned meals. Call this when the user asks for a meal plan or nutrition schedule.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
              calories_estimated: { type: "number" },
              protein_g: { type: "number" },
              carbs_g: { type: "number" },
              fat_g: { type: "number" },
            },
            required: ["description", "meal", "calories_estimated", "protein_g", "carbs_g", "fat_g"],
          },
        },
      },
      required: ["meals"],
    },
  },

  // ── Health ──
  {
    name: "log_health",
    description: "Log or update today's health data — sleep, energy, exercise, steps. Also use this to correct Fitbit/health data that's wrong.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        sleep_hours: { type: "number" },
        sleep_quality: { type: "number", description: "1-10" },
        energy_level: { type: "number", description: "1-10" },
        exercise_done: { type: "boolean" },
        exercise_description: { type: "string" },
        steps: { type: "number" },
        notes: { type: "string" },
      },
      required: [],
    },
  },

  // ── Journal ──
  {
    name: "add_journal_entry",
    description: "Add a journal entry. You write a brief AI summary and estimate the mood score from the content.",
    input_schema: {
      type: "object" as const,
      properties: {
        raw_transcript: { type: "string", description: "The full journal entry text as the user wrote/said it" },
        ai_summary: { type: "string", description: "Your 2-3 sentence summary of the key themes and emotional tone" },
        mood_score: { type: "number", description: "1-10 where 1=very negative, 5=neutral, 10=very positive" },
        tags: { type: "array", items: { type: "string" }, description: "2-4 relevant tags" },
      },
      required: ["raw_transcript", "ai_summary", "mood_score", "tags"],
    },
  },

  // ── Goals ──
  {
    name: "add_goal",
    description: "Add a new goal with optional milestones.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string", enum: ["personal", "business", "health", "financial"] },
        target_date: { type: "string", description: "YYYY-MM-DD" },
        milestones: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" }, completed: { type: "boolean" } }, required: ["title"] },
        },
      },
      required: ["title", "category"],
    },
  },
  {
    name: "update_goal",
    description: "Update a goal's status, or toggle a milestone complete/incomplete. Search by title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title_search: { type: "string", description: "Partial goal title to find it" },
        status: { type: "string", enum: ["active", "achieved", "paused"] },
        milestone_title: { type: "string", description: "Partial milestone title to toggle" },
        milestone_completed: { type: "boolean", description: "New completed state for the milestone" },
      },
      required: ["title_search"],
    },
  },

  // ── Finance ──
  {
    name: "add_transaction",
    description: "Log a financial transaction — income or expense.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        amount: { type: "number" },
        category: { type: "string", description: "e.g. Food, Transport, Salary, Freelance, Housing" },
        description: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
      required: ["type", "amount", "category"],
    },
  },
  {
    name: "update_transaction",
    description: "Fix or delete an existing transaction. Search by description or category.",
    input_schema: {
      type: "object" as const,
      properties: {
        description_search: { type: "string", description: "Partial description or category to find the transaction" },
        amount: { type: "number", description: "Corrected amount" },
        category: { type: "string", description: "Corrected category" },
        description: { type: "string", description: "Corrected description" },
        type: { type: "string", enum: ["income", "expense"] },
        delete: { type: "boolean", description: "Set true to delete the transaction" },
      },
      required: ["description_search"],
    },
  },

  // ── Projects ──
  {
    name: "add_project",
    description: "Create a new project with a Kanban board.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        color_tag: { type: "string", description: "Hex color e.g. #6C8EF5" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_project_card",
    description: "Add a card to a project's Kanban board. Search for the project by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_name_search: { type: "string", description: "Partial project name to find it" },
        title: { type: "string", description: "Card title" },
        description: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["project_name_search", "title"],
    },
  },

  // ── Second Brain ──
  {
    name: "search_second_brain",
    description: "Search Larry's local second brain (Obsidian/PARA vault) for notes, ideas, project details, or captured thoughts. Use when he asks about his notes, a specific project, worldbuilding, Lorcana, work, or when relevant context might exist in his vault.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms to look for in the vault" },
      },
      required: ["query"],
    },
  },
  {
    name: "capture_to_second_brain",
    description: "Save a note, idea, or task to Larry's second brain. Routes to Inbox (for notes/ideas) or TASKS.md (for action items). Use when he says 'capture', 'save this', 'remember', 'add to my brain', or gives a clear task/idea to log.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The content to capture" },
        destination: { type: "string", enum: ["inbox", "tasks"], description: "inbox for notes/ideas, tasks for actionable to-dos" },
      },
      required: ["text", "destination"],
    },
  },

  // ── Gmail ──
  {
    name: "search_gmail",
    description: "Search Gmail inbox for emails matching a query. Use when the user asks to find an email, check for messages from someone, or look up email content.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Gmail search query, e.g. 'from:boss@company.com' or 'invoice' or 'subject:meeting'" },
        max_results: { type: "number", description: "Max emails to return, default 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_email_content",
    description: "Get the full body of a specific email by its ID. Use after search_gmail to read the full content of an email.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_id: { type: "string", description: "The email message ID from search_gmail results" },
      },
      required: ["email_id"],
    },
  },

  // ── Memory ──
  {
    name: "update_memory",
    description: "Update a personal memory/fact about the user. Use when they tell you something about themselves you should remember — job change, new goal, preference, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "The memory field to update, e.g. 'Current role', 'Diet', 'Active projects'" },
        value: { type: "string", description: "The new value to store" },
        category: { type: "string", description: "Category if creating new: Identity, Business & Work, Health Baselines, Personal Preferences, Financial Snapshot, Current Priorities" },
      },
      required: ["key", "value"],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(uid: string, toolName: string, input: ToolInput): Promise<string> {
  const db = getAdminDb();

  switch (toolName) {
    // ── Tasks ──────────────────────────────────────────────────────────────────
    case "add_task": {
      await db.collection(`users/${uid}/tasks`).add({
        title: input.title,
        description: input.description ?? "",
        tags: (input.tags as string[]) ?? ["personal"],
        due_date: input.due_date ?? null,
        priority_score: 50,
        status: "active",
        source: "ai",
        created_at: FieldValue.serverTimestamp(),
      });
      return `Task "${input.title}" added.`;
    }

    case "update_task": {
      const doc = await findDoc(uid, "tasks", "title", input.title_search as string);
      if (!doc) return `No task found matching "${input.title_search}".`;
      if (input.delete) {
        await doc.ref.delete();
        return `Task "${doc.data().title}" deleted.`;
      }
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.due_date !== undefined) updates.due_date = input.due_date;
      if (input.priority_score !== undefined) updates.priority_score = input.priority_score;
      await doc.ref.update(updates);
      const action = input.status === "completed" ? "marked complete" : "updated";
      return `Task "${doc.data().title}" ${action}.`;
    }

    // ── Calendar ───────────────────────────────────────────────────────────────
    case "add_calendar_event": {
      try {
        const accessToken = await refreshCalendarToken(uid);
        const body = {
          summary: input.title,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start_datetime, timeZone: "America/New_York" },
          end: { dateTime: input.end_datetime, timeZone: "America/New_York" },
        };
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );
        const data = await res.json();
        if (!res.ok) return `Calendar error: ${data.error?.message ?? "Unknown error"}`;
        return `Event "${input.title}" added to Google Calendar.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return `Could not add calendar event: ${msg}`;
      }
    }

    // ── Habits ─────────────────────────────────────────────────────────────────
    case "add_habit": {
      await db.collection(`users/${uid}/habits`).add({
        name: input.name,
        category: input.category ?? "General",
        target_days: (input.target_days as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
        completions: [],
      });
      return `Habit "${input.name}" created.`;
    }

    case "log_habit_today": {
      const doc = await findDoc(uid, "habits", "name", input.name_search as string);
      if (!doc) return `No habit found matching "${input.name_search}".`;
      const data = doc.data();
      const completions: string[] = data.completions ?? [];
      const t = today();
      let updated: string[];
      if (input.completed) {
        updated = completions.includes(t) ? completions : [...completions, t];
      } else {
        updated = completions.filter((d) => d !== t);
      }
      await doc.ref.update({ completions: updated });
      return `Habit "${data.name}" ${input.completed ? "marked done" : "unmarked"} for today.`;
    }

    // ── Nutrition ──────────────────────────────────────────────────────────────
    case "log_meal": {
      await db.collection(`users/${uid}/nutrition`).add({
        date: (input.date as string) ?? today(),
        meal: input.meal,
        description: input.description,
        calories_estimated: input.calories_estimated,
        protein_g: input.protein_g,
        carbs_g: input.carbs_g,
        fat_g: input.fat_g,
        logged_at: FieldValue.serverTimestamp(),
      });
      return `${String(input.meal).charAt(0).toUpperCase() + String(input.meal).slice(1)} logged: ${input.description} (~${input.calories_estimated} kcal, ${input.protein_g}g protein).`;
    }

    case "build_nutrition_plan": {
      const meals = input.meals as Array<{
        description: string; meal: string;
        calories_estimated: number; protein_g: number; carbs_g: number; fat_g: number;
      }>;
      const date = (input.date as string) ?? today();
      const batch = db.batch();
      for (const meal of meals) {
        const ref = db.collection(`users/${uid}/nutrition`).doc();
        batch.set(ref, { ...meal, date, logged_at: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      const totalCal = meals.reduce((s, m) => s + m.calories_estimated, 0);
      return `Nutrition plan built: ${meals.length} meals logged for ${date} (~${totalCal} kcal total).`;
    }

    // ── Health ─────────────────────────────────────────────────────────────────
    case "log_health": {
      const date = (input.date as string) ?? today();
      const updates: Record<string, unknown> = { date, logged_at: FieldValue.serverTimestamp() };
      if (input.sleep_hours !== undefined) updates.sleep_hours = input.sleep_hours;
      if (input.sleep_quality !== undefined) updates.sleep_quality = input.sleep_quality;
      if (input.energy_level !== undefined) updates.energy_level = input.energy_level;
      if (input.exercise_done !== undefined) updates.exercise_done = input.exercise_done;
      if (input.exercise_description !== undefined) updates.exercise_description = input.exercise_description;
      if (input.steps !== undefined) updates.steps = input.steps;
      if (input.notes !== undefined) updates.notes = input.notes;
      await db.doc(`users/${uid}/health/${date}`).set(updates, { merge: true });
      return `Health log updated for ${date}.`;
    }

    // ── Journal ────────────────────────────────────────────────────────────────
    case "add_journal_entry": {
      await db.collection(`users/${uid}/journal`).add({
        date: today(),
        raw_transcript: input.raw_transcript,
        ai_summary: input.ai_summary,
        mood_score: input.mood_score,
        tags: input.tags ?? [],
        created_at: FieldValue.serverTimestamp(),
      });
      return `Journal entry saved (mood ${input.mood_score}/10).`;
    }

    // ── Goals ──────────────────────────────────────────────────────────────────
    case "add_goal": {
      await db.collection(`users/${uid}/goals`).add({
        title: input.title,
        description: input.description ?? "",
        category: input.category ?? "personal",
        target_date: input.target_date ?? "",
        milestones: (input.milestones as { title: string; completed: boolean }[]) ?? [],
        status: "active",
        created_at: FieldValue.serverTimestamp(),
      });
      return `Goal "${input.title}" added.`;
    }

    case "update_goal": {
      const doc = await findDoc(uid, "goals", "title", input.title_search as string);
      if (!doc) return `No goal found matching "${input.title_search}".`;
      const data = doc.data();
      const updates: Record<string, unknown> = {};
      if (input.status) updates.status = input.status;
      if (input.milestone_title !== undefined) {
        const milestones = (data.milestones as { title: string; completed: boolean }[]) ?? [];
        const lower = (input.milestone_title as string).toLowerCase();
        updates.milestones = milestones.map((m) =>
          m.title.toLowerCase().includes(lower)
            ? { ...m, completed: input.milestone_completed ?? !m.completed }
            : m
        );
      }
      await doc.ref.update(updates);
      return `Goal "${data.title}" updated.`;
    }

    // ── Finance ────────────────────────────────────────────────────────────────
    case "add_transaction": {
      await db.collection(`users/${uid}/transactions`).add({
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? "",
        date: (input.date as string) ?? today(),
        source: "manual",
        logged_at: FieldValue.serverTimestamp(),
      });
      const sign = input.type === "income" ? "+" : "−";
      return `${String(input.type) === "income" ? "Income" : "Expense"} ${sign}$${input.amount} (${input.category}) logged.`;
    }

    case "update_transaction": {
      const snap = await db.collection(`users/${uid}/transactions`).orderBy("logged_at", "desc").limit(100).get();
      const lower = (input.description_search as string).toLowerCase();
      const doc = snap.docs.find((d) => {
        const data = d.data();
        return (data.description as string)?.toLowerCase().includes(lower) ||
               (data.category as string)?.toLowerCase().includes(lower);
      });
      if (!doc) return `No transaction found matching "${input.description_search}".`;
      if (input.delete) {
        await doc.ref.delete();
        return `Transaction deleted.`;
      }
      const updates: Record<string, unknown> = {};
      if (input.amount !== undefined) updates.amount = input.amount;
      if (input.category !== undefined) updates.category = input.category;
      if (input.description !== undefined) updates.description = input.description;
      if (input.type !== undefined) updates.type = input.type;
      await doc.ref.update(updates);
      return `Transaction updated.`;
    }

    // ── Projects ───────────────────────────────────────────────────────────────
    case "add_project": {
      await db.collection(`users/${uid}/projects`).add({
        name: input.name,
        description: input.description ?? "",
        color_tag: (input.color_tag as string) ?? "#6C8EF5",
        status: "active",
        created_at: FieldValue.serverTimestamp(),
      });
      return `Project "${input.name}" created.`;
    }

    case "add_project_card": {
      const project = await findDoc(uid, "projects", "name", input.project_name_search as string);
      if (!project) return `No project found matching "${input.project_name_search}".`;
      await db.collection(`users/${uid}/projects/${project.id}/cards`).add({
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        created_at: FieldValue.serverTimestamp(),
      });
      return `Card "${input.title}" added to project "${project.data().name}".`;
    }

    // ── Gmail ──────────────────────────────────────────────────────────────────
    case "search_gmail": {
      try {
        const accessToken = await refreshGmailToken(uid);
        const q = encodeURIComponent(input.query as string);
        const max = (input.max_results as number) ?? 10;
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const listData = await listRes.json();
        if (listData.error) return `Gmail search error: ${listData.error.message}`;
        const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
        if (ids.length === 0) return `No emails found matching "${input.query}".`;

        const results = await Promise.all(
          ids.slice(0, max).map((id) =>
            fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            ).then((r) => r.json())
          )
        );

        const summary = results
          .filter((m) => !m.error)
          .map((msg) => {
            const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
            const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
            return `ID: ${msg.id}\nFrom: ${get("From")}\nSubject: ${get("Subject")}\nDate: ${get("Date")}\nSnippet: ${msg.snippet ?? ""}`;
          })
          .join("\n\n---\n\n");

        return `Found ${results.length} email(s) matching "${input.query}":\n\n${summary}`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return `Gmail not connected or error: ${msg}`;
      }
    }

    case "get_email_content": {
      try {
        const accessToken = await refreshGmailToken(uid);
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.email_id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msg = await res.json();
        if (msg.error) return `Error fetching email: ${msg.error.message}`;

        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

        function decodeBody(part: Record<string, unknown>): string {
          if (part.body && (part.body as Record<string, unknown>).data) {
            return Buffer.from((part.body as Record<string, string>).data, "base64").toString("utf8");
          }
          if (part.parts) {
            for (const p of part.parts as Record<string, unknown>[]) {
              const text = decodeBody(p);
              if (text) return text;
            }
          }
          return "";
        }

        let body = decodeBody(msg.payload);
        if (body.includes("<html") || body.includes("<body")) {
          body = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }

        return `From: ${get("From")}\nTo: ${get("To")}\nSubject: ${get("Subject")}\nDate: ${get("Date")}\n\n${body.slice(0, 4000)}`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return `Could not fetch email: ${msg}`;
      }
    }

    // ── Second Brain ───────────────────────────────────────────────────────────
    case "search_second_brain": {
      const results = searchSecondBrain(input.query as string);
      if (results.length === 0) return `No notes found matching "${input.query}" in your second brain.`;
      return results.map((r) => `**${r.file}**\n${r.excerpt}`).join("\n\n---\n\n");
    }

    case "capture_to_second_brain": {
      const dest = (input.destination as string) === "tasks" ? "tasks" : "inbox";
      const file = captureToInbox(input.text as string, dest);
      return `Captured to ${file}: "${input.text}"`;
    }

    // ── Memory ─────────────────────────────────────────────────────────────────
    case "update_memory": {
      const snap = await db.collection(`users/${uid}/memory`).get();
      const lower = (input.key as string).toLowerCase();
      const existing = snap.docs.find((d) => (d.data().key as string)?.toLowerCase() === lower);
      if (existing) {
        await existing.ref.update({ value: input.value, lastUpdated: new Date().toISOString() });
        return `Memory updated: "${input.key}" → "${input.value}".`;
      } else {
        await db.collection(`users/${uid}/memory`).add({
          key: input.key,
          value: input.value,
          category: input.category ?? "Personal Preferences",
          lastUpdated: new Date().toISOString(),
        });
        return `Memory saved: "${input.key}" = "${input.value}".`;
      }
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { messages, systemPrompt, uid } = await req.json();

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const actions: string[] = [];
    let currentMessages: Anthropic.MessageParam[] = messages;

    // Augment system prompt with second brain master context
    const secondBrainCtx = getSecondBrainContext();
    const fullSystemPrompt = secondBrainCtx
      ? `${systemPrompt ?? "You are a helpful personal assistant."}\n\n${secondBrainCtx}`
      : (systemPrompt ?? "You are a helpful personal assistant.");

    for (let i = 0; i < 8; i++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: fullSystemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content.find((b) => b.type === "text")?.text ?? "";
        return NextResponse.json({ text, actions });
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const tool of toolUseBlocks) {
          const result = uid
            ? await executeTool(uid, tool.name, tool.input as ToolInput)
            : "Action skipped — user not authenticated.";
          actions.push(result);
          toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
        }

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ];
        continue;
      }

      break;
    }

    return NextResponse.json({ text: "Done.", actions });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to get response from Claude" }, { status: 500 });
  }
}
