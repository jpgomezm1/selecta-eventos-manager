// Postgres DATE columns llegan al cliente como "YYYY-MM-DD". new Date(isoDate)
// las parsea como UTC 00:00, y al renderizar en zona UTC-5 caen al día anterior.
// parseLocalDate construye la Date en hora local sin corrimiento.

export function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatLocalDate(
  value: string | Date | null | undefined,
  locale: string = "es-CO",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseLocalDate(value);
  if (!d) return "";
  return d.toLocaleDateString(locale, options);
}
