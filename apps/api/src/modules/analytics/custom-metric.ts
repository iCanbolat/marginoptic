/**
 * Faz 7 — Güvenli özel-metrik formül değerlendirici.
 *
 * `eval` KULLANMAZ. Whitelist alan adları + sayı sabitleri + `+ - * /` ve parantez.
 * Küçük bir tokenizer + recursive-descent parser ile AST'ye çevirir; verilen
 * değerler haritası üzerinde değerlendirir. Sıfıra bölme / bilinmeyen alan / geçersiz
 * sözdizimi → değerlendirmede `null` döner (validate aşamasında hata fırlatılır).
 *
 * Dilbilgisi:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := '-' factor | '(' expr ')' | number | identifier
 */

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

export type Ast =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "neg"; e: Ast }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; l: Ast; r: Ast };

class ParseError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rp" });
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const raw = input.slice(i, j);
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new ParseError(`Geçersiz sayı: ${raw}`);
      tokens.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++;
      tokens.push({ t: "id", v: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new ParseError(`Beklenmeyen karakter: "${c}"`);
  }
  return tokens;
}

function parse(tokens: Token[]): Ast {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];

  function parseExpr(): Ast {
    let left = parseTerm();
    let tok = peek();
    while (tok && tok.t === "op" && (tok.v === "+" || tok.v === "-")) {
      pos++;
      const right = parseTerm();
      left = { k: "bin", op: tok.v, l: left, r: right };
      tok = peek();
    }
    return left;
  }

  function parseTerm(): Ast {
    let left = parseFactor();
    let tok = peek();
    while (tok && tok.t === "op" && (tok.v === "*" || tok.v === "/")) {
      pos++;
      const right = parseFactor();
      left = { k: "bin", op: tok.v, l: left, r: right };
      tok = peek();
    }
    return left;
  }

  function parseFactor(): Ast {
    const tok = peek();
    if (!tok) throw new ParseError("Beklenmeyen formül sonu");
    if (tok.t === "op" && tok.v === "-") {
      pos++;
      return { k: "neg", e: parseFactor() };
    }
    if (tok.t === "op" && tok.v === "+") {
      pos++;
      return parseFactor();
    }
    if (tok.t === "lp") {
      pos++;
      const e = parseExpr();
      const next = peek();
      if (!next || next.t !== "rp") throw new ParseError("Kapanış parantezi yok");
      pos++;
      return e;
    }
    if (tok.t === "num") {
      pos++;
      return { k: "num", v: tok.v };
    }
    if (tok.t === "id") {
      pos++;
      return { k: "id", v: tok.v };
    }
    throw new ParseError("Beklenmeyen ifade");
  }

  const ast = parseExpr();
  if (pos !== tokens.length) throw new ParseError("Fazladan ifade");
  return ast;
}

/** Formülde geçen alan adlarını toplar. */
function collectFields(ast: Ast, out: Set<string>): void {
  switch (ast.k) {
    case "id":
      out.add(ast.v);
      break;
    case "neg":
      collectFields(ast.e, out);
      break;
    case "bin":
      collectFields(ast.l, out);
      collectFields(ast.r, out);
      break;
  }
}

export interface FormulaValidation {
  ok: boolean;
  error?: string;
  /** Formülde kullanılan alanlar. */
  fields: string[];
}

/**
 * Formülü sözdizimi + alan whitelist'ine göre doğrular.
 * `allowedFields` dışında bir tanımlayıcı varsa hata döner.
 */
export function validateFormula(
  formula: string,
  allowedFields: readonly string[],
): FormulaValidation {
  let ast: Ast;
  try {
    ast = parse(tokenize(formula));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Geçersiz formül",
      fields: [],
    };
  }
  const fields = new Set<string>();
  collectFields(ast, fields);
  const allowed = new Set(allowedFields);
  const unknown = [...fields].filter((f) => !allowed.has(f));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Bilinmeyen alan(lar): ${unknown.join(", ")}`,
      fields: [...fields],
    };
  }
  return { ok: true, fields: [...fields] };
}

function evalAst(ast: Ast, values: Record<string, number>): number {
  switch (ast.k) {
    case "num":
      return ast.v;
    case "id": {
      const v = values[ast.v];
      if (v == null || !Number.isFinite(v)) throw new ParseError("nan");
      return v;
    }
    case "neg":
      return -evalAst(ast.e, values);
    case "bin": {
      const l = evalAst(ast.l, values);
      const r = evalAst(ast.r, values);
      switch (ast.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          if (r === 0) throw new ParseError("div0");
          return l / r;
      }
    }
  }
}

/**
 * Formülü değer haritasıyla değerlendirir. Geçersiz/sıfıra bölme/eksik alan → null.
 * Sonuç sonsuz/NaN ise null.
 */
export function evaluateFormula(
  formula: string,
  values: Record<string, number>,
): number | null {
  try {
    const result = evalAst(parse(tokenize(formula)), values);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
