/**
 * Contratos do módulo administrativo isolado de Inscrições FSY 2027 (Excel 3 abas / 34 colunas).
 *
 * REGRAS ARQUITETURAIS OBRIGATÓRIAS:
 * 1. Isolamento estrito: a importação de inscrições NUNCA sincroniza automaticamente com
 *    `profiles`, `medical_records`, `companies`, `auth.users` ou `inclusion_cases`.
 * 2. Fidelidade das 34 colunas (`A1..AH1`): todos os valores brutos da planilha são preservados
 *    sem truncamento e sem preenchimento inventado de zeros à esquerda.
 * 3. Nomes em Title Case pt-BR (`da`, `de`, `do`, `das`, `dos`, `e` em minúsculas no meio)
 *    são calculados ao lado dos nomes originais para revisão na interface e exportação,
 *    preservando grafias em caixa mista intencional (ex: `McDonald`) e algarismos romanos (`II`, `III`).
 * 4. Controle de concorrência e idempotência: o commit exige `expectedRevision` + `idempotencyKey`,
 *    vinculação ao autor do preview (`createdByUserId`), modo (`mode`) e validade temporal (`expiresAt`).
 *    Previews obsoletos, revisão divergente ou reuso de `idempotencyKey` com parâmetros distintos retornam HTTP 409 Conflict.
 * 5. Exclusão segura e escopada de lote: `DELETE /api/admin/registrations/batches/[batchId]` exige um UUID
 *    específico (proibido `batchId="all"`), remove estritamente os registros vinculados àquele `batch_id`
 *    e NUNCA promove lotes históricos antigos para ativo.
 */

export type RegistrationSheetName = "Consultor" | "Participante" | "Todas";

export type RegistrationRoleCategory = "Participante" | "Consultor";

export type RegistrationImportMode = "upsert" | "replace_all";

export type RegistrationIssueSeverity = "error" | "warning";

export type RegistrationIssueCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_ROLE_CATEGORY"
  | "CONFLICTING_DUPLICATE_KEY"
  | "PROBABLE_DUPLICATE_PERSON"
  | "CROSS_SHEET_MISMATCH"
  | "MISSING_GUARDIAN_FOR_MINOR"
  | "TRUNCATED_OR_INVALID_CPF"
  | "SUSPICIOUS_DOCUMENT_NUMBER"
  | "FORMULA_CHARACTER_NEUTRALIZED"
  | "UNPARSABLE_BIRTH_DATE"
  | "MISSING_SHEET"
  | "HEADER_MISMATCH"
  | "EMPTY_WORKBOOK";

/**
 * Chaves canônicas para as 34 colunas exatas (`A1..AH1`) da planilha oficial de inscrições.
 */
export type RegistrationExcelColumnKey =
  | "firstName" // A1: Nome
  | "lastName" // B1: Sobrenome
  | "preferredName" // C1: Nome de preferência
  | "birthDate" // D1: Data de nascimento
  | "sex" // E1: Sexo
  | "phone" // F1: Telefone
  | "email" // G1: E-mail
  | "medicalInfo" // H1: Informações médicas
  | "tshirtSize" // I1: Tamanho da camiseta
  | "dietaryInfo" // J1: Informações sobre alimentação
  | "contact1Name" // K1: Nome do contato 1
  | "contact1Email" // L1: E-mail para contato 1
  | "contact1Phone" // M1: Telefone para contato 1
  | "contact2Name" // N1: Nome do contato 2
  | "contact2Email" // O1: E-mail do contato 2
  | "contact2Phone" // P1: Telefone para contato 2
  | "age" // Q1: Idade
  | "registrationDate" // R1: Data
  | "status" // S1: Situação
  | "roleCategory" // T1: Tipo
  | "stakeName" // U1: Nome da estaca/distrito
  | "wardName" // V1: Nome da ala/ramo
  | "bishopEmail" // W1: E-mail do bispo
  | "bishopName" // X1: Nome do bispo
  | "documentRgOrPassport" // Y1: Número do RG/CIN/Passaporte (Documento com foto)
  | "issuingAgency" // Z1: Órgão emissor
  | "guardianName" // AA1: Nome do Responsável
  | "guardianPhone" // AB1: Telefone do Responsável
  | "parentAuthorizationAck" // AC1: Me comprometo a baixar a AUTORIZAÇÃO DOS PAIS...
  | "cpf" // AD1: CPF
  | "talentShowPresentation" // AE1: O que vou apresentar? Quanto tempo preciso?
  | "isChurchMember" // AF1: É membro da Igreja?
  | "healthConditionsSummary" // AG1: Nas informações de saúde você relatou alguma destas condições?
  | "healthConditionsDetails"; // AH1: Caso tenha selecionado alguma condição de saúde acima, informe melhor neste campo.

