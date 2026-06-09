import { api } from "./client";

export type AiSettings = {
  geminiApiKey: string;
  configured: boolean;
};

export function getAiSettings(): Promise<AiSettings> {
  return api<AiSettings>("/settings/ai");
}

export function saveAiSettings(geminiApiKey: string): Promise<AiSettings> {
  return api<AiSettings>("/settings/ai", {
    method: "PUT",
    body: JSON.stringify({ geminiApiKey }),
  });
}
