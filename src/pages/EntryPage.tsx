import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { syncExpenses, uploadPendingInvoices, loadExpenses } from "../api/expenses";
import { EntryForm } from "../components/EntryForm";
import { ClosingEntryForm } from "../components/ClosingEntryForm";
import { entryToFormData, num } from "../lib/numbers";
import {
  emptyEntryForm,
  emptyExpenseLine,
  type DailyEntry,
  type EntryFormData,
  type ExpenseLine,
  type Platforms,
  type OpeningHint,
  type ShiftType,
  type User,
  type TreasurySettings,
  type WorkSchedule,
} from "../types";
import { useAuth } from "../context/AuthContext";
import { canOperate } from "../lib/roles";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { ReportStepper } from "../components/report/ReportStepper";
import { ReportSummaryBar } from "../components/report/ReportSummaryBar";
import {
  buildReportSteps,
  getReportValidationIssues,
  reportReadyToSubmit,
  reportSummary,
} from "../lib/reportProgress";
import { fmt } from "../lib/calc";
import { reportDateRelativeLabel } from "../lib/reportDates";
import { ReportContextBanner } from "../components/report/ReportContextBanner";
import { ReportValidationPanel } from "../components/report/ReportValidationPanel";
import { ReportActionBar } from "../components/report/ReportActionBar";

import { todayLocalIso } from "../lib/dates";

const todayIso = todayLocalIso;

