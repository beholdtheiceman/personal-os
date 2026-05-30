import Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  // ── Tasks ──
  {
    name: "add_task",
    description: "Add a new task or to-do item. Set recurrence for repeating tasks (e.g. 'water the plants every week').",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string", enum: ["personal", "business", "health", "finance"] } },
        due_date: { type: "string", description: "YYYY-MM-DD, only if mentioned" },
        recurrence: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Only if the task repeats. A new instance is auto-created on completion." },
        recurrence_end: { type: "string", description: "YYYY-MM-DD, optional last date to keep repeating" },
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
  {
    name: "unsubscribe_from_email",
    description: "Unsubscribe from a mailing list using the email's List-Unsubscribe header. Works for most marketing emails and newsletters. Pass the email ID and this tool will fire the unsubscribe request automatically — no browser needed. Use search_gmail first to find the email ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_id: { type: "string", description: "The Gmail message ID of the email to unsubscribe from" },
      },
      required: ["email_id"],
    },
  },

  // ── Web Search ──
  {
    name: "web_search",
    description: "Search the web for current information, recipes, news, research, or anything not in your training data. Use when the user asks for something that needs up-to-date or external information.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
        max_results: { type: "number", description: "Number of results to return (1-5, default 3)" },
      },
      required: ["query"],
    },
  },

  // ── Notifications ──
  {
    name: "configure_notification",
    description: "Enable or disable a notification category and set its time. Use when the user asks to set up reminders like 'remind me every morning at 7am', 'send me a streak alert at 9pm', or 'turn off my journal reminder'.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["morning_briefing", "streak_alert", "task_reminder", "goal_deadline", "journal_reminder", "health_reminder", "weekly_review"],
          description: "Which notification category to configure",
        },
        enabled: { type: "boolean", description: "true to enable, false to disable" },
        time: { type: "string", description: "HH:mm in 24h format (user local time). Required when enabling a time-based notification." },
      },
      required: ["category", "enabled"],
    },
  },
  {
    name: "set_habit_reminder",
    description: "Set or clear push notification reminders for a habit. Supports multiple times per day — ideal for habits like drinking water. When the user says 'every X hours', generate the full list of times. Pass an empty array to clear all reminders.",
    input_schema: {
      type: "object" as const,
      properties: {
        habit_name_search: { type: "string", description: "Partial habit name to find it" },
        reminder_times: {
          type: "array",
          items: { type: "string" },
          description: "Array of HH:mm times in 24h format (user's local time). E.g. ['08:00','10:00','12:00']. Pass [] to clear all reminders.",
        },
      },
      required: ["habit_name_search", "reminder_times"],
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

  // ── Subscriptions ──
  {
    name: "add_subscription",
    description: "Add a recurring subscription or membership. Use when the user mentions a service they pay for regularly.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:              { type: "string", description: "Service name e.g. Netflix, Spotify" },
        category:          { type: "string", enum: ["Entertainment","Productivity","Health & Fitness","Finance","Utilities","Food & Drink","Gaming","News & Media","Shopping","Other"] },
        amount:            { type: "number", description: "Billing amount in USD" },
        billing_cycle:     { type: "string", enum: ["weekly","monthly","quarterly","yearly"] },
        next_billing_date: { type: "string", description: "Next renewal date YYYY-MM-DD" },
        url:               { type: "string", description: "Service website (optional)" },
        notes:             { type: "string", description: "Any extra notes (optional)" },
      },
      required: ["name", "amount", "billing_cycle"],
    },
  },
  {
    name: "update_subscription",
    description: "Update or cancel an existing subscription. Search by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search:       { type: "string", description: "Partial subscription name to find it" },
        status:            { type: "string", enum: ["active","paused","cancelled"] },
        amount:            { type: "number" },
        billing_cycle:     { type: "string", enum: ["weekly","monthly","quarterly","yearly"] },
        next_billing_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["name_search"],
    },
  },

  // ── Read tools (review existing data) ──
  {
    name: "list_calendar_events",
    description: "Read events from Google Calendar in a time window around today. Use this whenever you need to know the user's schedule before suggesting times, evaluating availability, or referencing what's coming up.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_back: { type: "number", description: "Days into the past to include. Default 0 (start of today)." },
        days_ahead: { type: "number", description: "Days into the future to include. Default 7." },
        max_results: { type: "number", description: "Max events to return, default 50." },
      },
      required: [],
    },
  },
  {
    name: "list_tasks",
    description: "List the user's tasks. Filter by status, tag, and/or due-date range. Defaults to active tasks sorted by priority.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "completed", "archived"], description: "Defaults to active." },
        tag: { type: "string", enum: ["personal", "business", "health", "finance"], description: "Optional tag filter." },
        due_before: { type: "string", description: "YYYY-MM-DD; only tasks due on/before." },
        due_after: { type: "string", description: "YYYY-MM-DD; only tasks due on/after." },
        limit: { type: "number", description: "Max tasks, default 50." },
      },
      required: [],
    },
  },
  {
    name: "list_habits",
    description: "List the user's habits with recent completion stats.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_completions_days: { type: "number", description: "How many recent days of completion data to count. Default 7." },
      },
      required: [],
    },
  },
  {
    name: "list_meals",
    description: "List meals logged over a date range, grouped by day with calorie and macro totals.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD. Defaults to 7 days ago." },
        end_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
      required: [],
    },
  },
  {
    name: "get_health_log",
    description: "Read sleep, energy, exercise, and step data over a date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD. Defaults to 7 days ago." },
        end_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
      required: [],
    },
  },
  {
    name: "log_water",
    description: "Log a glass of water for today (increments the user's hydration count by 1). Awards XP if the daily goal is reached.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_hydration",
    description: "Get today's hydration status: glasses logged, daily goal, and timestamps of each glass.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "log_mood",
    description: "Log the user's mood for today on a 1–10 scale with an optional note. Awards 5 XP. Can only be called once per day (subsequent calls update the score).",
    input_schema: {
      type: "object" as const,
      properties: {
        score: { type: "number", description: "Mood score from 1 (very low) to 10 (excellent)." },
        note: { type: "string", description: "Optional note describing how they feel or why." },
      },
      required: ["score"],
    },
  },
  {
    name: "get_mood_history",
    description: "Get the user's recent mood entries. Returns date, score, and optional note for each entry.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of recent days to return (default 7, max 30)." },
      },
      required: [],
    },
  },
  {
    name: "log_body_metrics",
    description: "Log body metrics for today. All fields are optional — log only what's available. Merges with any existing entry for today.",
    input_schema: {
      type: "object" as const,
      properties: {
        weight_lbs:   { type: "number", description: "Body weight in pounds." },
        body_fat_pct: { type: "number", description: "Body fat percentage." },
        chest_in:     { type: "number", description: "Chest measurement in inches." },
        waist_in:     { type: "number", description: "Waist measurement in inches." },
        hips_in:      { type: "number", description: "Hip measurement in inches." },
        arms_in:      { type: "number", description: "Arm measurement in inches." },
        notes:        { type: "string", description: "Optional notes." },
      },
      required: [],
    },
  },
  {
    name: "get_body_metrics_history",
    description: "Get the user's recent body metrics entries, most recent first.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of entries to return (default 10, max 30)." },
      },
      required: [],
    },
  },
  {
    name: "log_workout",
    description: "Log a completed workout session with exercises and sets. Awards XP (50 base + 10 per exercise). Detects and saves new PRs automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Session name, e.g. 'Push Day A' or 'Leg Day'." },
        exercises: {
          type: "array",
          description: "List of exercises performed.",
          items: {
            type: "object",
            properties: {
              exercise_name: { type: "string" },
              category: { type: "string", enum: ["push", "pull", "legs", "core", "cardio", "other"] },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reps: { type: "number" },
                    weight: { type: "number" },
                    unit: { type: "string", enum: ["lbs", "kg"] },
                  },
                },
              },
            },
          },
        },
        duration_min: { type: "number", description: "Duration in minutes (optional)." },
        notes: { type: "string", description: "Session notes (optional)." },
      },
      required: ["name", "exercises"],
    },
  },
  {
    name: "get_workout_history",
    description: "Get recent workout sessions with exercises and sets.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max sessions to return. Default 10." },
      },
      required: [],
    },
  },
  {
    name: "get_prs",
    description: "Get the user's personal records (PRs) for all exercises — max weight and reps per exercise.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", enum: ["push", "pull", "legs", "core", "cardio", "other"], description: "Optional category filter." },
      },
      required: [],
    },
  },
  {
    name: "list_exercises",
    description: "List all exercises in the user's exercise library.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", enum: ["push", "pull", "legs", "core", "cardio", "other"], description: "Optional category filter." },
      },
      required: [],
    },
  },
  {
    name: "generate_workout_plan",
    description: "Generate and save a structured workout plan. Claude should provide the plan content; this tool saves it to the user's Plans tab.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Plan name, e.g. 'PPL 3-Day Split'." },
        days: {
          type: "array",
          description: "Array of training days.",
          items: {
            type: "object",
            properties: {
              day: { type: "string", description: "Day name, e.g. 'Monday' or 'Day 1'." },
              focus: { type: "string", description: "Focus, e.g. 'Push', 'Pull', 'Legs'." },
              exercises: { type: "array", items: { type: "string" }, description: "Exercise names for this day." },
            },
          },
        },
      },
      required: ["name", "days"],
    },
  },
  {
    name: "list_journal_entries",
    description: "List recent journal entries with mood scores and AI summaries.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD. Defaults to 7 days ago." },
        end_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        limit: { type: "number", description: "Max entries, default 20." },
      },
      required: [],
    },
  },
  {
    name: "list_goals",
    description: "List the user's goals with milestone progress. Defaults to active goals.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "achieved", "paused"], description: "Defaults to active." },
        category: { type: "string", enum: ["personal", "business", "health", "financial"], description: "Optional category filter." },
      },
      required: [],
    },
  },
  {
    name: "list_transactions",
    description: "List financial transactions over a date range. Combines manually-logged transactions and Plaid-synced bank transactions.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD. Defaults to 7 days ago." },
        end_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        type: { type: "string", enum: ["income", "expense"], description: "Optional type filter." },
        category_search: { type: "string", description: "Optional: only transactions whose category contains this string (case-insensitive)." },
        limit: { type: "number", description: "Max transactions, default 100." },
      },
      required: [],
    },
  },
  {
    name: "log_time",
    description: "Manually log a time entry. Use when the user says things like 'log 2 hours of work on the landing page' or 'I spent 45 min on email'.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "What was worked on." },
        duration_min: { type: "number", description: "Duration in minutes." },
        category: { type: "string", enum: ["work", "personal", "health", "learning", "other"], description: "Time category. Default: work." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["description", "duration_min"],
    },
  },
  {
    name: "get_time_summary",
    description: "Get a summary of logged time — total hours by category and by day for the past week.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "How many days back to summarize. Default 7." },
      },
      required: [],
    },
  },
  {
    name: "start_focus_session",
    description: "Start a focus/Pomodoro session for the user on a named task. This sets the countdown timer running in the app. The user will see the MiniFocusBar immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_name: { type: "string", description: "What to focus on." },
        duration_min: { type: "number", description: "Session length in minutes. Default 25." },
        category: { type: "string", enum: ["work", "personal", "health", "learning", "other"], description: "Category for the logged time entry. Default: work." },
      },
      required: ["task_name"],
    },
  },
  {
    name: "set_budget",
    description: "Set or update a monthly spending limit for a category. Use this when the user says things like 'set my grocery budget to $400' or 'limit dining to $200 this month'.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Spending category name (e.g. 'groceries', 'dining', 'entertainment')." },
        limit: { type: "number", description: "Monthly spending limit in dollars." },
        alert_threshold: { type: "number", description: "Fraction (0–1) at which to show a warning. Default 0.8 (80%)." },
        month: { type: "string", description: "YYYY-MM format. Defaults to current month." },
      },
      required: ["category", "limit"],
    },
  },
  {
    name: "get_budget_status",
    description: "Get budget vs. actual spending for the current (or specified) month across all categories.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "YYYY-MM format. Defaults to current month." },
      },
      required: [],
    },
  },
  {
    name: "update_net_worth",
    description: "Save or update the user's net worth snapshot for the current month. Provide assets and liabilities as key-value pairs.",
    input_schema: {
      type: "object" as const,
      properties: {
        assets: {
          type: "object",
          description: "Map of asset name → { value: number, category: 'cash'|'investment'|'property'|'other' }.",
          additionalProperties: true,
        },
        liabilities: {
          type: "object",
          description: "Map of liability name → { value: number, category: 'loan'|'credit_card'|'mortgage'|'other' }.",
          additionalProperties: true,
        },
        month: { type: "string", description: "YYYY-MM. Defaults to current month." },
      },
      required: ["assets", "liabilities"],
    },
  },
  {
    name: "get_net_worth",
    description: "Get the user's net worth history — assets, liabilities, and net worth per month.",
    input_schema: {
      type: "object" as const,
      properties: {
        months: { type: "number", description: "How many recent months to return. Default 6." },
      },
      required: [],
    },
  },
  {
    name: "add_savings_goal",
    description: "Create a new savings goal with a target amount and target date.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:          { type: "string", description: "Name of the goal, e.g. 'Emergency Fund'." },
        target_amount: { type: "number", description: "Total amount to save." },
        target_date:   { type: "string", description: "YYYY-MM-DD deadline." },
        color:         { type: "string", description: "Optional hex color." },
      },
      required: ["name", "target_amount", "target_date"],
    },
  },
  {
    name: "log_savings_contribution",
    description: "Add a contribution to an existing savings goal.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_name: { type: "string", description: "Partial name of the goal (case-insensitive match)." },
        amount:    { type: "number", description: "Amount contributed." },
        note:      { type: "string", description: "Optional note about the contribution." },
      },
      required: ["goal_name", "amount"],
    },
  },
  {
    name: "get_savings_progress",
    description: "Get a summary of the user's active savings goals with progress and projections.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "add_debt",
    description: "Add a new debt to track in the Debt Payoff Planner.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:            { type: "string", description: "Name of the debt, e.g. 'Chase Sapphire' or 'Student Loan'." },
        type:            { type: "string", description: "Type: credit_card | auto_loan | student_loan | personal_loan | mortgage | medical | other." },
        balance:         { type: "number", description: "Current balance owed." },
        interest_rate:   { type: "number", description: "Annual interest rate as a percentage, e.g. 23.99 for 23.99% APR." },
        minimum_payment: { type: "number", description: "Minimum monthly payment." },
      },
      required: ["name", "type", "balance", "interest_rate", "minimum_payment"],
    },
  },
  {
    name: "update_debt_balance",
    description: "Update the current balance of an existing debt (e.g. after making a payment).",
    input_schema: {
      type: "object" as const,
      properties: {
        name:    { type: "string", description: "Partial name of the debt (case-insensitive match)." },
        balance: { type: "number", description: "New current balance." },
      },
      required: ["name", "balance"],
    },
  },
  {
    name: "get_debts",
    description: "Get a summary of all tracked debts with balances, APRs, and payoff projections.",
    input_schema: {
      type: "object" as const,
      properties: {
        method:        { type: "string", description: "Payoff strategy: avalanche (highest interest first) or snowball (lowest balance first). Defaults to avalanche." },
        extra_payment: { type: "number", description: "Extra monthly payment beyond minimums. Defaults to 0." },
      },
      required: [],
    },
  },
  {
    name: "delete_debt",
    description: "Delete a debt (use when fully paid off or entered in error).",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Partial name of the debt to delete (case-insensitive match)." },
      },
      required: ["name"],
    },
  },
  {
    name: "reorder_debts",
    description: "Set a custom payoff order for the user's debts by specifying debt names in the desired order (first = paid off first). Also switches the planner to Custom mode.",
    input_schema: {
      type: "object" as const,
      properties: {
        order: { type: "array", items: { type: "string" }, description: "Debt names in desired payoff order, first to last." },
      },
      required: ["order"],
    },
  },
  {
    name: "get_fire_projection",
    description: "Get the user's FIRE (Financial Independence) projection — FI number, progress %, projected date, and time remaining.",
    input_schema: {
      type: "object" as const,
      properties: {
        extra_monthly_savings: { type: "number", description: "Optional: hypothetical extra monthly savings to model." },
      },
      required: [],
    },
  },
  {
    name: "update_fire_assumptions",
    description: "Update FIRE calculation assumptions like annual expenses, expected return, or withdrawal rate.",
    input_schema: {
      type: "object" as const,
      properties: {
        annual_expenses: { type: "number", description: "Override annual expenses used for FI number calculation." },
        monthly_savings: { type: "number", description: "Override monthly savings rate." },
        expected_return: { type: "number", description: "Annual investment return as a percentage, e.g. 7 for 7%." },
        withdrawal_rate: { type: "number", description: "Safe withdrawal rate as a percentage, e.g. 4 for 4%." },
      },
      required: [],
    },
  },
  {
    name: "add_episode",
    description: "Add a new podcast episode to the content pipeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Episode title." },
        episode_number: { type: "number", description: "Episode number (optional)." },
        status: { type: "string", description: "Status: idea | outlined | recorded | edited | published. Defaults to 'idea'." },
        record_date: { type: "string", description: "YYYY-MM-DD target record date (optional)." },
        publish_date: { type: "string", description: "YYYY-MM-DD target publish date (optional)." },
        description: { type: "string", description: "Short episode description (optional)." },
        tags: { type: "array", items: { type: "string" }, description: "Topic tags (optional)." },
      },
      required: ["title"],
    },
  },
  {
    name: "update_episode_status",
    description: "Update the status of a podcast episode by title or episode number.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Episode title to search for (partial match)." },
        status: { type: "string", description: "New status: idea | outlined | recorded | edited | published." },
      },
      required: ["title", "status"],
    },
  },
  {
    name: "list_episodes",
    description: "List podcast episodes, optionally filtered by status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: idea | outlined | recorded | edited | published | all. Defaults to 'all'." },
      },
      required: [],
    },
  },
  {
    name: "add_supplement",
    description: "Add a new supplement or medication to the user's daily checklist.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:   { type: "string", description: "Supplement or medication name." },
        dosage: { type: "string", description: "Dosage, e.g. '1000mg', '2 capsules'." },
        timing: { type: "string", description: "When to take it: morning | afternoon | evening | with_meals | before_bed." },
        notes:  { type: "string", description: "Optional notes (e.g., 'take with food')." },
      },
      required: ["name", "dosage"],
    },
  },
  {
    name: "log_supplement_taken",
    description: "Mark one or more supplements as taken today.",
    input_schema: {
      type: "object" as const,
      properties: {
        names: { type: "array", items: { type: "string" }, description: "Names of supplements to mark as taken (partial match)." },
      },
      required: ["names"],
    },
  },
  {
    name: "get_supplement_status",
    description: "Get today's supplement checklist — which have been taken and which are still outstanding.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_insights",
    description: "Get the user's latest AI-generated insights about correlations across their health, mood, habits, workouts, and time data.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "add_book",
    description: "Add a book to the user's reading list.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:  { type: "string", description: "Book title." },
        author: { type: "string", description: "Author name." },
        status: { type: "string", description: "Status: want_to_read | reading | finished | abandoned. Defaults to 'want_to_read'." },
        rating: { type: "number", description: "Rating 1–10 (optional, for finished books)." },
        tags:   { type: "array", items: { type: "string" }, description: "Topic tags (optional)." },
        takeaways: { type: "string", description: "Key takeaways or notes (optional)." },
      },
      required: ["title", "author"],
    },
  },
  {
    name: "update_book_status",
    description: "Update the reading status of a book by title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:  { type: "string", description: "Book title (partial match)." },
        status: { type: "string", description: "New status: want_to_read | reading | finished | abandoned." },
        rating: { type: "number", description: "Rating 1–10 (optional, good to set when finishing)." },
      },
      required: ["title", "status"],
    },
  },
  {
    name: "log_highlight",
    description: "Add a highlight or quote to a book.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:     { type: "string", description: "Book title (partial match)." },
        highlight: { type: "string", description: "The highlight or quote text." },
      },
      required: ["title", "highlight"],
    },
  },
  {
    name: "get_reading_list",
    description: "Get the user's reading list, optionally filtered by status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: want_to_read | reading | finished | abandoned | all. Defaults to 'all'." },
      },
      required: [],
    },
  },
  {
    name: "reorder_books",
    description: "Reorder the user's 'Want to Read' list by priority. Provide book titles in the desired order (highest priority first). Only affects want_to_read books.",
    input_schema: {
      type: "object" as const,
      properties: {
        ordered_titles: {
          type: "array",
          items: { type: "string" },
          description: "Book titles in desired priority order (index 0 = highest priority). Use get_reading_list first to see current titles.",
        },
      },
      required: ["ordered_titles"],
    },
  },
  {
    name: "get_daily_briefing",
    description: "Retrieve today's morning briefing (or a recent one). Returns the AI-generated briefing content and stats.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "log_decision",
    description: "Log a decision the user made in their decision journal. Use when the user describes a significant choice or tradeoff they are making or made.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short name for the decision." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        context: { type: "string", description: "Background / situation." },
        options_considered: {
          type: "array",
          items: { type: "string" },
          description: "List of options that were considered.",
        },
        chosen_option: { type: "string", description: "The option that was chosen." },
        reasoning: { type: "string", description: "Why this option was chosen." },
        expected_outcome: { type: "string", description: "What the user expects to happen." },
        review_date: { type: "string", description: "YYYY-MM-DD to revisit this decision. Defaults to 30 days from now." },
        tags: { type: "array", items: { type: "string" }, description: "Optional tags." },
      },
      required: ["title", "chosen_option"],
    },
  },
  {
    name: "list_decisions",
    description: "List the user's logged decisions, optionally filtered by status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["all", "pending_review", "reviewed"], description: "Filter by status. Default 'all'." },
        limit: { type: "number", description: "Max decisions to return. Default 10." },
      },
      required: [],
    },
  },
  {
    name: "review_decision",
    description: "Mark a decision as reviewed with an outcome rating and notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        decision_id: { type: "string", description: "The decision ID to review." },
        outcome_rating: { type: "number", description: "1–5 rating of how well the outcome matched expectations." },
        review_notes: { type: "string", description: "Notes on what actually happened." },
      },
      required: ["decision_id", "outcome_rating"],
    },
  },
  {
    name: "list_projects",
    description: "List projects with their Kanban cards.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_cards: { type: "boolean", description: "Include cards under each project. Default true." },
        status: { type: "string", enum: ["active", "archived"], description: "Defaults to active." },
      },
      required: [],
    },
  },
  {
    name: "list_subscriptions",
    description: "List subscriptions with upcoming renewal dates and estimated monthly total.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "paused", "cancelled"], description: "Defaults to active." },
      },
      required: [],
    },
  },
  {
    name: "get_memory",
    description: "Read the user's personal memory entries (preferences, identity, goals, etc).",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Optional category filter." },
      },
      required: [],
    },
  },
  {
    name: "get_notification_settings",
    description: "Read the user's current notification settings — which categories are enabled, at what times, and any active snooze. Call this before update_notification_setting so you can report what's changing.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_media",
    description: "Read the user's media (YouTube/music) watch and listen history to inform recommendations. Returns a note if no history is being tracked yet.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max items, default 20." },
      },
      required: [],
    },
  },
  {
    name: "list_bible_reading",
    description: "Read the user's bible passage reading history to inform reading-plan suggestions. Returns a note if no history is being tracked yet.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max passages, default 20." },
      },
      required: [],
    },
  },
  {
    name: "list_interactions",
    description: "List recent interactions logged in the relationships CRM (calls, texts, emails, in-person, etc). Filter by person name, type, or date range. Use this to answer 'when did I last talk to X?' or 'who haven't I talked to lately?'",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name_search: { type: "string", description: "Optional: only interactions with people matching this name (partial match)." },
        type: { type: "string", enum: ["call", "text", "email", "in-person", "social", "other"], description: "Optional type filter." },
        start_date: { type: "string", description: "YYYY-MM-DD. Defaults to 30 days ago." },
        end_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        limit: { type: "number", description: "Max entries, default 30." },
      },
      required: [],
    },
  },
  {
    name: "get_shopping_list",
    description: "Read the most recently generated shopping list for a given week. Returns ingredients and amounts. Use this to answer 'what's on my shopping list?' without regenerating from scratch.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD (Monday). Defaults to the current week." },
      },
      required: [],
    },
  },

  // ── People / CRM ──
  {
    name: "list_people",
    description: "List contacts from the relationships CRM. Use to answer questions about who the user knows, who they haven't talked to in a while, upcoming follow-ups, or birthdays.",
    input_schema: {
      type: "object" as const,
      properties: {
        relationship: { type: "string", enum: ["friend","family","colleague","acquaintance","other"], description: "Filter by relationship type." },
        overdue_only: { type: "boolean", description: "Only return people overdue for contact based on their target frequency." },
        has_follow_up: { type: "boolean", description: "Only return people with a follow-up date set." },
        search: { type: "string", description: "Filter by name, company, or tag." },
      },
      required: [],
    },
  },
  {
    name: "add_person",
    description: "Add a new contact to the relationships CRM.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:              { type: "string" },
        relationship:      { type: "string", enum: ["friend","family","colleague","acquaintance","other"] },
        email:             { type: "string" },
        phone:             { type: "string" },
        birthday:          { type: "string", description: "YYYY-MM-DD" },
        location:          { type: "string" },
        company:           { type: "string" },
        notes:             { type: "string" },
        contact_frequency: { type: "string", enum: ["weekly","monthly","quarterly","yearly"] },
        follow_up_date:    { type: "string", description: "YYYY-MM-DD" },
        follow_up_note:    { type: "string" },
        gift_ideas:        { type: "array", items: { type: "string" } },
        tags:              { type: "array", items: { type: "string" } },
      },
      required: ["name"],
    },
  },
  {
    name: "update_person",
    description: "Update a contact's details, notes, follow-up, or gift ideas. Search by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search:       { type: "string", description: "Partial name to find the person" },
        notes:             { type: "string" },
        follow_up_date:    { type: "string", description: "YYYY-MM-DD" },
        follow_up_note:    { type: "string" },
        contact_frequency: { type: "string", enum: ["weekly","monthly","quarterly","yearly"] },
        add_gift_idea:     { type: "string", description: "Gift idea to append to their list" },
        add_tag:           { type: "string", description: "Tag to append" },
      },
      required: ["name_search"],
    },
  },
  {
    name: "log_interaction",
    description: "Log that the user interacted with someone (call, text, email, in-person, etc). Also updates last_contacted date.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string", description: "Partial name to find the person" },
        type:        { type: "string", enum: ["call","text","email","in-person","social","other"] },
        date:        { type: "string", description: "YYYY-MM-DD, defaults to today" },
        notes:       { type: "string", description: "What was discussed or any notes" },
      },
      required: ["name_search", "type"],
    },
  },

  // ── Google Drive ──
  {
    name: "search_drive",
    description: "Search the user's Google Drive for files by name or content. Returns file names, types, and IDs. Use read_drive_file to get the content of a specific file.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query — file name or keywords in the content" },
        limit: { type: "number", description: "Max files to return, default 10." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_drive_file",
    description: "Read the full text content of a Google Drive file (Docs, Sheets, Slides, or plain text). Use search_drive first to find the file ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id:   { type: "string", description: "The Drive file ID from search_drive results" },
        file_name: { type: "string", description: "File name (for confirmation in response)" },
      },
      required: ["file_id"],
    },
  },

  // ── Chat ──
  {
    name: "rename_chat",
    description: "Rename the current chat conversation. Use when the user says 'name this chat X', 'call this X', 'rename this conversation to X', 'save this as X', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The new name for this chat conversation" },
      },
      required: ["name"],
    },
  },

  // ── Meal Planner ──
  {
    name: "get_recipes",
    description: "List the user's saved recipes. Use before planning meals or when the user asks what recipes they have.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Optional: filter recipes by name or tag (case-insensitive)." },
        limit: { type: "number", description: "Max recipes to return. Default 50." },
      },
      required: [],
    },
  },
  {
    name: "add_recipe",
    description: "Save a new recipe to the user's recipe library.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:         { type: "string", description: "Recipe name" },
        servings:     { type: "number", description: "Number of servings" },
        prep_time:    { type: "number", description: "Prep time in minutes" },
        cook_time:    { type: "number", description: "Cook time in minutes" },
        ingredients:  {
          type: "array",
          description: "List of ingredients",
          items: {
            type: "object",
            properties: {
              name:   { type: "string" },
              amount: { type: "string", description: "e.g. '1 cup', '200g'" },
            },
            required: ["name", "amount"],
          },
        },
        instructions: { type: "string", description: "Step-by-step cooking instructions" },
        calories:     { type: "number", description: "Calories per serving (optional)" },
        protein:      { type: "number", description: "Protein grams per serving (optional)" },
        carbs:        { type: "number", description: "Carb grams per serving (optional)" },
        fat:          { type: "number", description: "Fat grams per serving (optional)" },
        tags:         { type: "array", items: { type: "string" }, description: "e.g. ['breakfast','high-protein']" },
      },
      required: ["name", "ingredients"],
    },
  },
  {
    name: "plan_meal",
    description: "Add a recipe to the weekly meal plan for a specific day and meal slot. Use get_recipes first to find the recipe id.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipe_name_search: { type: "string", description: "Partial recipe name to find the recipe" },
        date:               { type: "string", description: "YYYY-MM-DD — the day to plan the meal for" },
        slot:               { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Meal slot" },
      },
      required: ["recipe_name_search", "date", "slot"],
    },
  },
  {
    name: "get_meal_plan",
    description: "Read the current week's meal plan (or a specific week). Returns what's planned for each day and slot.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD (Monday). Defaults to the current week." },
      },
      required: [],
    },
  },
  {
    name: "generate_shopping_list",
    description: "Generate a shopping list from the current week's meal plan by aggregating all ingredients. Saves to Firestore.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD (Monday). Defaults to the current week." },
      },
      required: [],
    },
  },

  // ── Firestore CRUD gap closure ──
  {
    name: "delete_task",
    description: "Delete a task by title search. Equivalent to update_task with delete:true, but reads more naturally for the agent.",
    input_schema: {
      type: "object" as const,
      properties: { title_search: { type: "string", description: "Partial title to find the task" } },
      required: ["title_search"],
    },
  },
  {
    name: "update_habit",
    description: "Update an existing habit — rename, change category, or reconfigure target days. Search by current name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string", description: "Partial habit name to find it" },
        new_name: { type: "string" },
        new_category: { type: "string" },
        new_target_days: { type: "array", items: { type: "number" }, description: "Days of week: 0=Sun...6=Sat" },
      },
      required: ["name_search"],
    },
  },
  {
    name: "delete_habit",
    description: "Delete a habit by name search. Removes all completion history with it.",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },
  {
    name: "update_meal",
    description: "Update a logged nutrition entry — fix the description or macros. Find by description search and optional date.",
    input_schema: {
      type: "object" as const,
      properties: {
        description_search: { type: "string", description: "Partial description to find the meal entry" },
        date: { type: "string", description: "YYYY-MM-DD to narrow search; defaults to today" },
        new_description: { type: "string" },
        new_meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        new_calories: { type: "number" },
        new_protein_g: { type: "number" },
        new_carbs_g: { type: "number" },
        new_fat_g: { type: "number" },
      },
      required: ["description_search"],
    },
  },
  {
    name: "delete_meal",
    description: "Delete a logged nutrition entry by description search and optional date.",
    input_schema: {
      type: "object" as const,
      properties: {
        description_search: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
      },
      required: ["description_search"],
    },
  },
  {
    name: "delete_health_log",
    description: "Delete the health log entry for a specific date.",
    input_schema: {
      type: "object" as const,
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "update_journal_entry",
    description: "Edit an existing journal entry — fix the transcript, summary, mood score, or tags. Find by date or by a substring of the summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD when the entry was logged" },
        text_search: { type: "string", description: "Partial text from summary or transcript (case-insensitive)" },
        new_raw_transcript: { type: "string" },
        new_ai_summary: { type: "string" },
        new_mood_score: { type: "number", description: "1-10" },
        new_tags: { type: "array", items: { type: "string" } },
      },
      required: [],
    },
  },
  {
    name: "delete_journal_entry",
    description: "Delete a journal entry. Identify by date or by substring of summary/transcript.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        text_search: { type: "string", description: "Partial text from summary or transcript" },
      },
      required: [],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a goal by title search.",
    input_schema: {
      type: "object" as const,
      properties: { title_search: { type: "string" } },
      required: ["title_search"],
    },
  },
  {
    name: "delete_subscription",
    description: "Delete a subscription record entirely (different from marking it cancelled — use update_subscription with status:'cancelled' for that).",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a memory entry by key.",
    input_schema: {
      type: "object" as const,
      properties: { key: { type: "string", description: "The memory key, e.g. 'Current role'" } },
      required: ["key"],
    },
  },
  {
    name: "update_project",
    description: "Update a project — rename, change description, color, or status. Search by current name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string" },
        new_name: { type: "string" },
        new_description: { type: "string" },
        new_color_tag: { type: "string", description: "Hex color e.g. #6C8EF5" },
        new_status: { type: "string", enum: ["active", "archived"] },
      },
      required: ["name_search"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project and ALL its Kanban cards. Search by name. This is destructive — confirm with the user before calling.",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },
  {
    name: "update_project_card",
    description: "Update a card on a project's Kanban board — change title, description, status (column), or priority.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_name_search: { type: "string" },
        card_title_search: { type: "string" },
        new_title: { type: "string" },
        new_description: { type: "string" },
        new_status: { type: "string", enum: ["todo", "in_progress", "done"] },
        new_priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["project_name_search", "card_title_search"],
    },
  },
  {
    name: "delete_project_card",
    description: "Delete a card from a project's Kanban board.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_name_search: { type: "string" },
        card_title_search: { type: "string" },
      },
      required: ["project_name_search", "card_title_search"],
    },
  },
  {
    name: "move_project_card",
    description: "Move a project card to a different Kanban column (todo / in_progress / done). Same as update_project_card with only new_status — separate tool so the agent can find it more easily.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_name_search: { type: "string" },
        card_title_search: { type: "string" },
        new_status: { type: "string", enum: ["todo", "in_progress", "done"] },
      },
      required: ["project_name_search", "card_title_search", "new_status"],
    },
  },
  {
    name: "update_recipe",
    description: "Update a saved recipe — rename, change ingredients, instructions, macros, or tags. Search by current name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string" },
        new_name: { type: "string" },
        new_servings: { type: "number" },
        new_prep_time: { type: "number" },
        new_cook_time: { type: "number" },
        new_ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, amount: { type: "string" } },
            required: ["name", "amount"],
          },
        },
        new_instructions: { type: "string" },
        new_calories: { type: "number" },
        new_protein: { type: "number" },
        new_carbs: { type: "number" },
        new_fat: { type: "number" },
        new_tags: { type: "array", items: { type: "string" } },
      },
      required: ["name_search"],
    },
  },
  {
    name: "delete_recipe",
    description: "Delete a saved recipe by name search. NOTE: this doesn't remove the recipe from any meal plans that reference it — those slots will show as missing.",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },
  {
    name: "unplan_meal",
    description: "Clear a single slot in the weekly meal plan (e.g. remove Tuesday's dinner). Identifies the slot by date and meal type.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      },
      required: ["date", "slot"],
    },
  },
  {
    name: "update_interaction",
    description: "Edit a logged interaction with a person — fix the date, type, or notes. Find by person name and the interaction's date.",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name_search: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD of the original interaction" },
        new_type: { type: "string", enum: ["call", "text", "email", "in-person", "social", "other"] },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_notes: { type: "string" },
      },
      required: ["person_name_search", "date"],
    },
  },
  {
    name: "delete_interaction",
    description: "Delete a logged interaction with a person, found by person name and the interaction's date.",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name_search: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["person_name_search", "date"],
    },
  },
  {
    name: "delete_person",
    description: "Delete a contact from the Firestore CRM (not Google Contacts — use delete_google_contact for that). Removes all logged interactions too.",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },
  {
    name: "update_second_brain_item",
    description: "Replace the contents of a note in Larry's second brain (Obsidian/PARA vault). Identified by exact file path.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Exact file path within the vault, e.g. 'inbox/2026-05-20.md'" },
        new_content: { type: "string", description: "The replacement content" },
      },
      required: ["path", "new_content"],
    },
  },
  {
    name: "delete_second_brain_item",
    description: "Delete a note from Larry's second brain by exact file path.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "add_shopping_item",
    description: "Add an ad-hoc item to the shopping list for a week (separate from generated-from-meal-plan items).",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD (Monday). Defaults to current week." },
        ingredient: { type: "string" },
        amount: { type: "string", description: "e.g. '2 cups', '1 loaf'" },
      },
      required: ["ingredient"],
    },
  },
  {
    name: "update_shopping_item",
    description: "Rename a shopping list item or change its amount. Find by ingredient name search.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD. Defaults to current week." },
        ingredient_search: { type: "string" },
        new_ingredient: { type: "string" },
        new_amount: { type: "string" },
      },
      required: ["ingredient_search"],
    },
  },
  {
    name: "check_shopping_item",
    description: "Toggle a shopping list item as checked off or unchecked.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD. Defaults to current week." },
        ingredient_search: { type: "string" },
        checked: { type: "boolean", description: "true = checked off, false = uncheck" },
      },
      required: ["ingredient_search", "checked"],
    },
  },
  {
    name: "delete_shopping_item",
    description: "Remove an item from the shopping list entirely.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "YYYY-MM-DD. Defaults to current week." },
        ingredient_search: { type: "string" },
      },
      required: ["ingredient_search"],
    },
  },
  {
    name: "clear_shopping_list",
    description: "Remove ALL items from the shopping list for a week (preserves the list document but empties items array). Use when the user wants to start fresh.",
    input_schema: {
      type: "object" as const,
      properties: { week_start: { type: "string", description: "YYYY-MM-DD. Defaults to current week." } },
      required: [],
    },
  },

  // ── Calendar (write CRUD) ──
  {
    name: "update_calendar_event",
    description: "Update an existing Google Calendar event — change title, time, location, or description. Identify the event by a title search and the date it's on (or by event_id if known from list_calendar_events).",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Google Calendar event id. If known (e.g. from list_calendar_events), pass directly to skip the lookup." },
        title_search: { type: "string", description: "Partial title to find the event. Required if event_id not given." },
        date: { type: "string", description: "YYYY-MM-DD on which the event occurs. Required if event_id not given." },
        new_title: { type: "string", description: "New event title." },
        new_start_datetime: { type: "string", description: "New start as ISO 8601, e.g. 2025-05-20T14:00:00. America/New_York timezone is assumed." },
        new_end_datetime: { type: "string", description: "New end as ISO 8601." },
        new_location: { type: "string" },
        new_description: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete a Google Calendar event. Identify by event_id (preferred) or by a title search + date. Use this whenever the user says cancel, remove, or delete an event/meeting/appointment.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Google Calendar event id. Preferred if known from list_calendar_events." },
        title_search: { type: "string", description: "Partial title to find the event. Required if event_id not given." },
        date: { type: "string", description: "YYYY-MM-DD on which the event occurs. Required if event_id not given." },
      },
      required: [],
    },
  },
  {
    name: "get_calendar_event",
    description: "Fetch full details for a single Google Calendar event by id, or by title search + date.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string" },
        title_search: { type: "string", description: "Partial title to find the event. Required if event_id not given." },
        date: { type: "string", description: "YYYY-MM-DD. Required if event_id not given." },
      },
      required: [],
    },
  },

  // ── Gmail (write operations) ──
  {
    name: "send_email",
    description: "Compose and send a new email from the user's Gmail. For replying within an existing thread, use reply_to_email instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient email address (comma-separated for multiple)" },
        cc: { type: "string", description: "Cc recipients (optional, comma-separated)" },
        bcc: { type: "string", description: "Bcc recipients (optional, comma-separated)" },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "reply_to_email",
    description: "Reply to an existing email within its thread. Pass the message_id from search_gmail results. Subject and threading headers are inferred.",
    input_schema: {
      type: "object" as const,
      properties: {
        message_id: { type: "string", description: "Gmail message id of the email being replied to" },
        body: { type: "string", description: "Plain text reply body" },
        reply_all: { type: "boolean", description: "If true, also Cc all original recipients. Default false." },
      },
      required: ["message_id", "body"],
    },
  },
  {
    name: "archive_email",
    description: "Archive an email — removes the INBOX label, keeps the message.",
    input_schema: {
      type: "object" as const,
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "trash_email",
    description: "Move an email to Trash. Reversible by the user from Gmail UI within 30 days.",
    input_schema: {
      type: "object" as const,
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "mark_email_read",
    description: "Mark an email as read (removes UNREAD label).",
    input_schema: {
      type: "object" as const,
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "mark_email_unread",
    description: "Mark an email as unread (adds UNREAD label).",
    input_schema: {
      type: "object" as const,
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "label_email",
    description: "Add or remove a label on an email. Looks up label by name (call list_gmail_labels first if unsure what exists).",
    input_schema: {
      type: "object" as const,
      properties: {
        message_id: { type: "string" },
        label_name: { type: "string" },
        add: { type: "boolean", description: "true to add the label, false to remove" },
      },
      required: ["message_id", "label_name", "add"],
    },
  },
  {
    name: "list_gmail_labels",
    description: "List all Gmail labels (user-created and system). Useful before calling label_email.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_gmail_label",
    description: "Create a new Gmail label.",
    input_schema: {
      type: "object" as const,
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "delete_gmail_label",
    description: "Delete a Gmail label by name. Doesn't delete the emails — they just lose the label.",
    input_schema: {
      type: "object" as const,
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },

  // ── Drive (write operations) ──
  // The OAuth scope is drive.file — these tools can only modify files the app created
  // (not the user's whole Drive). search_drive can find those files; pass file_id to operate.
  {
    name: "upload_drive_file",
    description: "Upload a new file to Google Drive with text content. For binary files or auto-converting to Google Docs format, set mime_type appropriately (e.g. 'application/vnd.google-apps.document' to auto-convert from text).",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Filename including extension" },
        content: { type: "string", description: "Text content of the file" },
        mime_type: { type: "string", description: "Source MIME type. Default 'text/plain'. Use 'application/vnd.google-apps.document' for auto-conversion to Google Doc." },
        parent_folder_id: { type: "string", description: "Optional Drive folder id; defaults to root." },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "create_drive_folder",
    description: "Create a new folder in Google Drive.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        parent_folder_id: { type: "string", description: "Optional parent folder id; defaults to root." },
      },
      required: ["name"],
    },
  },
  {
    name: "update_drive_file",
    description: "Replace the contents of an existing Drive file (one the app created). Identify by file_id (from search_drive).",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id: { type: "string" },
        content: { type: "string", description: "New text content" },
        mime_type: { type: "string", description: "MIME type of the content. Default 'text/plain'." },
      },
      required: ["file_id", "content"],
    },
  },
  {
    name: "rename_drive_file",
    description: "Rename a Drive file (the file_id is preserved).",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id: { type: "string" },
        new_name: { type: "string" },
      },
      required: ["file_id", "new_name"],
    },
  },
  {
    name: "move_drive_file",
    description: "Move a Drive file into a different folder.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id: { type: "string" },
        new_parent_folder_id: { type: "string", description: "Destination folder id" },
      },
      required: ["file_id", "new_parent_folder_id"],
    },
  },
  {
    name: "delete_drive_file",
    description: "Delete a Drive file (permanent — bypasses Trash since this app scope can't restore). The drive.file scope only permits deleting files the app created.",
    input_schema: {
      type: "object" as const,
      properties: { file_id: { type: "string" } },
      required: ["file_id"],
    },
  },
  {
    name: "share_drive_file",
    description: "Grant access to a Drive file. Either share with a specific email (role=reader/writer/commenter) or make it accessible by anyone with the link.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id: { type: "string" },
        email: { type: "string", description: "Email to share with. Omit for anyone-with-link." },
        role: { type: "string", enum: ["reader", "commenter", "writer"], description: "Permission role. Default 'reader'." },
        anyone_with_link: { type: "boolean", description: "If true, ignore email and create an anyone-with-link permission." },
      },
      required: ["file_id"],
    },
  },

  // ── Google Contacts (separate from the Firestore CRM) ──
  // These tools operate on the user's Google Contacts via People API.
  // The Firestore CRM (list_people, add_person, update_person, delete_person) is a separate
  // store; an add to one does NOT sync to the other automatically.
  {
    name: "list_google_contacts",
    description: "List the user's Google Contacts (from their Google account, not the Firestore CRM). Filter by name search.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Optional partial name to filter by" },
        limit: { type: "number", description: "Max contacts to return, default 50" },
      },
      required: [],
    },
  },
  {
    name: "create_google_contact",
    description: "Create a new contact in the user's Google Contacts (separate from the Firestore CRM — use add_person for that). Use this when the user wants to actually save someone to their Google address book.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Full display name" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        notes: { type: "string", description: "Goes into the biography field" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_google_contact",
    description: "Update an existing Google Contact. Find by name search; updates the first match. Only the provided fields are changed.",
    input_schema: {
      type: "object" as const,
      properties: {
        name_search: { type: "string" },
        new_name: { type: "string" },
        new_email: { type: "string" },
        new_phone: { type: "string" },
        new_company: { type: "string" },
        new_notes: { type: "string" },
      },
      required: ["name_search"],
    },
  },
  {
    name: "delete_google_contact",
    description: "Delete a contact from the user's Google Contacts by name search. Does NOT remove the contact from the Firestore CRM — use delete_person for that.",
    input_schema: {
      type: "object" as const,
      properties: { name_search: { type: "string" } },
      required: ["name_search"],
    },
  },

  // ── News Feed ──────────────────────────────────────────────────────────────
  {
    name: "get_news_feed",
    description: "Get recent news items from the user's personalized feed. Optionally filter by tag or status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "unread | read | saved | dismissed. Defaults to unread." },
        tag:    { type: "string", description: "Filter by tag e.g. 'tech', 'finance', 'world'." },
        limit:  { type: "number", description: "Max items to return. Defaults to 10." },
      },
      required: [],
    },
  },
  {
    name: "save_article",
    description: "Save a news article to the user's reading list.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:     { type: "string" },
        url:       { type: "string", description: "Article URL." },
        feed_name: { type: "string", description: "Source publication or feed name." },
        tags:      { type: "array", items: { type: "string" }, description: "Topic tags." },
      },
      required: ["title", "url"],
    },
  },
  {
    name: "add_news_feed",
    description: "Add a new RSS or Reddit feed to the user's newsfeed sources.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Display name for the feed." },
        url:  { type: "string", description: "RSS feed URL, or Reddit subreddit slug e.g. 'programming'." },
        type: { type: "string", description: "rss or reddit." },
        tags: { type: "array", items: { type: "string" }, description: "Category labels e.g. ['tech']." },
      },
      required: ["name", "url", "type"],
    },
  },

  // ── Weather ────────────────────────────────────────────────────────────────
  {
    name: "get_weather",
    description: "Get current weather conditions and forecast for the user's configured home location.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_reminder",
    description: "Set a one-time push notification reminder for the user. Resolve any relative time expression ('in 2 hours', 'next Thursday at 10am', 'tomorrow morning') to an absolute local datetime using today's date and the current local time from your context — both are injected into your system prompt. Always confirm the resolved datetime back to the user so they can verify. Hour precision only: the system fires on the hour, so round to the nearest hour and confirm what you stored (e.g. '10:30am' → store '10:00', confirm 'I\\'ll remind you at 10am').",
    input_schema: {
      type: "object" as const,
      properties: {
        text:    { type: "string", description: "What to remind the user about, e.g. 'Call Dr. Smith'" },
        fire_at: { type: "string", description: "Absolute local datetime in YYYY-MM-DDTHH:MM format (hour precision, no seconds, no timezone offset)" },
      },
      required: ["text", "fire_at"],
    },
  },
  {
    name: "list_reminders",
    description: "List all pending (not yet fired or cancelled) reminders for the user, sorted soonest first.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a pending reminder by its ID. Call list_reminders first if you need to resolve which reminder the user means.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Firestore document ID of the reminder to cancel" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_notification_setting",
    description: "Enable or disable a notification category, or change its scheduled time or day. Valid category keys: morning_briefing, streak_alert, task_reminder, goal_deadline, journal_reminder, health_reminder, weekly_review, birthday_reminder, savings_milestone, progress_midday, progress_evening, decision_review, networth_reminder, time_summary, goal_inactivity, subscription_renewal, spending_trend, season_checkin. Time format: 'HH:00' (hour precision only, e.g. '07:00'). day_of_week: 0=Sun…6=Sat (only for weekly_review). days_before: integer (for goal_deadline, birthday_reminder, subscription_renewal).",
    input_schema: {
      type: "object" as const,
      properties: {
        category:    { type: "string", description: "Notification category key" },
        enabled:     { type: "boolean", description: "Enable or disable this category" },
        time:        { type: "string", description: "Scheduled time as HH:00, e.g. '09:00'" },
        day_of_week: { type: "number", description: "Day of week (0=Sun) — weekly_review only" },
        days_before: { type: "number", description: "Days before deadline — goal_deadline, birthday_reminder, subscription_renewal" },
      },
      required: ["category"],
    },
  },
  {
    name: "snooze_all_notifications",
    description: "Temporarily mute all push notification categories until a given local datetime. One-off reminders created with create_reminder are NOT affected. To unsnooze early, call this with a past datetime.",
    input_schema: {
      type: "object" as const,
      properties: {
        until: { type: "string", description: "Local datetime to snooze until, in YYYY-MM-DDTHH:MM format" },
      },
      required: ["until"],
    },
  },
  {
    name: "get_app_settings",
    description: "Read the user's current app settings: home timezone, weather units (fahrenheit/celsius), and weather location city.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_app_setting",
    description: "Update a specific app setting. Available settings: 'home_timezone' (IANA timezone string, e.g. 'America/Chicago'), 'weather_units' ('fahrenheit' or 'celsius'), 'weather_location' (city name — geocoded server-side to lat/lon via Nominatim).",
    input_schema: {
      type: "object" as const,
      properties: {
        setting: { type: "string", description: "One of: home_timezone, weather_units, weather_location" },
        value:   { type: "string", description: "The new value" },
      },
      required: ["setting", "value"],
    },
  },
  {
    name: "get_dashboard_layout",
    description: "Read the user's current dashboard widget order and which widgets are hidden.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "manage_dashboard",
    description: "Show, hide, or reorder a dashboard widget. Use the human-readable widget name. Valid widgets: What Actually Matters, System Audit, XP / Level, Quick Links, AI Briefing, AI Insights, Decision Reviews, Upcoming Birthdays, Verse of the Day, Tasks & Habits, Hydration & Mood, Calendar & Nutrition, Health & Journal, Goals & Projects, Finance Summary, Budget & Savings, Weekly Review, API Usage, Email Agent, Unsubscribe Manager, Gmail Inbox, Achievements, News Feed, Weather.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", description: "One of: show, hide, move_to_top, move_to_bottom, move_up, move_down" },
        widget: { type: "string", description: "Widget label name as listed in this tool's description" },
      },
      required: ["action", "widget"],
    },
  },
  {
    name: "get_integration_status",
    description: "Check which integrations are connected and when each last synced. Covers: Gmail, Plaid, Google Health, Google Contacts, Google Calendar, Google Drive. Read-only — disconnecting must be done in the Settings UI.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "trigger_plaid_sync",
    description: "Manually trigger a Plaid sync right now to pull in the latest bank and credit card transactions, without waiting for the nightly cron.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

// Convert Anthropic tool definitions to OpenAI Realtime API format.
// Anthropic: { name, description, input_schema: { type, properties, required } }
// OpenAI:    { type: "function", name, description, parameters: { type, properties, required } }
export function toOpenAITools(tools: Anthropic.Tool[]): OpenAIRealtimeTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? "",
    parameters: t.input_schema as Record<string, unknown>,
  }));
}

export type OpenAIRealtimeTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};
