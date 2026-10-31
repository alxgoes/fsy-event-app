import { createHash } from "node:crypto";
import type { RegistrationRawColumns } from "@/types/registrations";

const LOWERCASE_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);
const ROMAN_NUMERALS = new Set([
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

function hasIntentionalMixedCase(segment: string): boolean {
  if (segment.length < 3) return false;
  const upper = segment.toLocaleUpperCase("pt-BR");
  const lower = segment.toLocaleLowerCase("pt-BR");
  if (segment === upper || segment === lower) return false;

  // Se há maiúscula após o primeiro caractere precedida de minúscula (ex: McDonald, MacArthur, DeLaCruz)
  for (let i = 1; i < segment.length; i++) {
    const ch = segment.charAt(i);
    const prev = segment.charAt(i - 1);
    const isUpper = ch === ch.toLocaleUpperCase("pt-BR") && ch !== ch.toLocaleLowerCase("pt-BR");
    const prevIsLower =
      prev === prev.toLocaleLowerCase("pt-BR") && prev !== prev.toLocaleUpperCase("pt-BR");
    if (isUpper && prevIsLower) {
      return true;
    }
  }
  return false;
}

function capitalizeSubword(part: string, isSubsequentWord: boolean): string {
  if (!part) return part;
  const lower = part.toLocaleLowerCase("pt-BR");

  // Preserva algarismos romanos em sufixos de nome (ex: João Paulo II, Carlos III)
  if (isSubsequentWord && ROMAN_NUMERALS.has(lower)) {
    return lower.toUpperCase();
  }

  // Preserva palavras que já vieram em caixa mista intencional (ex: McDonald, MacArthur)
  if (hasIntentionalMixedCase(part)) {
    return part;
  }

  // Trata prefixos Mc / Mac quando vieram tudo em maiúsculas ou minúsculas (ex: MCDONALD -> McDonald)
  if (/^mc[a-zà-ÿ]{3,}$/i.test(part)) {
    return `Mc${lower.charAt(2).toLocaleUpperCase("pt-BR")}${lower.slice(3)}`;
  }

  const apoIdx = lower.indexOf("'");
  if (apoIdx > 0 && apoIdx < lower.length - 1) {
    if (lower.startsWith("d'") && lower.length > 2) {
      return `d'${lower.charAt(2).toLocaleUpperCase("pt-BR")}${lower.slice(3)}`;
    }
    const left = lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1, apoIdx);
    const right =
      lower.charAt(apoIdx + 1).toLocaleUpperCase("pt-BR") + lower.slice(apoIdx + 2);
    return `${left}'${right}`;
  }

  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function capitalizeToken(token: string, wordIndex: number): string {
  const lower = token.toLocaleLowerCase("pt-BR");
  if (wordIndex > 0 && LOWERCASE_PARTICLES.has(lower)) {
    return lower;
  }
  if (LOWERCASE_PARTICLES.has(lower)) {
    return lower;
  }
  if (lower.startsWith("d'") && lower.length > 2) {
    return `d'${lower.charAt(2).toLocaleUpperCase("pt-BR")}${lower.slice(3)}`;
  }
  return token
    .split("-")
    .map((part) => capitalizeSubword(part, wordIndex > 0))
    .join("-");
}

/**
 * Converte nomes próprios para Title Case segundo as convenções do Português do Brasil (`pt-BR`),
 * mantendo preposições/conjunções (`da`, `de`, `do`, `das`, `dos`, `e`) em minúsculas,
 * preservando caixa mista intencional (`McDonald`) e algarismos romanos (`II`, `III`, `IV`).
 */
export function normalizePtBrPersonName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ");
  return words.map((word, idx) => capitalizeToken(word, idx)).join(" ");
}

function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinBounded(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * M4: Verifica se dois nomes representam provavelmente a mesma pessoa (mesmo nome sem acentos,
 * primeiro+último nome idênticos ou distância de edição <= 2 em nomes com pelo menos 6 letras).
 */
export function areNamesProbablySamePerson(nameA: string, nameB: string): boolean {
  const normA = stripDiacritics(nameA);
  const normB = stripDiacritics(nameB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  if (normA.length >= 6 && normB.length >= 6 && levenshteinBounded(normA, normB, 2) <= 2) {
    return true;
  }

  const tokensA = normA.split(" ").filter((t) => !LOWERCASE_PARTICLES.has(t));
  const tokensB = normB.split(" ").filter((t) => !LOWERCASE_PARTICLES.has(t));
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const firstMatch =
      tokensA[0] === tokensB[0] ||
      (tokensA[0].length >= 4 &&
        tokensB[0].length >= 4 &&
        levenshteinBounded(tokensA[0], tokensB[0], 1) <= 1);
    const lastA = tokensA[tokensA.length - 1];
    const lastB = tokensB[tokensB.length - 1];
    const lastMatch =
      lastA === lastB ||
      (lastA.length >= 4 && lastB.length >= 4 && levenshteinBounded(lastA, lastB, 1) <= 1);
    if (firstMatch && lastMatch) return true;
  }

  return false;
}

/**
 * Detecta se um valor textual começa com caractere disparador de fórmula em planilhas
 * (`=`, `@`, `\t`, `\r`, ou `+`/`-` seguido de comando de fórmula).
 */
export function hasFormulaTriggerPrefix(value: string): boolean {
  if (!value) return false;
  const first = value.charAt(0);
  if (first === "=" || first === "@" || first === "\t" || first === "\r") {
    return true;
  }
  if (first === "+" || first === "-") {
    if (value === "-" || /^\+\d[\d\s().-]*$/.test(value)) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Neutraliza prefixos de fórmula para exportação segura em Excel/CSV sem alterar textos legítimos.
 */
export function neutralizeSpreadsheetFormula(value: string): string {
  if (!value) return "";
  if (hasFormulaTriggerPrefix(value)) {
    return `'${value}`;
  }
  const trimmedLeft = value.trimStart();
  if (trimmedLeft !== value && hasFormulaTriggerPrefix(trimmedLeft)) {
    return `'${value}`;
  }
  return value;
}

export interface ParsedBirthDate {
  raw: string | null;
  iso: string | null; // YYYY-MM-DD
  formattedPtBr: string | null; // DD/MM/AAAA
  valid: boolean;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1920 || year > 2025) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Analisa datas de nascimento em `DD/MM/AAAA`, `AAAA-MM-DD`, `DD-MM-AAAA` ou número serial do Excel.
 */
export function parseRegistrationBirthDate(rawInput: string | null | undefined): ParsedBirthDate {
  const raw = (rawInput ?? "").trim();
  if (!raw) {
    return { raw: null, iso: null, formattedPtBr: null, valid: false };
  }

  // 1. Formato DD/MM/YYYY ou DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(raw);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (isValidCalendarDate(year, month, day)) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return {
        raw,
        iso: `${year}-${mm}-${dd}`,
        formattedPtBr: `${dd}/${mm}/${year}`,
        valid: true,
      };
    }
    return { raw, iso: null, formattedPtBr: null, valid: false };
  }

  // 2. Formato ISO YYYY-MM-DD ou YYYY/MM/DD (com hora opcional)
  const ymdMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s].*)?$/.exec(raw);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (isValidCalendarDate(year, month, day)) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return {
        raw,
        iso: `${year}-${mm}-${dd}`,
        formattedPtBr: `${dd}/${mm}/${year}`,
        valid: true,
      };
    }
    return { raw, iso: null, formattedPtBr: null, valid: false };
  }

  // 3. Serial numérico do Excel (ex: 39814 -> 2009-01-01)
  if (/^\d{4,5}(?:\.0+)?$/.test(raw)) {
    const serial = Math.floor(Number(raw));
    if (serial >= 10000 && serial <= 46000) {
      const utcMs = (serial - 25569) * 86400 * 1000;
      const dt = new Date(utcMs);
      const year = dt.getUTCFullYear();
      const month = dt.getUTCMonth() + 1;
      const day = dt.getUTCDate();
      if (isValidCalendarDate(year, month, day)) {
        const dd = String(day).padStart(2, "0");
        const mm = String(month).padStart(2, "0");
        return {
          raw,
          iso: `${year}-${mm}-${dd}`,
          formattedPtBr: `${dd}/${mm}/${year}`,
          valid: true,
        };
      }
    }
  }

  return { raw, iso: null, formattedPtBr: null, valid: false };
}

