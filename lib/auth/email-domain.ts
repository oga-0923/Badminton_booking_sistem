function getAllowedDomains(): string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedUniversityEmail(email: string): boolean {
  const domains = getAllowedDomains();
  if (domains.length === 0) return true; // 未設定時は開発用に制限しない

  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();

  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}
