import type { Role } from "../types";

export function isCashier(role?: Role | string) {
  return role === "CASHIER";
}

export function isAdmin(role?: Role | string) {
  return role === "ADMIN";
}

export function isManager(role?: Role | string) {
  return role === "MANAGER";
}

/** Admin or manager — full operational access to reports and cash flow. */
export function canOperate(role?: Role | string) {
  return role === "ADMIN" || role === "MANAGER";
}

export function roleLabel(role: Role | string) {
  if (role === "ADMIN") return "Admin";
  if (role === "MANAGER") return "Manager";
  return "Cashier";
}
