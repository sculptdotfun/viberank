const EMAIL_RE = /^[A-Za-z0-9.!#$'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const EMAIL_MAX_LENGTH = 254;

export function normalizeWorkEmail(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Enter a valid contact email.");

  const email = value.trim();
  if (!email) return null;
  if (email.length > EMAIL_MAX_LENGTH) throw new Error("Enter a valid contact email.");
  if (/[?&%#:\r\n]/.test(email)) throw new Error("Enter a valid contact email.");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid contact email.");

  return email;
}

export function buildWorkEmailHref(email: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Viberank work inquiry")}`;
}
