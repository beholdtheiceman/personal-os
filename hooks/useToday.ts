import { useState, useEffect } from "react";
import { format } from "date-fns";

/**
 * Returns today's date as "yyyy-MM-dd" and automatically updates at midnight
 * so components don't show stale data if the app is left open overnight.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    function scheduleNextUpdate() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      return setTimeout(() => {
        setToday(format(new Date(), "yyyy-MM-dd"));
        scheduleNextUpdate();
      }, msUntilMidnight);
    }

    const timer = scheduleNextUpdate();
    return () => clearTimeout(timer);
  }, []);

  return today;
}
