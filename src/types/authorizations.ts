/**
 * Contratos de geração de PDF da Ficha de Autorização (`FICHA AUTORIZACAO.pdf` — 595x842 pt, página única).
 *
 * REGRAS DE SEGURANÇA JURÍDICA E ISOLAMENTO:
 * 1. NUNCA inventar dados ausentes ou inferir parentesco (`Pai`, `Mãe`, `Tutor`, `Guardiã(o)`).
 * 2. NUNCA usar `Contato 1` ou `Contato 2` como Responsável Legal; apenas `AA1 (Nome do Responsável)`
 *    e `AB1 (Telefone do Responsável)` preenchem `Responsável 1`.
 * 3. `Responsável 2`, `Identificação do Acompanhante`, `Naturalidade`, `Data de Expedição`,
 *    `Data de Validade`, `Endereço`, `Cidade/UF`, `Tipo Sanguíneo`, `Outro Documento com Foto`
 *    (CPF não é documento com foto), `FOTO`, assinaturas e data de assinatura permanecem EM BRANCO.
 * 4. Checkboxes médicos só são marcados a partir de seleções positivas estruturadas em `AG1`/`J1`,
 *    jamais por inferência de texto livre ou negativas ("Não", "Nenhuma").
 * 5. Página única original: o PDF mantém estritamente a página única do modelo oficial (`FICHA AUTORIZACAO.pdf`),
 *    aplicando ajuste automático de fonte (`9pt` -> `6pt`) e emitindo aviso explícito (`hasOverflowWarning` /
 *    `overflowFields` / `warnings`) caso algum campo exceda a largura máxima do formulário.
 * 6. Lote ZIP limitado a no máximo 50 PDFs por requisição (`MAX_AUTHORIZATION_PDF_BATCH_SIZE = 50`),
 *    com paginação por partes (`partIndex`, `partSize`) para geração controlada e indicador de progresso.
 */

import type { RegistrationRoleCategory } from "./registrations";

export const MAX_AUTHORIZATION_PDF_BATCH_SIZE = 50 as const;

export interface AuthorizationPdfHeaderFields {
  activityName: string; // "FSY Ribeirão Preto 2 — 2027"
  validityPeriod: string; // "06 a 10/02/2027"
  venueName: string; // "Ipê Park Hotel"
  destinationCityUf: string; // "São José do Rio Preto / SP"
}

export interface AuthorizationPdfYouthFields {
  fullName: string; // Nome completo (normalizado ou bruto conforme opção)
  birthDateFormatted: string; // DD/MM/AAAA se válido, ou "" se ausente
  rgOrPassport: string; // Y1 (em branco se ausente)
  issuingAgency: string; // Z1 (em branco se ausente)
  sexCheckbox: "M" | "F" | null; // M = Masculino, F = Feminino, null = ambos em branco
  phone: string; // F1 (em branco se ausente)
  wardName: string; // V1 (em branco se ausente)
  stakeName: string; // U1 (em branco se ausente)
}

export interface AuthorizationPdfGuardianFields {
  guardian1FullName: string; // EXCLUSIVAMENTE de AA1 (Nome do Responsável)
  guardian1Phone: string; // EXCLUSIVAMENTE de AB1 (Telefone do Responsável)
}

export interface AuthorizationPdfMedicalCheckboxes {
  specialDiet: boolean; // Dieta Especial
  allergies: boolean; // Alergias
  regularMedication: boolean; // Medicação Regular
  chronicDisease: boolean; // Doença Crônica
  otherProblems: boolean; // Outros problemas
  recentSurgeryOrSeriousIllness: boolean; // Cirurgia ou doença grave nos últimos 12 meses
  physicalLimitations: boolean; // Problemas físicos / limitações
}

export interface AuthorizationPdfMedicalText {
  line1Text: string;
  line2Text: string;
  appliedFontSizePt: number; // 6..9 pt (auto-fit)
  exceededBoxCapacity: boolean; // true se o texto excedeu a capacidade máxima das 2 linhas em 6pt
}

export interface AuthorizationPdfPayload {
  registrationId: string;
  roleCategory: RegistrationRoleCategory;
  suggestedFilename: string; // Ex: "ficha-autorizacao-joao-silva-santos.pdf"
  header: AuthorizationPdfHeaderFields;
  youth: AuthorizationPdfYouthFields;
  guardian: AuthorizationPdfGuardianFields;
  medicalCheckboxes: AuthorizationPdfMedicalCheckboxes;
  medicalText: AuthorizationPdfMedicalText;
  leftBlankFields: readonly string[];
  hasOverflowWarning: boolean;
  overflowFields: string[];
  warnings: string[];
}

export interface AuthorizationPdfBatchRequest {
  registrationIds?: string[]; // Máx 50 IDs por chamada
  batchId?: string;
  roleCategory?: RegistrationRoleCategory | "all"; // Padrão: "Participante"
  partIndex?: number; // Índice 1-based da parte (padrão: 1)
  partSize?: number; // Quantidade por parte (padrão: 50, máx: 50)
  useNormalizedNames?: boolean;
}

export interface AuthorizationPdfBatchProgressInfo {
  partIndex: number; // 1..totalParts
  partSize: number; // <= 50
  totalParts: number;
  totalEligibleCount: number;
  generatedCount: number;
  overflowWarningCount: number;
}

export interface AuthorizationPdfBatchManifestEntry {
  registrationId: string;
  fullName: string;
  roleCategory: RegistrationRoleCategory;
  pdfFilename: string;
  hasOverflowWarning: boolean;
  overflowFields: string[];
  warnings: string[];
}
