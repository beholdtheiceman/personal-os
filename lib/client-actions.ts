"use client";

type Ctx = {
  navigate: (path: string) => void;
  getQuickLinks: () => { title: string; url: string }[];
};

// Widget events only act if the target widget is mounted (i.e. we're on /dashboard).
// If we're elsewhere, navigate there first, then dispatch once the widget has mounted.
function dispatchOnDashboard(ctx: Ctx, dispatch: () => void) {
  if (window.location.pathname === "/dashboard") {
    dispatch();
    return;
  }
  ctx.navigate("/dashboard");
  setTimeout(dispatch, 400);
}

export async function runClientTool(
  name: string,
  args: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
  switch (name) {
    case "navigate_to_page": {
      const page = String(args.page ?? "");
      if (!page) return "No page specified.";
      ctx.navigate(`/${page}`);
      return `Opened the ${page} page.`;
    }

    case "open_quick_link": {
      const q = String(args.title_search ?? "").toLowerCase();
      const match = ctx.getQuickLinks().find((l) => l.title.toLowerCase().includes(q));
      if (!match) return `No quick link matching "${args.title_search}".`;
      window.open(match.url, "_blank", "noopener");
      return `Opened "${match.title}".`;
    }

    case "regenerate_daily_summary": {
      dispatchOnDashboard(ctx, () =>
        window.dispatchEvent(new CustomEvent("os:regenerate-daily-summary")),
      );
      return "Regenerating the daily summary.";
    }

    case "refresh_widget": {
      const widget = String(args.widget ?? "");
      dispatchOnDashboard(ctx, () =>
        window.dispatchEvent(new CustomEvent("os:refresh-widget", { detail: { widget } })),
      );
      return `Refreshed the ${widget} widget.`;
    }

    case "open_quick_capture": {
      window.dispatchEvent(new CustomEvent("os:open-quick-capture", { detail: { text: args.text ?? "" } }));
      return "Opened quick capture.";
    }

    case "start_focus_timer": {
      window.dispatchEvent(new CustomEvent("os:start-focus-timer", { detail: { minutes: args.minutes, task: args.task } }));
      return "Started a focus session.";
    }

    default:
      return `Unknown client tool: ${name}`;
  }
}
