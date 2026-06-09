import { useEffect, useRef, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPayableAging, listPayables } from "../api/payables";
import { listItems } from "../api/menu";
import { getTreasuryLedger } from "../api/treasury";
import { getWeekForecast } from "../api/forecast";
import { Spinner } from "../components/ui/Spinner";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { IconRefresh, IconSparkle } from "../components/icons";

// ─── types ───────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ContextStatus = "loading" | "ready" | "error";

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function buildContext(): Promise<string> {
  const parts: string[] = [];
  const date = today();
  parts.push(`Today: ${date}`);
  parts.push(`Restaurant: Saffron (Polish restaurant)`);
  parts.push(`Currency: PLN (Polish złoty, zł)`);

  // Treasury — current month cash + card ledger
  try {
    const [cash, card] = await Promise.all([
      getTreasuryLedger({ source: "CASH", from: monthStart(), to: date }),
      getTreasuryLedger({ source: "CARD", from: monthStart(), to: date }),
    ]);
    const cashIncome = cash.rows.filter((r) => r.sign === "+").reduce((s, r) => s + r.amount, 0);
    const cashOut    = cash.rows.filter((r) => r.sign === "-").reduce((s, r) => s + r.amount, 0);
    const cardIncome = card.rows.filter((r) => r.sign === "+").reduce((s, r) => s + r.amount, 0);
    const cardOut    = card.rows.filter((r) => r.sign === "-").reduce((s, r) => s + r.amount, 0);
    parts.push(
      `\nTREASURY (this month so far):` +
      `\n  Cash: opening=${cash.openingBalance.toFixed(2)} income=+${cashIncome.toFixed(2)} outgoings=-${cashOut.toFixed(2)} closing=${cash.closingBalance.toFixed(2)}` +
      `\n  Card: opening=${card.openingBalance.toFixed(2)} income=+${cardIncome.toFixed(2)} outgoings=-${cardOut.toFixed(2)} closing=${card.closingBalance.toFixed(2)}` +
      `\n  Total balance: ${(cash.closingBalance + card.closingBalance).toFixed(2)} zł`
    );
  } catch {
    parts.push(`\nTREASURY: data unavailable`);
  }

  // Payables
  try {
    const [aging, outstanding] = await Promise.all([
      getPayableAging(),
      listPayables("OUTSTANDING"),
    ]);
    parts.push(
      `\nPAYABLES OUTSTANDING (what we owe suppliers):` +
      `\n  Current (not yet due): ${aging.current.toFixed(2)} zł` +
      `\n  1–7 days overdue: ${aging.d1to7.toFixed(2)} zł` +
      `\n  8–30 days overdue: ${aging.d8to30.toFixed(2)} zł` +
      `\n  31–60 days overdue: ${aging.d31to60.toFixed(2)} zł` +
      `\n  60+ days overdue: ${aging.d60plus.toFixed(2)} zł` +
      `\n  Total outstanding: ${aging.total.toFixed(2)} zł` +
      `\n  Outstanding invoices: ${outstanding.totals.count}, overdue count: ${outstanding.totals.overdueCount}`
    );
  } catch {
    parts.push(`\nPAYABLES: data unavailable`);
  }

  // Menu — top 15 active items sorted by sell price, show margin
  try {
    const items = await listItems({ includeArchived: false });
    const active = items.filter((i) => i.active && i.foodCost != null && i.foodCost > 0);
    const sorted = [...active].sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0));
    const top = sorted.slice(0, 15);
    const low = sorted.slice(-5);
    const lines = top
      .map((i) => `  ${i.name}: price=${i.sellPrice.toFixed(2)} cost=${(i.foodCost ?? 0).toFixed(2)} margin=${(i.marginPct ?? 0).toFixed(1)}%`)
      .join("\n");
    const lowLines = low
      .map((i) => `  ${i.name}: price=${i.sellPrice.toFixed(2)} cost=${(i.foodCost ?? 0).toFixed(2)} margin=${(i.marginPct ?? 0).toFixed(1)}%`)
      .join("\n");
    parts.push(`\nMENU (top 15 by margin):\n${lines}`);
    parts.push(`\nMENU (lowest 5 margins):\n${lowLines}`);
    const avgMargin = active.reduce((s, i) => s + (i.marginPct ?? 0), 0) / (active.length || 1);
    parts.push(`  Average menu margin: ${avgMargin.toFixed(1)}%  Active items with cost data: ${active.length}`);
  } catch {
    parts.push(`\nMENU: data unavailable`);
  }

  // Forecast
  try {
    const forecast = await getWeekForecast(7);
    const days = forecast.days.map((d) =>
      `  ${d.dayName}: predicted=${d.predictedSales?.toFixed(0) ?? "?"} zł confidence=${d.confidence ?? "?"}`
    ).join("\n");
    parts.push(`\nSALES FORECAST (next 7 days):\n${days}`);
    parts.push(`  Forecast week total: ${forecast.weekSummary.total.toFixed(0)} zł  avg/day: ${forecast.weekSummary.avgPerDay.toFixed(0)} zł`);
  } catch {
    parts.push(`\nFORECAST: data unavailable`);
  }

  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are Saffron Advisor — an AI business manager for a Polish restaurant called Saffron.

