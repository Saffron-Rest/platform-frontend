import { api } from "./client";

export type ChecklistType = "OPENING" | "CLOSING" | "PERIODIC";

export type ChecklistItem = {
  id: string;
  label: string;
  requiresPhoto?: boolean;
  requiresTemperature?: boolean;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  type: ChecklistType;
  role: string | null;
  description: string | null;
  items: ChecklistItem[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistResponse = {
  checked: boolean;
  notes?: string;
  photoPath?: string;
  checkedAt?: string | null;
};

export type ChecklistRun = {
  id: string;
  templateId: string;
  templateName?: string;
  runDate: string;
  completedById: string | null;
  completedByName?: string | null;
  responses: Record<string, ChecklistResponse>;
  totalItems: number;
  completedItems: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodayChecklist = {
  template: ChecklistTemplate;
  run: ChecklistRun | null;
};

export type TemplatePayload = {
  name: string;
  type: ChecklistType;
  role?: string | null;
  description?: string | null;
  items: ChecklistItem[];
  active?: boolean;
};

export async function listTemplates(includeArchived = false) {
  return api<ChecklistTemplate[]>(
    `/checklists/templates?includeArchived=${includeArchived ? "true" : "false"}`,
  );
}

export async function createTemplate(payload: TemplatePayload) {
  return api<ChecklistTemplate>(`/checklists/templates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(id: string, payload: Partial<TemplatePayload>) {
  return api<ChecklistTemplate>(`/checklists/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function archiveTemplate(id: string) {
  return api<{ archived: string }>(`/checklists/templates/${id}`, { method: "DELETE" });
}

export async function todayChecklists(date?: string) {
  const qs = date ? `?date=${date}` : "";
  return api<TodayChecklist[]>(`/checklists/today${qs}`);
}

export async function checklistHistory(days = 14) {
  return api<ChecklistRun[]>(`/checklists/history?days=${days}`);
}

export async function upsertRun(
  templateId: string,
  payload: { runDate?: string; responses: Record<string, ChecklistResponse>; notes?: string | null },
) {
  return api<ChecklistRun>(`/checklists/runs/${templateId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadChecklistPhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<{ path: string }>(`/checklists/upload`, { method: "POST", body: form });
}
