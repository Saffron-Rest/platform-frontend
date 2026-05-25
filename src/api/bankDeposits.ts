import { api } from "./client";
import { num } from "../lib/numbers";
import type { BankDeposit, BankDepositLink } from "../types";
import { mapTags } from "./expenses";

function mapLink(raw: Record<string, unknown>): BankDepositLink {
  return {
    id: String(raw.id),
    linkedKind: String(raw.linkedKind),
    linkedRefId: String(raw.linkedRefId),
    linkedDate: String(raw.linkedDate),
    grossAmount: num(raw.grossAmount),
    share: num(raw.share),
  };
}

function mapDeposit(raw: Record<string, unknown>): BankDeposit {
  return {
    id: String(raw.id),
    bankDate: String(raw.bankDate),
    totalSettled: num(raw.totalSettled),
    totalGross: num(raw.totalGross),
    variance: num(raw.variance),
    linkCount: Number(raw.linkCount ?? 0),
    notes: raw.notes != null ? String(raw.notes) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
    links: Array.isArray(raw.links)
      ? (raw.links as Record<string, unknown>[]).map(mapLink)
      : [],
    tags: mapTags(raw.tags),
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
  };
}

export type BankDepositLinkPayload = {
  linkedKind: string;
  linkedRefId: string;
  linkedDate: string;
  grossAmount: number;
};

export type BankDepositPayload = {
  bankDate: string;
  totalSettled: number;
  notes?: string;
  links: BankDepositLinkPayload[];
};

export async function listBankDeposits(from: string, to: string): Promise<BankDeposit[]> {
  const raw = await api<Record<string, unknown>[]>(
    `/bank-deposits?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  return raw.map(mapDeposit);
}

export async function createBankDeposit(payload: BankDepositPayload): Promise<BankDeposit> {
  const raw = await api<Record<string, unknown>>("/bank-deposits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapDeposit(raw);
}

export async function deleteBankDeposit(id: string): Promise<void> {
  await api(`/bank-deposits/${id}`, { method: "DELETE" });
}
