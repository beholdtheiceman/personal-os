"use client";
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaid } from "@/hooks/usePlaid";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import {
  RiLink, RiRefreshLine, RiBankCardLine,
  RiCheckLine, RiTimeLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import { format } from "date-fns";

function FrequencyBadge({ freq }: { freq: string }) {
  const labels: Record<string, string> = {
    WEEKLY: "Weekly", BIWEEKLY: "Biweekly", SEMI_MONTHLY: "2× / mo",
    MONTHLY: "Monthly", ANNUALLY: "Annual",
  };
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-text-muted">
      {labels[freq] ?? freq}
    </span>
  );
}

function ConnectButton() {
  const { user } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchLinkToken = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
      else toast.error("Could not start Plaid — check your keys");
    } catch {
      toast.error("Failed to connect to Plaid");
    } finally {
      setFetching(false);
    }
  };

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          public_token,
          institution_name: metadata?.institution?.name ?? "Unknown",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.institution_name ?? "Account"} connected!`);
        setLinkToken(null);
        // Auto-sync after connecting
        const syncRes = await fetch("/api/plaid/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const syncData = await syncRes.json();
        if (syncData.success) toast.success(`Found ${syncData.recurring_count} recurring charges`);
      } else {
        toast.error("Failed to save account");
      }
    } catch {
      toast.error("Connection failed");
    }
  }, [user]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  if (linkToken && ready) {
    open();
  }

  return (
    <button
      onClick={fetchLinkToken}
      disabled={fetching}
      className="btn-primary flex items-center gap-2 text-sm"
    >
      {fetching
        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : <RiLink className="w-4 h-4" />}
      Connect Account
    </button>
  );
}

export default function PlaidConnect() {
  const { user } = useAuth();
  const { items, recurring, settings, loading, monthlyTotal } = usePlaid();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Synced — ${data.recurring_count} recurring, ${data.transaction_count} transactions`);
      } else {
        toast.error(data.error ?? "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const activeRecurring = recurring.filter((r) => r.is_active);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Connected Accounts</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Plaid detects recurring charges and subscriptions automatically
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Connected items */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.item_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
              <RiBankCardLine className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{item.institution_name}</p>
                <p className="text-xs text-text-muted">
                  Connected {format(new Date(item.connected_at), "MMM d, yyyy")}
                </p>
              </div>
              <RiCheckLine className="w-4 h-4 text-success shrink-0" />
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            {settings.last_synced && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <RiTimeLine className="w-3 h-3" />
                Last synced {format(new Date(settings.last_synced), "MMM d 'at' h:mm a")}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-text transition-colors ml-auto"
            >
              <RiRefreshLine className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-6 text-text-muted text-sm">
          No accounts connected yet. Click <span className="text-accent">Connect Account</span> to get started.
        </div>
      )}

      {/* Recurring charges */}
      {activeRecurring.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Recurring Charges
            </h3>
            <span className="text-sm font-semibold text-accent">
              ${monthlyTotal.toFixed(2)}<span className="text-xs font-normal text-text-muted">/mo est.</span>
            </span>
          </div>

          <div className="space-y-2">
            {activeRecurring
              .sort((a, b) => b.amount - a.amount)
              .map((r) => (
                <div key={r.stream_id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="text-sm text-text-primary truncate">{r.merchant_name}</span>
                    <FrequencyBadge freq={r.frequency} />
                  </div>
                  <span className="text-sm font-medium text-text-primary shrink-0">
                    ${r.amount.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