RULES (never break these):
1. You ONLY give advice, analysis, and recommendations. You CANNOT and WILL NOT make any changes to any system, database, or file.
2. Always quantify your advice when possible: suggest specific numbers, percentages, amounts in zł.
3. Be concise and direct. Use bullet points. Sound like a sharp business mentor, not an academic paper.
4. If you spot a risk (overdue payables, low margins, cash shortage), name it clearly and tell the owner what to do about it.
5. When asked to calculate, show your working briefly.
6. Do not repeat the context data back to the user unless it is directly relevant to answering their question.
7. Never apologize for being an AI or hedge excessively. Give a clear answer, then note any uncertainties at the end if needed.

You have access to live restaurant data (treasury balances, payables, menu margins, sales forecast) loaded at the start of this session.`;

const QUICK_PROMPTS = [
  "Give me a quick financial health check",
  "Which menu items should I reprice?",
  "What overdue payments need urgent attention?",
  "How can I improve my cash flow this month?",
  "What does this week's forecast tell me?",
  "Where is the most margin I'm leaving on the table?",
];

// ─── page ─────────────────────────────────────────────────────────────────────

export function AiAdvisor() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const [contextStatus, setContextStatus] = useState<ContextStatus>("loading");
  const [contextText,   setContextText]   = useState("");
  const [contextError,  setContextError]  = useState("");
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState("");
  const [thinking,      setThinking]      = useState(false);
  const [streamText,    setStreamText]    = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadContext = async () => {
    setContextStatus("loading");
    setContextError("");
    try {
      const ctx = await buildContext();
      setContextText(ctx);
      setContextStatus("ready");
    } catch (e) {
      setContextError(e instanceof Error ? e.message : "Failed to load restaurant data");
      setContextStatus("error");
    }
  };

  useEffect(() => { void loadContext(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const send = async (text: string) => {
    if (!text.trim() || thinking || !apiKey || contextStatus !== "ready") return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);
    setStreamText("");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Build full context prompt for the first message only
      const systemTurn = `${SYSTEM_PROMPT}\n\nRESTAURANT DATA (loaded at session start):\n${contextText}`;

      const history = [
        { role: "user" as const,  parts: [{ text: systemTurn }] },
        { role: "model" as const, parts: [{ text: "Understood. I'm ready to advise based on the current data." }] },
        ...messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: m.content }],
        })),
      ];

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(text.trim());

      let full = "";
      for await (const chunk of result.stream) {
        const t = chunk.text();
        full += t;
        setStreamText(full);
      }

      setMessages((m) => [...m, { role: "assistant", content: full }]);
      setStreamText("");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Gemini request failed";
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${errMsg}` }]);
      setStreamText("");
    } finally {
      setThinking(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  // ── no API key configured ─────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] mb-2">
          <IconSparkle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-ink)]">AI Advisor not configured</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Add your Gemini API key to enable the AI advisor.
        </p>
        <div className="rounded-xl bg-black/5 px-4 py-3 text-left text-sm font-mono text-[var(--color-ink)] space-y-1">
          <p className="text-xs text-[var(--color-muted)] font-sans mb-2">
            Create a <code className="bg-black/8 px-1 rounded">.env</code> file in{" "}
            <code className="bg-black/8 px-1 rounded">platform-frontend/</code>:
          </p>
          <p>VITE_GEMINI_API_KEY=your_key_here</p>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Get a free key at{" "}
          <span className="font-medium text-[var(--color-ink)]">aistudio.google.com</span>
          {" "}→ "Get API key"
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1 py-3 border-b border-black/8 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] shrink-0">
          <IconSparkle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-[var(--color-ink)]">Saffron Advisor</h1>
          <p className="text-xs text-[var(--color-muted)]">
            {contextStatus === "loading" && "Loading restaurant data…"}
            {contextStatus === "ready"   && "Restaurant data loaded · advice only, no changes"}
            {contextStatus === "error"   && "Data load error"}
          </p>
        </div>
        {contextStatus === "ready" && (
          <button
            type="button"
            onClick={() => { void loadContext(); setMessages([]); }}
            className="p-1.5 rounded-lg text-[var(--color-muted)] hover:bg-black/5 transition-colors"
            title="Reload context & clear chat"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Context loading / error ───────────────────────────────────── */}
      {contextStatus === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
          <Spinner />
          <p className="text-sm">Loading treasury, menu, payables & forecast…</p>
        </div>
      )}

      {contextStatus === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Alert variant="error">{contextError}</Alert>
          <Button onClick={() => void loadContext()}>Retry</Button>
        </div>
      )}

      {/* ── Chat area ─────────────────────────────────────────────────── */}
      {contextStatus === "ready" && (
        <>
          <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">

            {/* Welcome / quick prompts */}
            {messages.length === 0 && !thinking && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[var(--color-saffron)]/8 border border-[var(--color-saffron)]/20 px-5 py-4">
                  <p className="text-sm font-medium text-[var(--color-ink)] mb-1">
                    Hello! I've loaded your restaurant data.
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    Ask me anything about your finances, menu margins, payables, or staffing. I'll give you clear, actionable advice — I won't make any changes.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2 px-1">
                    Quick questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        className="text-sm px-3 py-1.5 rounded-full border border-black/12 bg-white hover:bg-[var(--color-saffron)]/5 hover:border-[var(--color-saffron)]/40 text-[var(--color-ink)] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation */}
            {messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
            ))}

            {/* Streaming response */}
            {thinking && (
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] shrink-0 mt-0.5">
                  <IconSparkle className="w-4 h-4" />
                </div>
                <div className="flex-1 max-w-[85%]">
                  {streamText ? (
                    <div className="rounded-2xl rounded-tl-sm bg-white border border-black/8 px-4 py-3 text-sm text-[var(--color-ink)] shadow-sm">
                      <FormattedText text={streamText} />
                      <span className="inline-block w-1.5 h-4 bg-[var(--color-saffron)] animate-pulse ml-0.5 align-middle" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-black/8 shadow-sm w-16">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-saffron)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-saffron)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-saffron)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-black/8 px-1 py-3">
            <div className="flex items-end gap-2 rounded-2xl border border-black/12 bg-white px-3 py-2 shadow-sm focus-within:border-[var(--color-saffron)]/50 focus-within:ring-1 focus-within:ring-[var(--color-saffron)]/20 transition">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances, menu, payables, staffing…"
                className="flex-1 resize-none bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] outline-none min-h-[24px] max-h-[120px]"
                disabled={thinking}
              />
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={thinking || !input.trim()}
                className="shrink-0 mb-0.5 flex items-center justify-center w-7 h-7 rounded-xl bg-[var(--color-saffron)] text-white disabled:opacity-40 transition-opacity"
                aria-label="Send"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-muted)] text-center mt-1.5">
              Enter to send · Shift+Enter for new line · Powered by Gemini
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] shrink-0 mt-0.5">
          <IconSparkle className="w-4 h-4" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "ml-auto" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
            isUser
              ? "rounded-tr-sm bg-[var(--color-saffron)] text-white"
              : "rounded-tl-sm bg-white border border-black/8 text-[var(--color-ink)]"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <FormattedText text={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders markdown-lite: bold (**text**), bullet lists, line breaks. */
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const isBullet = /^(\s*[-*•]\s)/.test(line);
        const isNumbered = /^\s*\d+\.\s/.test(line);
        const isHeading = /^#+\s/.test(line);
        const cleaned = line
          .replace(/^#+\s/, "")
          .replace(/^(\s*[-*•]\s)/, "")
          .replace(/^\s*\d+\.\s/, "");
        const segments = renderBold(cleaned);
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (isHeading) return (
          <p key={i} className="font-semibold text-[var(--color-ink)] mt-2">{segments}</p>
        );
        if (isBullet || isNumbered) return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 text-[var(--color-saffron)] mt-px">{isNumbered ? line.match(/^\s*(\d+)\./)?.[1] + "." : "•"}</span>
            <span>{segments}</span>
          </div>
        );
        return <p key={i}>{segments}</p>;
      })}
    </div>
  );
}

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