export function isValidBrazilianCpfChecksum(digits11: string): boolean {
  if (!/^\d{11}$/.test(digits11)) return false;
  if (/^(\d)\1{10}$/.test(digits11)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(digits11.charAt(i)) * (10 - i);
  }
  let check1 = (sum1 * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== Number(digits11.charAt(9))) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(digits11.charAt(i)) * (11 - i);
  }
  let check2 = (sum2 * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === Number(digits11.charAt(10));
}

export interface CpfInspectionResult {
  raw: string | null;
  digitsOnly: string | null; // NUNCA preenchido com zeros à esquerda inventados
  isValidElevenDigits: boolean;
  warningMessage: string | null;
}

/**
 * Inspeciona o campo CPF preservando estritamente os caracteres originais.
 * Jamais inventa zeros à esquerda para tentar recuperar CPFs truncados por Excel externo.
 */
export function inspectCpfField(rawInput: string | null | undefined): CpfInspectionResult {
  const raw = (rawInput ?? "").trim();
  if (!raw) {
    return {
      raw: null,
      digitsOnly: null,
      isValidElevenDigits: false,
      warningMessage: "CPF ausente na planilha.",
    };
  }
  const digitsOnly = raw.replace(/\D+/g, "");
  if (digitsOnly.length !== 11) {
    return {
      raw,
      digitsOnly: digitsOnly || null,
      isValidElevenDigits: false,
      warningMessage: `CPF "${raw}" possui ${digitsOnly.length} dígito(s) (esperado: 11). Zeros à esquerda não são preenchidos automaticamente; verifique o documento original.`,
    };
  }
  if (!isValidBrazilianCpfChecksum(digitsOnly)) {
    return {
      raw,
      digitsOnly,
      isValidElevenDigits: false,
      warningMessage: `CPF "${raw}" possui dígitos verificadores inválidos.`,
    };
  }
  return {
    raw,
    digitsOnly,
    isValidElevenDigits: true,
    warningMessage: null,
  };
}

