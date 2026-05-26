import { api } from "./client";

/** One entry in the system-wide permission catalog. The backend is the
 *  source of truth — labels, descriptions, and categories live in the
 *  {@code Permission} enum and ship to the client via this endpoint so
 *  we never duplicate the copy. */
export type PermissionCatalogEntry = {
  key: string;
  label: string;
  description: string;
  /** Stable enum name of the category (e.g. {@code "STOCK"}). Used as a
   *  React key when grouping; UI copy should prefer {@link categoryLabel}. */
  category: string;
  /** Human-readable category label (e.g. {@code "Stock & inventory"}). */
  categoryLabel: string;
};

/** Permissions view for a single user. */
export type UserPermissions = {
  userId: string;
  username: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  isAdmin: boolean;
  /** Keys baked in by the user's role. Admins can revoke any of these
   *  via the {@link revokedPermissions} set — they're not locked. */
  roleDefaultPermissions: string[];
  /** Admin-granted keys on top of the role defaults. */
  extraPermissions: string[];
  /** Role-default keys an admin has explicitly revoked. */
  revokedPermissions: string[];
  /** {@code (defaults − revokes) ∪ extras} — what the user actually has. */
  effectivePermissions: string[];
  /** Bundled catalog so the modal doesn't need a second fetch. */
  catalog: PermissionCatalogEntry[];
};

export async function getPermissionCatalog() {
  return api<PermissionCatalogEntry[]>("/users/permission-catalog");
}

export async function getUserPermissions(userId: string) {
  return api<UserPermissions>(`/users/${userId}/permissions`);
}

/**
 * Replace the user's full effective permission set. Pass the desired
 * union — every permission the user should have. The server splits
 * the diff against role defaults into "extras" (granted above the
 * baseline) and "revokes" (denied from the baseline) and persists
 * both as small CSV columns.
 */
export async function setUserPermissions(
  userId: string,
  permissions: string[],
  reason?: string
) {
  return api<UserPermissions>(`/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({
      permissions,
      reason: reason ?? null,
    }),
  });
}
