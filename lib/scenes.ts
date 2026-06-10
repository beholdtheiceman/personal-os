export interface Scene {
  id: string;
  name: string;
  icon: string;
  description: string;
  colorClass: string; // Tailwind border/accent color for the indicator bar
  openingHint: string; // Instruction for Claude when activating this scene
}

export const BUILTIN_SCENES: Scene[] = [
  {
    id: "deep_work",
    name: "Deep Work",
    icon: "🎯",
    description: "Focused work session — timer, focus music, DND on non-urgent notifications.",
    colorClass: "rgba(167,139,250,0.4)",
    openingHint:
      "Start a 25-minute Pomodoro timer linked to the user's top-priority open task. Optionally set focus/ambient music via set_media. Suppress non-urgent notifications via snooze_all_notifications with a 90-minute window.",
  },
  {
    id: "workout",
    name: "Workout",
    icon: "💪",
    description: "Training mode — pulls today's workout plan and queues energizing music.",
    colorClass: "rgba(251,146,60,0.4)",
    openingHint:
      "Navigate to the workout page via navigate_to_page (page: 'workout'). Optionally queue energizing music via set_media with mood 'energizing workout'.",
  },
  {
    id: "wind_down",
    name: "Wind Down",
    icon: "🌙",
    description: "Evening mode — soft music, surface tomorrow's priorities, prompt a quick journal entry.",
    colorClass: "rgba(96,165,250,0.4)",
    openingHint:
      "Queue calm wind-down music via set_media with mood 'calm wind down'. Then briefly surface the user's top task for tomorrow and first calendar event. Gently invite a one-line journal entry if they haven't logged today.",
  },
  {
    id: "sleep",
    name: "Sleep",
    icon: "😴",
    description: "Sleep mode — full DND on all notifications, ambient sleep sounds.",
    colorClass: "rgba(129,140,248,0.4)",
    openingHint:
      "Snooze all notifications for 8 hours via snooze_all_notifications. Optionally queue sleep/ambient sounds via set_media with mood 'sleep ambient'. Wish the user a good night.",
  },
  {
    id: "travel",
    name: "Travel",
    icon: "✈️",
    description: "Travel mode — weather at destination, upcoming calendar context.",
    colorClass: "rgba(56,189,248,0.4)",
    openingHint:
      "Navigate to the weather page via navigate_to_page (page: 'weather'). Pull upcoming calendar events via list_calendar_events to surface any trip-related items. Offer to help with travel planning.",
  },
];

export function getScene(id: string): Scene | undefined {
  return BUILTIN_SCENES.find((s) => s.id === id);
}
