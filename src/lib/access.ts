const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const fieldAgentEmails = (process.env.FIELD_AGENT_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function getDefaultUserRole(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (adminEmails.includes(normalizedEmail)) {
    return "ADMIN";
  }

  if (fieldAgentEmails.includes(normalizedEmail)) {
    return "FIELD_AGENT";
  }

  return "USER";
}

export function canViewAll(role?: string | null) {
  return role === "ADMIN";
}

export function canHandleFieldCases(role?: string | null) {
  return role === "ADMIN" || role === "FIELD_AGENT";
}
