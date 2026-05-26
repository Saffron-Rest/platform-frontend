import { api } from "./client";

export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Incident = {
  id: string;
  title: string;
  category: string | null;
  occurredOn: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string | null;
  estimatedCost: number | null;
  photoPath: string | null;
  reportedById: string;
  reportedByName?: string | null;
  assigneeId: string | null;
  assigneeName?: string | null;
  resolvedById: string | null;
  resolvedByName?: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentPayload = {
  title: string;
  category?: string | null;
  occurredOn: string;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  description?: string | null;
  estimatedCost?: number | null;
  photoPath?: string | null;
  assigneeId?: string | null;
};

export async function listIncidents() {
  return api<Incident[]>(`/incidents`);
}

export async function getIncident(id: string) {
  return api<Incident>(`/incidents/${id}`);
}

export async function createIncident(payload: IncidentPayload) {
  return api<Incident>(`/incidents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIncident(id: string, payload: Partial<IncidentPayload>) {
  return api<Incident>(`/incidents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resolveIncident(id: string, resolutionNotes: string, dismiss = false) {
  return api<Incident>(`/incidents/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolutionNotes, dismiss }),
  });
}

export async function reopenIncident(id: string) {
  return api<Incident>(`/incidents/${id}/reopen`, { method: "POST" });
}

export async function deleteIncident(id: string) {
  return api<{ deleted: string }>(`/incidents/${id}`, { method: "DELETE" });
}

export async function uploadIncidentPhoto(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return api<{ path: string }>(`/incidents/upload`, {
    method: "POST",
    body: formData,
  });
}

export function severityLabel(s: IncidentSeverity): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function statusLabel(s: IncidentStatus): string {
  switch (s) {
    case "OPEN": return "Open";
    case "IN_PROGRESS": return "In progress";
    case "RESOLVED": return "Resolved";
    case "DISMISSED": return "Dismissed";
  }
}
