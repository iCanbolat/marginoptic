/**
 * COGS toplu içe-aktarım için bağımsız (saf) CSV ayrıştırıcı.
 * Başlık satırı zorunlu; kolonlar isimle eşlenir (sıra serbest). Tırnaklı alan,
 * kaçışlı çift tırnak ("") ve CRLF desteklenir. Para alanları normalize edilir.
 */

export interface ParsedCogsRow {
  /** 1-tabanlı dosya satır numarası (başlık = 1). */
  line: number;
  sku: string | null;
  costAmount: string | null;
  handlingFee: string | null;
  currency: string | null;
  country: string | null;
  minQty: number;
  valid: boolean;
  error: string | null;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["sku", "variant_sku", "barcode"],
  cost: ["cost", "cost_amount", "unit_cost", "cogs"],
  handling: ["handling", "handling_fee"],
  currency: ["currency", "cur"],
  country: ["country", "country_code"],
  minQty: ["min_qty", "minimum_qty", "quantity"],
};

/** Tek bir CSV satırını alanlara böler (RFC-4180 benzeri, tırnak farkında). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function normalizeMoney(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!/\d/.test(cleaned)) return null; // rakam yoksa geçersiz ("abc" → "")
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(4);
}

function resolveColumns(
  header: string[],
): Partial<Record<keyof typeof COLUMN_ALIASES, number>> {
  const normalized = header.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const map: Partial<Record<string, number>> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

export interface ParseCogsCsvResult {
  rows: ParsedCogsRow[];
  /** Başlıkta zorunlu kolonlar yoksa dolu. */
  headerError: string | null;
}

export function parseCogsCsv(csv: string): ParseCogsCsvResult {
  const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Sondaki boş satırları at.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    return { rows: [], headerError: "CSV boş" };
  }

  const cols = resolveColumns(splitCsvLine(lines[0]!));
  if (cols.sku == null || cols.cost == null) {
    return {
      rows: [],
      headerError: "Başlıkta 'sku' ve 'cost' kolonları zorunlu",
    };
  }

  const rows: ParsedCogsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    if (lines[i]!.trim() === "") continue;
    const f = splitCsvLine(lines[i]!);
    const cell = (idx: number | undefined): string =>
      idx == null ? "" : (f[idx] ?? "").trim();

    const sku = cell(cols.sku) || null;
    const costRaw = cell(cols.cost);
    const handlingRaw = cell(cols.handling);
    const currency = (cell(cols.currency) || "").toUpperCase() || null;
    const country = (cell(cols.country) || "").toUpperCase() || null;
    const minQtyRaw = cell(cols.minQty);

    let error: string | null = null;
    let costAmount: string | null = null;
    let handlingFee: string | null = null;
    let minQty = 1;

    if (!sku) {
      error = "sku boş";
    } else {
      costAmount = normalizeMoney(costRaw);
      if (costAmount == null) {
        error = `geçersiz cost: "${costRaw}"`;
      } else if (handlingRaw) {
        handlingFee = normalizeMoney(handlingRaw);
        if (handlingFee == null) error = `geçersiz handling: "${handlingRaw}"`;
      }
      if (!error && minQtyRaw) {
        const q = Number(minQtyRaw);
        if (!Number.isInteger(q) || q < 1) {
          error = `geçersiz min_qty: "${minQtyRaw}"`;
        } else {
          minQty = q;
        }
      }
      if (!error && currency && !/^[A-Z]{3}$/.test(currency)) {
        error = `geçersiz currency: "${currency}"`;
      }
      if (!error && country && !/^[A-Z]{2}$/.test(country)) {
        error = `geçersiz country: "${country}"`;
      }
    }

    rows.push({
      line: lineNo,
      sku,
      costAmount: error ? null : costAmount,
      handlingFee: error ? null : handlingFee,
      currency,
      country,
      minQty,
      valid: error == null,
      error,
    });
  }

  return { rows, headerError: null };
}
