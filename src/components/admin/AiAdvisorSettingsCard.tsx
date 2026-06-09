import { useEffect, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAiSettings, saveAiSettings } from "../../api/aiSettings";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import { IconSparkle } from "../icons";

export function AiAdvisorSettingsCard() {
  const [key,      setKey]      = useState("");
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saveErr,  setSaveErr]  = useState("");
  const [testing,  setTesting]  = useState(false);
  const [testOk,   setTestOk]   = useState<boolean | null>(null);
  const [testMsg,  setTestMsg]  = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    getAiSettings()
      .then((s) => { setKey(s.geminiApiKey); setConfigured(s.configured); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveErr("");
    setSaved(false);
    setTestOk(null);
    try {
      const s = await saveAiSettings(key.trim());
      setConfigured(s.configured);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const k = key.trim();
    if (!k) { setTestOk(false); setTestMsg("Enter a key first."); return; }
    setTesting(true);
    setTestOk(null);
    setTestMsg("");
    try {
      const genAI = new GoogleGenerativeAI(k);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent("Reply with exactly: OK");
      const text = result.response.text().trim();
      setTestOk(true);
      setTestMsg(`Connected — model responded: "${text.slice(0, 40)}"`);
    } catch (e) {
      setTestOk(false);
      setTestMsg(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await saveAiSettings("");
      setKey("");
      setConfigured(false);
      setTestOk(null);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] shrink-0">
          <IconSparkle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--color-ink)]">AI Advisor (Gemini)</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Powers the AI Advisor — business advice based on your live data. Stored securely in the database.
          </p>
        </div>
        {configured && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
            Active
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Spinner className="w-4 h-4" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
              Gemini API Key
            </label>
            <div className="flex gap-2">
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => { setKey(e.target.value); setTestOk(null); }}
                placeholder="Paste your Gemini API key…"
                className="field-input flex-1 font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="px-3 rounded-lg border border-black/12 text-xs text-[var(--color-muted)] hover:bg-black/5 transition-colors"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-1.5">
              Get a free key at{" "}
              <span className="font-medium text-[var(--color-ink)]">aistudio.google.com</span>
              {" "}→ Get API key. Saved to the database — works across all devices.
            </p>
          </div>

          {testOk === true  && <Alert variant="success">{testMsg}</Alert>}
          {testOk === false && <Alert variant="error">{testMsg}</Alert>}
          {saved            && <Alert variant="success">Key saved to database.</Alert>}
          {saveErr          && <Alert variant="error">{saveErr}</Alert>}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => void save()} disabled={saving || testing}>
              {saving ? "Saving…" : "Save key"}
            </Button>
            <Button variant="secondary" onClick={() => void test()} disabled={testing || saving || !key.trim()}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {configured && (
              <Button variant="ghost" onClick={() => void remove()} disabled={saving || testing}>
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