export interface RgOrPassportInspectionResult {
  raw: string | null;
  warningMessage: string | null;
}

export function inspectRgOrPassportField(
  rawInput: string | null | undefined
): RgOrPassportInspectionResult {
  const raw = (rawInput ?? "").trim();
  if (!raw) {
    return {
      raw: null,
      warningMessage: "Documento com foto (RG/CIN/Passaporte) ausente.",
    };
  }
  const alnum = raw.replace(/[^0-9A-Za-z]/g, "");
  if (alnum.length < 4) {
    return {
      raw,
      warningMessage: `Documento com foto "${raw}" parece incompleto ou truncado.`,
    };
  }
  return { raw, warningMessage: null };
}

/**
 * Gera chave determinística de deduplicação para um registro de inscrição,
 * sem mesclar automaticamente pessoas diferentes por similaridade vaga.
 */
export function computeRegistrationDedupKey(params: {
  cpfDigitsOnly: string | null;
  isValidElevenDigitsCpf: boolean;
  rgOrPassportRaw: string | null;
  email: string | null;
  birthDateIso: string | null;
  birthDateRaw: string | null;
  fullNameNormalized: string;
  roleCategory: string;
}): string {
  if (params.isValidElevenDigitsCpf && params.cpfDigitsOnly) {
    return `cpf:${params.cpfDigitsOnly}`;
  }
  const nameKey = params.fullNameNormalized.toLocaleLowerCase("pt-BR").trim();
  const birthKey = (params.birthDateIso ?? params.birthDateRaw ?? "").trim().toLowerCase();
  const rgKey = (params.rgOrPassportRaw ?? "").replace(/\s+/g, "").toLowerCase();
  if (rgKey && rgKey.length >= 4 && birthKey && nameKey) {
    return `rg:${rgKey}|dob:${birthKey}|name:${nameKey}`;
  }
  const emailKey = (params.email ?? "").trim().toLowerCase();
  const composite = `${params.roleCategory}|${nameKey}|${birthKey}|${emailKey}|${rgKey}`;
  const hash = createHash("sha256").update(composite, "utf8").digest("hex").slice(0, 24);
  return `composite:${hash}`;
}

/**
 * Compara duas linhas com a mesma chave de deduplicação para verificar se há divergência
 * substancial nos dados (o que gera erro bloqueante na pré-visualização).
 */
export function findConflictingColumnsBetweenRows(
  a: RegistrationRawColumns,
  b: RegistrationRawColumns
): string[] {
  const criticalKeys: (keyof RegistrationRawColumns)[] = [
    "firstName",
    "lastName",
    "birthDate",
    "sex",
    "roleCategory",
    "status",
    "stakeName",
    "wardName",
    "documentRgOrPassport",
    "cpf",
    "guardianName",
    "guardianPhone",
    "medicalInfo",
    "dietaryInfo",
    "healthConditionsSummary",
    "healthConditionsDetails",
  ];

  const conflicts: string[] = [];
  for (const key of criticalKeys) {
    const valA = (a[key] ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    const valB = (b[key] ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    if (valA !== valB) {
      conflicts.push(key);
    }
  }
  return conflicts;
}

/**
 * Determina se um texto de saúde/alimentação contém relato positivo real
 * (ignorando vazios e negativas como "Não", "Nenhuma", "Nada", "Sem restrições").
 */
export function isPositiveHealthText(rawInput: string | null | undefined): boolean {
  if (!rawInput) return false;
  const normalized = rawInput
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[.!;,:]+$/g, "");
  if (!normalized) return false;

  const negativeExact = new Set([
    "não",
    "nao",
    "nenhum",
    "nenhuma",
    "nada",
    "não possui",
    "nao possui",
    "não tenho",
    "nao tenho",
    "não tem",
    "nao tem",
    "sem restrição",
    "sem restricao",
    "sem restrições",
    "sem restricoes",
    "sem alergia",
    "sem alergias",
    "nenhuma condição",
    "nenhuma condicao",
    "nenhuma restrição",
    "nenhuma restricao",
    "-",
    "n/a",
    "na",
    "ok",
  ]);
  return !negativeExact.has(normalized);
}
