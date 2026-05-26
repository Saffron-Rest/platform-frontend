import { api } from "./client";

/** One entry in the system-wide permission catalog. The backend is the
 *  source of truth — labels/descriptions live in the {@code Permission}
 *  enum and ship to the client via this endpoint so we never duplicate
 *  the copy. */
export type PermissionCatalogEntry = {
  key: string;
  label: string;
  description: string;
};

/** Permissions view for a single user. */
export type UserPermissions = {
  userId: string;
  username: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  isAdmin: boolean;
  /** Keys baked in by the user's role — cannot be unchecked. */
  roleDefaultPermissions: string[];
  /** Admin-granted keys on top of the role defaults. */
  extraPermissions: string[];
  /** Union of the above — what the user effectively has. */
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
 * Replace the user's *extra* permissions (above-role grants). Pass the
 * full desired set — anything not in {@code permissions} is revoked.
 * Permissions that are already implied by the user's role are silently
 * filtered server-side, so callers can send the union for convenience.
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
