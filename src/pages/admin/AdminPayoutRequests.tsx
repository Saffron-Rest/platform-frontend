import { useEffect, useState } from "react";
import {
  approvePayoutRequest,
  declinePayoutRequest,
  listPayoutRequests,
  type PayoutRequest,
} from "../../api/earnings";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

type Filter = "PENDING" | "ALL";

const fmtDate = (iso: string) =>
  new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });

const statusStyle = (s: PayoutRequest["status"]) => ({
  PENDING:  "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  DECLINED: "bg-red-50 text-red-700 ring-1 ring-red-200",
}[s]);

const statusLabel = (s: PayoutRequest["status"]) => ({
  PENDING:  "Waiting for review",
  APPROVED: "Approved & paid",
  DECLINED: "Declined",
}[s]);

export function AdminPayoutRequests() {
  const [filter, setFilter]       = useState<Filter>("PENDING");
  const [requests, setRequests]   = useState<PayoutRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Per-row review state
  const [reviewId, setReviewId]   = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy]           = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    listPayoutRequests(filter === "PENDING" ? "PENDING" : undefined)
      .then(setRequests)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load requests"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openReview = (id: string) => {
    setReviewId(id);
    setReviewNote("");
  };
  const cancelReview = () => {
    setReviewId(null);
    setReviewNote("");
  };

  const handleApprove = async (id: string, source: "CASH" | "CARD") => {
    setBusy(true);
    try {
      await approvePayoutRequest(id, source, reviewNote.trim() || undefined);
      cancelReview();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (id: string) => {
    if (!reviewNote.trim()) {
      setError("Add a short reason so the cashier understands why.");
      return;
    }
    setBusy(true);
    try {
      await declinePayoutRequest(id, reviewNote.trim());
      cancelReview();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decline failed");
    } finally {
      setBusy(false);
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Payroll"
        title="Payout requests"
        subtitle="Cashiers can ask to be paid out early. Approve to record a salary payment; decline to leave everything unchanged."
        tabs={[
          { id: "PENDING", label: "Pending", active: filter === "PENDING", onClick: () => setFilter("PENDING"), badge: pending.length },
          { id: "ALL",     label: "All",     active: filter === "ALL",     onClick: () => setFilter("ALL") },
        ]}
      />

      {error && (
        <Alert variant="error">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-sm opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <EmptyState
          title={filter === "PENDING" ? "No pending requests" : "No requests yet"}
          description={
            filter === "PENDING"
              ? "When a cashier asks to be paid out, their request appears here."
              : "Payout requests from cashiers will show here once submitted."
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const isReviewing = reviewId === r.id;
            return (
              <Card key={r.id}>
                {/* Header row */}
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                      <span className="font-semibold text-[var(--color-ink)]">
                        {r.userName ?? r.userId}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1.5 text-sm flex-wrap">
                      <span>
                        Requested{" "}
                        <strong className="text-[var(--color-ink)]">
                          {r.requestedAmount.toFixed(2)} zł
                        </strong>
                      </span>
                      <span className="text-[var(--color-muted)]">{fmtDate(r.requestedDate)}</span>
                    </div>
                    {r.notes && (
                      <p className="text-sm text-[var(--color-muted)] mt-1">
                        Cashier note: <em>"{r.notes}"</em>
                      </p>
                    )}
                    {r.adminNotes && (
                      <p className="text-sm text-[var(--color-muted)] mt-1">
                        Your note: <em>"{r.adminNotes}"</em>
                      </p>
                    )}
                    {r.salaryPaymentId && (
                      <p className="text-xs text-emerald-700 mt-1">
                        ✓ Salary payment recorded
                      </p>
                    )}
                  </div>

                  {r.status === "PENDING" && !isReviewing && (
                    <Button size="sm" onClick={() => openReview(r.id)}>
                      Review
                    </Button>
                  )}
                </div>

                {/* Review panel — expands inline */}
                {isReviewing && (
                  <div className="mt-4 pt-4 border-t border-black/8 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
                        Note to cashier{" "}
                        <span className="text-[var(--color-muted)] font-normal">
                          (required if declining)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="field-input w-full"
                        placeholder='e.g. "Approved — cash payment on Friday" or "Please wait until month end"'
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm text-[var(--color-muted)]">Pay from:</span>
                      <Button
                        size="sm"
                        onClick={() => void handleApprove(r.id, "CASH")}
                        disabled={busy}
                      >
                        ✓ Approve — Cash
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleApprove(r.id, "CARD")}
                        disabled={busy}
                      >
                        ✓ Approve — Card/Transfer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDecline(r.id)}
                        disabled={busy}
                        className="text-red-700 hover:bg-red-50"
                      >
                        ✗ Decline
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelReview} disabled={busy}>
                        Cancel
                      </Button>
                    </div>

                    <p className="text-xs text-[var(--color-muted)]">
                      <strong>Approve</strong> records a salary payment and reduces the treasury balance.{" "}
                      <strong>Decline</strong> sends a note to the cashier and changes nothing else.
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
