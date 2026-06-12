/* Shared helpers for serializers. */
import type { PublicationMetadata, AdapterIssue } from "../metadata";

export const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function requireFields(
  meta: PublicationMetadata,
  fields: (keyof PublicationMetadata)[],
  target: string,
): AdapterIssue[] {
  const out: AdapterIssue[] = [];
  for (const f of fields) {
    const v = meta[f];
    const missing = v == null || (Array.isArray(v) && v.length === 0) || v === "";
    if (missing) {
      out.push({
        level: f === "isbn" ? "warning" : "error",
        field: String(f),
        message: `${target}: missing required field "${String(f)}"`,
      });
    }
  }
  return out;
}
