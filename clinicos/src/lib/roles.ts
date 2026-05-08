/**
 * Centralized role resolver — single source of truth for ALL role checks.
 * DB values: "admin" | "doctor" | "assistant" | "patient"
 */

export const MEDICAL_ROLES = ["admin", "doctor"] as const;
export type   MedicalRole  = typeof MEDICAL_ROLES[number];

export function isMedicalStaff(role?: string | null): role is MedicalRole {
  return MEDICAL_ROLES.includes(role as MedicalRole);
}

export function canReceivePatients(role?: string | null): boolean {
  return isMedicalStaff(role);
}

export function isSecretary(role?: string | null): boolean {
  return role === "assistant";
}

export function displayRole(role?: string | null): string {
  switch (role) {
    case "admin":     return "Médecin Admin";
    case "doctor":    return "Médecin";
    case "assistant": return "Secrétaire";
    default:          return "Utilisateur";
  }
}
