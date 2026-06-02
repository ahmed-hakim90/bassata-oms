/** Platform bootstrap admins who may access onboarding when an org already exists. */
export function getPlatformBootstrapEmails(): string[] {
  const raw = process.env.PLATFORM_BOOTSTRAP_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformBootstrapEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getPlatformBootstrapEmails().includes(normalized);
}