export function EntryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManageReports = canOperate(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [form, setForm] = useState<EntryFormData>(emptyEntryForm());
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);
  const [treasurySettings, setTreasurySettings] = useState<
    Pick<TreasurySettings, "cardSalesSettlementRate" | "platformSettlementRates"> | null
  >(null);
  const [platforms, setPlatforms] = useState<Platforms>({
    wolt: true,
    bolt: true,
    uberEats: true,
    glovo: true,
    other: true,
  });
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [openingHint, setOpeningHint] = useState<OpeningHint | null>(null);
  const [shiftType, setShiftType] = useState<ShiftType>("FULL");
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  /** True while the user has unsaved edits; pauses focus/visibility auto-refresh
   *  so opening the file picker or switching tabs never wipes work in progress. */
  const dirtyRef = useRef(false);
  const markPristine = useCallback(() => {
    dirtyRef.current = false;
  }, []);
  const handleFormChange = useCallback((next: EntryFormData) => {
    dirtyRef.current = true;
    setForm(next);
  }, []);
  const handleExpensesChange = useCallback((next: ExpenseLine[]) => {
    dirtyRef.current = true;
    setExpenses(next);
  }, []);

  const entryStatus = (entry?.status ?? "").toUpperCase();
  const locked = entryStatus === "LOCKED";
  const scheduleClosingOnly = entry?.closingOnly ?? shiftType === "CLOSING";
  /** Cashiers on a closing shift use the short form; admin/manager always get the full report editor. */
  const closingOnly = scheduleClosingOnly && !canManageReports;
  const readOnly = locked && !canManageReports;
  const scheduledOff = schedule != null && !schedule.working;
  const isNew = !entry;

  const summary = useMemo(
    () => reportSummary(form, expenses, closingOnly),
    [form, expenses, closingOnly]
  );
  const steps = useMemo(
    () => buildReportSteps(form, expenses, closingOnly),
    [form, expenses, closingOnly]
  );
  const validationIssues = useMemo(
    () => getReportValidationIssues(form, expenses, closingOnly),
    [form, expenses, closingOnly]
  );
  const canSubmit = reportReadyToSubmit(form, expenses, closingOnly);

  const selectedCashier = useMemo(
    () => cashiers.find((c) => c.id === selectedCashierId),
    [cashiers, selectedCashierId]
  );

  const shiftLabel = scheduledOff
    ? "Not scheduled"
    : schedule?.working
      ? `${schedule.hoursLabel}${schedule.closingOnly ? " · closing only" : ""}`
      : null;

  const loadShift = useCallback(async () => {
    if (canManageReports && !selectedCashierId) {
      setShiftType("FULL");
      setSchedule(null);
      return;
    }
    const params = new URLSearchParams({ date: entryDate });
    if (canManageReports && selectedCashierId) params.set("userId", selectedCashierId);
    try {
      const s = await api<WorkSchedule>(`/shifts/today?${params}`);
      setSchedule(s);
      setShiftType(s.shiftType);
    } catch {
      setShiftType("FULL");
      setSchedule(null);
    }
  }, [entryDate, canManageReports, selectedCashierId]);

  const loadSuggestedOpening = async (): Promise<{ form: EntryFormData; hint: typeof openingHint }> => {
    const params = new URLSearchParams({ date: entryDate });
    if (canManageReports && selectedCashierId) params.set("cashierId", selectedCashierId);
    try {
      const s = await api<{
        openingBalance: number;
        previousDate: string | null;
        source?: OpeningHint["source"];
        handoverCashierName?: string | null;
        handoverEndTime?: string | null;
        handoverPending?: boolean;
      }>(`/entries/suggested-opening?${params}`);
      const opening = num(s.openingBalance);
      const hint: OpeningHint | null =
        s.previousDate != null || s.handoverPending
          ? {
              amount: opening,
              fromDate: s.previousDate ?? entryDate,
              source: s.source,
              handoverCashierName: s.handoverCashierName,
              handoverEndTime: s.handoverEndTime,
              handoverPending: s.handoverPending,
            }
          : null;
      return { form: { ...emptyEntryForm(), openingBalance: opening }, hint };
    } catch {
      return { form: emptyEntryForm(), hint: null };
    }
  };

  const applyEntry = async (e: DailyEntry | null) => {
    if (e?.id) {
      try {
        e = await api<DailyEntry>(`/entries/${e.id}`);
      } catch {
        /* use list/today payload if detail fetch fails */
      }
    }
    setEntry(e);
    if (e) {
      const { hint } = await loadSuggestedOpening();
      setForm(entryToFormData(e));
      setOpeningHint(hint);
      if (e.shiftType) setShiftType(e.shiftType);
      if (e.schedule) setSchedule(e.schedule);
    } else {
      const { form: suggested, hint } = await loadSuggestedOpening();
      setForm(suggested);
      setOpeningHint(hint);
    }
    if (e?.id) {
      const lines = e.expenses?.length ? e.expenses : await loadExpenses(e.id);
      setExpenses(lines);
    } else {
      setExpenses([]);
    }
    markPristine();
  };

  const loadEntry = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setMessage("");
    try {
      await loadShift();
      if (canManageReports) {
        if (!selectedCashierId) {
          await applyEntry(null);
          return;
        }
        const params = new URLSearchParams({
          from: entryDate,
          to: entryDate,
          cashierId: selectedCashierId,
        });
        const list = await api<DailyEntry[]>(`/entries?${params}`);
        await applyEntry(list[0] ?? null);
      } else {
        const todayParams = new URLSearchParams({ date: entryDate });
        let e = await api<DailyEntry | null>(`/entries/today?${todayParams}`);
        if (!e) {
          const list = await api<DailyEntry[]>(
            `/entries?from=${encodeURIComponent(entryDate)}&to=${encodeURIComponent(entryDate)}`
          );
          e = list[0] ?? null;
        }
        await applyEntry(e);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load");
      setMessageError(true);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [canManageReports, selectedCashierId, entryDate, loadShift]);

  useEffect(() => {
    if (canManageReports) {
      const d = searchParams.get("date");
      const c = searchParams.get("cashierId");
      if (d && d !== entryDate) setEntryDate(d);
      if (c && c !== selectedCashierId) setSelectedCashierId(c);
    } else {
      setEntryDate(todayIso());
    }
  }, [searchParams, canManageReports]);

  useEffect(() => {
    if (!canManageReports || !selectedCashierId) return;
    const params = new URLSearchParams();
    params.set("date", entryDate);
    params.set("cashierId", selectedCashierId);
    setSearchParams(params, { replace: true });
  }, [entryDate, selectedCashierId, canManageReports, setSearchParams]);

  useEffect(() => {
    api<{ platforms: Platforms }>("/settings").then((s) => setPlatforms(s.platforms));
    api<Pick<TreasurySettings, "cardSalesSettlementRate" | "platformSettlementRates">>(
      "/treasury/settlement-defaults"
    )
      .then(setTreasurySettings)
      .catch(() => setTreasurySettings(null));
    if (canManageReports) {
      api<User[]>("/users")
        .then((list) => {
          const active = list.filter((u) => u.role === "CASHIER" && u.active !== false);
          setCashiers(active);
          const fromUrl = searchParams.get("cashierId");
          if (fromUrl && active.some((c) => c.id === fromUrl)) {
            setSelectedCashierId(fromUrl);
          } else if (active.length && !selectedCashierId) {
            setSelectedCashierId(active[0].id);
          }
        })
        .catch((err) => {
          setMessage(err instanceof Error ? err.message : "Failed to load cashiers");
          setMessageError(true);
        });
    }
  }, [canManageReports]);

  useEffect(() => {
    if (!canManageReports) return;
    if (!searchParams.get("cashierId") && cashiers.length > 0) {
      navigate("/reports", { replace: true });
    }
  }, [canManageReports, searchParams, cashiers.length, navigate]);

  useEffect(() => {
    if (canManageReports && !selectedCashierId) {
      setLoading(false);
      return;
    }
    loadEntry();
  }, [loadEntry, canManageReports, selectedCashierId]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (canManageReports && !selectedCashierId) return;
      // Never overwrite unsaved edits or interrupt a save/upload in progress.
      if (dirtyRef.current || saving) return;
      void loadEntry({ silent: true });
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [loadEntry, canManageReports, selectedCashierId, saving]);

  const persistExpenses = async (entryId: string, lines: ExpenseLine[]) => {
    const before = [...lines];
    const synced = await syncExpenses(entryId, lines);
    return uploadPendingInvoices(before, synced);
  };

  const findEntryForDate = async (): Promise<DailyEntry | null> => {
    const todayParams = new URLSearchParams({ date: entryDate });
    let e = await api<DailyEntry | null>(`/entries/today?${todayParams}`);
    if (!e) {
      const list = await api<DailyEntry[]>(
        `/entries?from=${encodeURIComponent(entryDate)}&to=${encodeURIComponent(entryDate)}`
      );
      e = list[0] ?? null;
    }
    return e;
  };

  const save = async (): Promise<DailyEntry | null> => {
    setSaving(true);
    setMessage("");
    setMessageError(false);
    try {
      if (canManageReports && !selectedCashierId) {
        setMessage("Select a cashier");
        setMessageError(true);
        return null;
      }
      const body = canManageReports
        ? { ...form, date: entryDate, cashierId: selectedCashierId }
        : { ...form, date: entryDate };

      let entryId = entry?.id;
      if (entryId) {
        try {
          await api<DailyEntry>(`/entries/${entryId}`);
        } catch {
          entryId = undefined;
        }
      }
      if (!entryId) {
        const existing = await findEntryForDate();
        entryId = existing?.id;
      }

      let saved: DailyEntry;
      if (entryId) {
        saved = await api<DailyEntry>(`/entries/${entryId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        try {
          saved = await api<DailyEntry>("/entries", {
            method: "POST",
            body: JSON.stringify(body),
          });
        } catch (err) {
          const existing = await findEntryForDate();
          if (!existing?.id) throw err;
          saved = await api<DailyEntry>(`/entries/${existing.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        }
      }

      if (!closingOnly) {
        const synced = await persistExpenses(saved.id, expenses);
        setExpenses(synced);
      }
      const refreshed = await api<DailyEntry>(`/entries/${saved.id}`);
      await applyEntry(refreshed);
      const who = selectedCashier?.name ?? "Cashier";
      const when = reportDateRelativeLabel(entryDate);
      setMessage(
        entry
          ? `Draft saved for ${who} · ${when}`
          : `Report created for ${who} · ${when}`
      );
      return refreshed;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
      setMessageError(true);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveReceipts = async () => {
    if (!entry?.id || closingOnly) return;
    setSaving(true);
    setMessage("");
    setMessageError(false);
    try {
      const synced = await persistExpenses(entry.id, expenses);
      setExpenses(synced.length ? synced : expenses);
      setMessage(`Receipt photos saved for ${selectedCashier?.name ?? "cashier"}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save receipts");
      setMessageError(true);
    } finally {
      setSaving(false);
    }
  };

  const unlockForCashier = async () => {
    if (!entry?.id) return;
    const who = selectedCashier?.name ?? "this cashier";
    const when = reportDateRelativeLabel(entryDate);
    if (
      !confirm(
        `Unlock the report for ${who} (${when})?\n\nThey can edit and resubmit in the app. The report stays a draft until submitted again.`
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage("");
    setMessageError(false);
    try {
      const updated = await api<DailyEntry>(`/entries/${entry.id}/unlock`, { method: "POST" });
      await applyEntry({ ...updated, status: "DRAFT" });
      await loadEntry({ silent: true });
      setMessage(
        `Unlocked for ${who} — report is draft again; edit below or have them refresh the cashier app · ${when}`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unlock failed");
      setMessageError(true);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) {
      setMessage("Fix the items listed under “Complete before submitting” first.");
      setMessageError(true);
      return;
    }
    const who = selectedCashier?.name ?? user?.name ?? "this cashier";
    const when = reportDateRelativeLabel(entryDate);
    const diffNote =
      Math.abs(summary.difference) > 0.01
        ? `\n\nCash difference: ${fmt(summary.difference)}`
        : "\n\nCash is balanced.";
    const submitPrompt = locked && canManageReports
      ? `Save changes and keep this report submitted for ${who} (${when})?${diffNote}`
      : `Submit and lock the report for ${who} (${when})? After submit, the cashier cannot edit it.${diffNote}`;
    if (!confirm(submitPrompt)) {
      return;
    }
    setSaving(true);
    setMessage("");
    setMessageError(false);
    try {
      const current = await save();
      if (!current) return;
      const updated = await api<DailyEntry>(`/entries/${current.id}/submit`, { method: "POST" });
      await applyEntry(updated);
      setMessage(
        `Submitted and locked — ${selectedCashier?.name ?? "Cashier"} · ${reportDateRelativeLabel(entryDate)}`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submit failed");
      setMessageError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !canManageReports) return <Spinner label="Loading report…" />;

  return (
    <div>
      {canManageReports && (
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-saffron)] mb-3 hover:underline"
        >
          ← All shift reports
        </Link>
      )}
      <PageHeader
        title={
          canManageReports
            ? isNew
              ? "New shift report"
              : locked
                ? "Edit submitted report"
                : "Edit shift report"
            : isNew
              ? "New report"
              : "Today's report"
        }
        subtitle={
          canManageReports
            ? `${selectedCashier?.name ?? "Cashier"} · ${reportDateRelativeLabel(entryDate)}`
            : undefined
        }
      />

      {canManageReports && (
        <ReportContextBanner
          adminPicker
          date={entryDate}
          maxDate={todayIso()}
          onDateChange={setEntryDate}
          cashierId={selectedCashierId}
          cashierName={selectedCashier?.name}
          cashiers={cashiers}
          onCashierChange={setSelectedCashierId}
          status={entry?.status ?? (isNew ? "NEW" : undefined)}
          shiftLabel={selectedCashierId ? shiftLabel : null}
        />
      )}

      {!canManageReports && (
        <ReportContextBanner
          date={entryDate}
          cashierName={user?.name}
          status={entry?.status ?? (isNew ? "NEW" : undefined)}
          shiftLabel={shiftLabel}
        />
      )}

      {canManageReports && isNew && selectedCashierId && !loading && (
        <Alert variant="info" className="mb-4">
          <strong>No report yet</strong> for {selectedCashier?.name} on{" "}
          {reportDateRelativeLabel(entryDate).toLowerCase()}. Fill in the form below, save a draft,
          then submit when the drawer balances.
        </Alert>
      )}

      {locked && !canManageReports && (
        <Alert variant="warning" className="mb-4">
          This report is locked. Contact your manager to unlock it, then refresh this page (or switch
          away and back) to edit and submit again.
        </Alert>
      )}

      {scheduleClosingOnly && canManageReports && !closingOnly && (
        <Alert variant="info" className="mb-4">
          <strong>Closing shift on schedule</strong> — you still have the full report editor (sales,
          expenses, payouts). Cashiers only see opening + cash count for this shift type.
        </Alert>
      )}

      {locked && canManageReports && (
        <Alert variant="info" className="mb-4">
          <strong>Submitted and locked.</strong> Edit any section below and save, or submit again to
          re-lock. Use <em>Unlock for cashier</em> only if {selectedCashier?.name ?? "they"} need the
          cashier app.
          {entry?.submittedAt && (
            <span className="block mt-1 text-sm font-normal opacity-90">
              Submitted {new Date(entry.submittedAt).toLocaleString()}
            </span>
          )}
        </Alert>
      )}

      {scheduledOff && !locked && (
        <Alert variant="warning" className="mb-4">
          {canManageReports
            ? "Not on the schedule for this date — you can still create a report."
            : "You are not scheduled today. Open a report only if you are working."}
        </Alert>
      )}

      {message && (
        <Alert variant={messageError ? "error" : "success"} className="mb-4 text-center">
          {message}
        </Alert>
      )}

      {canManageReports && !selectedCashierId ? (
        <Card className="text-center py-12 text-[var(--color-muted)]">
          <p className="font-medium text-[var(--color-ink)]">Choose a cashier</p>
          <p className="text-sm mt-1">Pick who this report is for, then fill in or create it.</p>
        </Card>
      ) : loading ? (
        <Spinner label="Loading report…" />
      ) : scheduledOff && !canManageReports && !entry ? (
        <Card className="text-center py-12 text-[var(--color-muted)]">
          <p>No report needed — you are not scheduled today.</p>
        </Card>
      ) : (
        <>
          {isNew && !readOnly && (
            <Card className="mb-4 !p-4 bg-[var(--color-saffron)]/8 border-[var(--color-saffron)]/25">
              <p className="text-sm leading-relaxed">
                {closingOnly
                  ? "Enter opening cash and your final count. Save a draft first, then submit when done."
                  : "Work through each section below. Opening is prefilled when possible. Save anytime, submit when the drawer matches."}
              </p>
            </Card>
          )}

          {!readOnly && <ReportStepper steps={steps} />}

          {!readOnly && (
            <ReportValidationPanel issues={validationIssues} ready={canSubmit} />
          )}

          {(!readOnly || locked) && (
            <ReportSummaryBar
              opening={summary.opening}
              sales={summary.sales}
              expected={summary.expected}
              actual={summary.actual}
              difference={summary.difference}
              closingOnly={closingOnly}
            />
          )}

          <div
            data-tour="tour-entry-form"
            className={!readOnly || (locked && canManageReports) ? "mb-40 md:mb-0" : ""}
          >
            {closingOnly ? (
              <ClosingEntryForm
                data={form}
                onChange={handleFormChange}
                disabled={readOnly}
                openingEditable={canManageReports}
                openingHint={openingHint}
              />
            ) : (
              <EntryForm
                data={form}
                expenses={
                  expenses.length ? expenses : readOnly ? expenses : [emptyExpenseLine()]
                }
                onChange={handleFormChange}
                onExpensesChange={handleExpensesChange}
                disabled={readOnly}
                invoicesEditable={canManageReports || !locked}
                openingEditable={canManageReports}
                platforms={platforms}
                openingHint={openingHint}
                treasurySettings={treasurySettings ?? undefined}
              />
            )}
          </div>

          {!readOnly ? (
            <ReportActionBar
              saving={saving}
              isNew={isNew}
              canSubmit={canSubmit}
              difference={summary.difference}
              onSave={save}
              onSubmit={submit}
              showSubmit={!locked || canManageReports}
              onUnlock={locked && canManageReports ? unlockForCashier : undefined}
              unlockLabel={`Unlock for ${selectedCashier?.name ?? "cashier"}`}
              secondaryAction={
                locked && canManageReports && !closingOnly
                  ? { label: "Save receipt photos", onClick: saveReceipts }
                  : undefined
              }
            />
          ) : (
            entry && (
              <div className="action-bar md:static md:mt-6">
                <div className="bg-white/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-2xl md:rounded-none border border-black/5 md:border-0 p-3 md:p-0 shadow-lg md:shadow-none">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => void loadEntry()}
                    disabled={loading}
                    className="py-3.5 text-base"
                  >
                    {loading ? "Refreshing…" : "Refresh report"}
                  </Button>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
