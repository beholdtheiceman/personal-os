import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";

/**
 * Returns today's date as "yyyy-MM-dd" and automatically updates at midnight
 * so components don't show stale data if the app is left open overnight.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function scheduleNextUpdate() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      timerRef.current = setTimeout(() => {
        setToday(format(new Date(), "yyyy-MM-dd"));
        scheduleNextUpdate();
      }, msUntilMidnight);
    }

    scheduleNextUpdate();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return today;
}