export interface RegistrationExcelColumnDescriptor {
  readonly index: number; // 0..33
  readonly columnLetter: string; // A..AH
  readonly key: RegistrationExcelColumnKey;
  readonly headerLabel: string; // Cabeçalho oficial da planilha
  readonly forceTextOnExport: boolean; // Preserva zeros à esquerda no Excel
}

export const REGISTRATION_EXCEL_COLUMNS: readonly RegistrationExcelColumnDescriptor[] = [
  { index: 0, columnLetter: "A", key: "firstName", headerLabel: "Nome", forceTextOnExport: false },
  { index: 1, columnLetter: "B", key: "lastName", headerLabel: "Sobrenome", forceTextOnExport: false },
  { index: 2, columnLetter: "C", key: "preferredName", headerLabel: "Nome de preferência", forceTextOnExport: false },
  { index: 3, columnLetter: "D", key: "birthDate", headerLabel: "Data de nascimento", forceTextOnExport: true },
  { index: 4, columnLetter: "E", key: "sex", headerLabel: "Sexo", forceTextOnExport: false },
  { index: 5, columnLetter: "F", key: "phone", headerLabel: "Telefone", forceTextOnExport: true },
  { index: 6, columnLetter: "G", key: "email", headerLabel: "E-mail", forceTextOnExport: false },
  { index: 7, columnLetter: "H", key: "medicalInfo", headerLabel: "Informações médicas", forceTextOnExport: false },
  { index: 8, columnLetter: "I", key: "tshirtSize", headerLabel: "Tamanho da camiseta", forceTextOnExport: false },
  { index: 9, columnLetter: "J", key: "dietaryInfo", headerLabel: "Informações sobre alimentação", forceTextOnExport: false },
  { index: 10, columnLetter: "K", key: "contact1Name", headerLabel: "Nome do contato 1", forceTextOnExport: false },
  { index: 11, columnLetter: "L", key: "contact1Email", headerLabel: "E-mail para contato 1", forceTextOnExport: false },
  { index: 12, columnLetter: "M", key: "contact1Phone", headerLabel: "Telefone para contato 1", forceTextOnExport: true },
  { index: 13, columnLetter: "N", key: "contact2Name", headerLabel: "Nome do contato 2", forceTextOnExport: false },
  { index: 14, columnLetter: "O", key: "contact2Email", headerLabel: "E-mail do contato 2", forceTextOnExport: false },
  { index: 15, columnLetter: "P", key: "contact2Phone", headerLabel: "Telefone para contato 2", forceTextOnExport: true },
  { index: 16, columnLetter: "Q", key: "age", headerLabel: "Idade", forceTextOnExport: false },
  { index: 17, columnLetter: "R", key: "registrationDate", headerLabel: "Data", forceTextOnExport: true },
  { index: 18, columnLetter: "S", key: "status", headerLabel: "Situação", forceTextOnExport: false },
  { index: 19, columnLetter: "T", key: "roleCategory", headerLabel: "Tipo", forceTextOnExport: false },
  { index: 20, columnLetter: "U", key: "stakeName", headerLabel: "Nome da estaca/distrito", forceTextOnExport: false },
  { index: 21, columnLetter: "V", key: "wardName", headerLabel: "Nome da ala/ramo", forceTextOnExport: false },
  { index: 22, columnLetter: "W", key: "bishopEmail", headerLabel: "E-mail do bispo", forceTextOnExport: false },
  { index: 23, columnLetter: "X", key: "bishopName", headerLabel: "Nome do bispo", forceTextOnExport: false },
  {
    index: 24,
    columnLetter: "Y",
    key: "documentRgOrPassport",
    headerLabel: "Número do RG/CIN/Passaporte (Documento com foto) ",
    forceTextOnExport: true,
  },
  { index: 25, columnLetter: "Z", key: "issuingAgency", headerLabel: "Órgão emissor", forceTextOnExport: false },
  { index: 26, columnLetter: "AA", key: "guardianName", headerLabel: "Nome do Responsável", forceTextOnExport: false },
  {
    index: 27,
    columnLetter: "AB",
    key: "guardianPhone",
    headerLabel: "Telefone do Responsável ",
    forceTextOnExport: true,
  },
  {
    index: 28,
    columnLetter: "AC",
    key: "parentAuthorizationAck",
    headerLabel:
      "Me comprometo a baixar a AUTORIZAÇÃO DOS PAIS, preencher e assinar (com firma reconhecida da assinatura) e enviar para os Coordenadores do FSY para que meu filho(a) possa viajar e participar no FSY.",
    forceTextOnExport: false,
  },
  { index: 29, columnLetter: "AD", key: "cpf", headerLabel: "CPF", forceTextOnExport: true },
  {
    index: 30,
    columnLetter: "AE",
    key: "talentShowPresentation",
    headerLabel: "O que vou apresentar? Quanto tempo preciso?",
    forceTextOnExport: false,
  },
  { index: 31, columnLetter: "AF", key: "isChurchMember", headerLabel: "É membro da Igreja?", forceTextOnExport: false },
  {
    index: 32,
    columnLetter: "AG",
    key: "healthConditionsSummary",
    headerLabel: "Nas informações de saúde você relatou alguma destas condições?",
    forceTextOnExport: false,
  },
  {
    index: 33,
    columnLetter: "AH",
    key: "healthConditionsDetails",
    headerLabel: "Caso tenha selecionado alguma condição de saúde acima, informe melhor neste campo.",
    forceTextOnExport: false,
  },
] as const;

export type RegistrationRawColumns = Record<RegistrationExcelColumnKey, string>;

export interface RegistrationValidationIssue {
  severity: RegistrationIssueSeverity;
  code: RegistrationIssueCode;
  sheetName: RegistrationSheetName | "Workbook";
  rowNumber: number | null;
  columnKey?: RegistrationExcelColumnKey;
  message: string; // Em pt-BR para exibição direta ao administrador
}

export interface RegistrationNormalizedNameFields {
  firstNameRaw: string;
  lastNameRaw: string;
  preferredNameRaw: string | null;
  fullNameRaw: string;
  firstNameNormalized: string;
  lastNameNormalized: string;
  preferredNameNormalized: string | null;
  fullNameNormalized: string;
  guardianNameRaw: string | null;
  guardianNameNormalized: string | null;
  contact1NameNormalized: string | null;
  contact2NameNormalized: string | null;
  bishopNameNormalized: string | null;
  wasNameNormalized: boolean;
}

export interface RegistrationRecord extends RegistrationNormalizedNameFields {
  id: string;
  batchId: string | null;
  dedupKey: string;
  sourceSheets: RegistrationSheetName[];
  sourceRowNumbers: Partial<Record<RegistrationSheetName, number>>;
  roleCategory: RegistrationRoleCategory;
  status: string;
  registrationDateRaw: string | null;
  birthDateRaw: string | null;
  birthDateIso: string | null; // YYYY-MM-DD se válido
  ageAtRegistration: number | null;
  sex: string | null;
  phoneRaw: string | null;
  email: string | null;
  tshirtSize: string | null;
  stakeName: string | null;
  wardName: string | null;
  bishopNameRaw: string | null;
  bishopEmail: string | null;
  documentRgOrPassportRaw: string | null;
  issuingAgencyRaw: string | null;
  cpfRaw: string | null;
  cpfDigitsOnly: string | null; // NUNCA preenchido com zeros inventados; exatamente os dígitos presentes
  guardianPhoneRaw: string | null;
  parentAuthorizationAckRaw: string | null;
  contact1NameRaw: string | null;
  contact1Email: string | null;
  contact1PhoneRaw: string | null;
  contact2NameRaw: string | null;
  contact2Email: string | null;
  contact2PhoneRaw: string | null;
  isChurchMemberRaw: string | null;
  talentShowPresentationRaw: string | null;
  medicalInfoRaw: string | null;
  dietaryInfoRaw: string | null;
  healthConditionsSummaryRaw: string | null;
  healthConditionsDetailsRaw: string | null;
  hasHealthAlert: boolean;
  hasMissingGuardianForMinor: boolean;
  hasDocumentWarning: boolean;
  issues: RegistrationValidationIssue[];
  rawColumns: RegistrationRawColumns;
  createdAt: string;
  updatedAt: string;
}

/**
 * Projeção enxuta de listagem (`B1`), utilizada quando `?projection=minimal` é solicitado
 * (ex: tabelas/listas rápidas no app nativo), mantendo o detalhe completo em `GET /api/admin/registrations/[id]`.
 */
export type RegistrationListItem = RegistrationRecord;

export interface RegistrationNameChangePreviewItem {
  id: string;
  dedupKey: string;
  fullNameRaw: string;
  fullNameNormalized: string;
  guardianNameRaw: string | null;
  guardianNameNormalized: string | null;
}

export interface RegistrationSheetSummary {
  sheetName: RegistrationSheetName;
  present: boolean;
  totalRows: number;
  headerMatched: boolean;
}

export interface RegistrationPreviewDiffSummary {
  insertCount: number;
  updateCount: number;
  unchangedCount: number;
  deleteCountOnReplaceAll: number;
}

export interface RegistrationImportBatchSummary {
  id: string;
  revision: number;
  filename: string;
  fileSha256: string;
  fileSizeBytes: number;
  importMode: RegistrationImportMode;
  useNormalizedNames: boolean;
  totalCount: number;
  participantCount: number;
  counselorCount: number;
  warningCount: number;
  importedByUserId: string | null;
  importedByName: string | null;
  createdAt: string;
  isActiveBatch: boolean;
}

export interface RegistrationPreviewSummary {
  previewId: string;
  createdByUserId: string;
  baseRevision: number;
  filename: string;
  fileSha256: string;
  fileSizeBytes: number;
  canCommit: boolean;
  blockingErrorCount: number;
  warningCount: number;
  totalCanonicalRows: number;
  participantCount: number;
  counselorCount: number;
  normalizedNamesChangedCount: number;
  healthAlertCount: number;
  missingGuardianMinorCount: number;
  documentWarningCount: number;
  diffSummary: RegistrationPreviewDiffSummary;
  sheets: RegistrationSheetSummary[];
  issues: RegistrationValidationIssue[];
  sampleRows: RegistrationRecord[];
  nameChanges?: RegistrationNameChangePreviewItem[];
  expiresAt: string;
}

export interface RegistrationListFilterParams {
  batchId?: string;
  roleCategory?: RegistrationRoleCategory | "all";
  status?: string;
  stakeName?: string;
  wardName?: string;
  hasHealthAlert?: boolean;
  hasIssues?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  projection?: "default" | "minimal" | "full";
}

export interface RegistrationListMetrics {
  totalCount: number;
  participantCount: number;
  counselorCount: number;
  confirmedCount: number;
  healthAlertCount: number;
  missingGuardianMinorCount: number;
  documentWarningCount: number;
  stakes: string[];
  wards: string[];
  statuses: string[];
}

export interface RegistrationListResponse {
  currentRevision: number;
  activeBatch: RegistrationImportBatchSummary | null;
  batches: RegistrationImportBatchSummary[];
  metrics: RegistrationListMetrics;
  items: RegistrationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalFiltered: number;
    totalPages: number;
  };
}

export interface CommitRegistrationImportRequest {
  previewId: string;
  mode: RegistrationImportMode;
  expectedRevision: number;
  idempotencyKey: string;
  useNormalizedNames?: boolean;
}

export interface CommitRegistrationImportResponse {
  ok: true;
  idempotentReplay: boolean;
  currentRevision: number;
  batch: RegistrationImportBatchSummary;
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
}

export interface DeleteRegistrationBatchResponse {
  ok: true;
  deletedBatchId: string;
  deletedRecordsCount: number;
  currentRevision: number;
  activeBatch: RegistrationImportBatchSummary | null;
}

export interface ExportRegistrationsXlsxQuery {
  batchId?: string;
  roleCategory?: RegistrationRoleCategory | "all";
  status?: string;
  stakeName?: string;
  wardName?: string;
  hasHealthAlert?: boolean;
  hasIssues?: boolean;
  useNormalizedNames?: boolean;
  search?: string;
}
