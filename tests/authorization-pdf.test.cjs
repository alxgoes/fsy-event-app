const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { loadRoute } = require("./helpers/route-harness.cjs");

function loadPdfModules() {
  const regTypes = loadRoute("src/types/registrations.ts");
  const authTypes = loadRoute("src/types/authorizations.ts");
  const normalize = loadRoute("src/lib/registrations/normalize.ts");
  const zip = loadRoute("src/lib/registrations/zip-archive.ts");
  const pdf = loadRoute("src/lib/pdf/authorization-pdf.ts");
  return { regTypes, authTypes, normalize, zip, pdf };
}

function buildRecord(normalize, overrides = {}) {
  const rawColumns = {
    firstName: "GABRIELA",
    lastName: "DOS SANTOS",
    preferredName: "GABI",
    birthDate: "20/08/2011",
    sex: "Feminino",
    phone: "16991112233",
    email: "gabi@fsy.test",
    medicalInfo: "Não",
    tshirtSize: "P",
    dietaryInfo: "Nenhuma",
    contact1Name: "TIA JOANA (NÃO É RESPONSÁVEL LEGAL)",
    contact1Email: "joana@fsy.test",
    contact1Phone: "16990001111",
    contact2Name: "TIO MARCOS (NÃO É RESPONSÁVEL LEGAL)",
    contact2Email: "marcos@fsy.test",
    contact2Phone: "16990002222",
    age: "15",
    registrationDate: "05/10/2026",
    status: "Confirmado",
    roleCategory: "Participante",
    stakeName: "Estaca Ribeirão Preto Oeste",
    wardName: "Ala Sumarezinho",
    bishopEmail: "bispo@fsy.test",
    bishopName: "PAULO COSTA",
    documentRgOrPassport: "55.666.777-8",
    issuingAgency: "SSP/SP",
    guardianName: "FERNANDA DOS SANTOS",
    guardianPhone: "16997778899",
    parentAuthorizationAck: "Sim",
    cpf: "023.145.098-35",
    talentShowPresentation: "",
    isChurchMember: "Sim",
    healthConditionsSummary: "Não",
    healthConditionsDetails: "",
    ...overrides,
  };

  return {
    id: overrides._id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    dedupKey: `cpf:${rawColumns.cpf.replace(/\D+/g, "")}`,
    sourceSheets: ["Participante", "Todas"],
    sourceRowNumbers: { Participante: 2, Todas: 2 },
    roleCategory: "Participante",
    status: rawColumns.status,
    registrationDateRaw: rawColumns.registrationDate,
    birthDateRaw: rawColumns.birthDate,
    birthDateIso: "2011-08-20",
    ageAtRegistration: 15,
    sex: rawColumns.sex,
    phoneRaw: rawColumns.phone,
    email: rawColumns.email,
    tshirtSize: rawColumns.tshirtSize,
    stakeName: rawColumns.stakeName,
    wardName: rawColumns.wardName,
    bishopNameRaw: rawColumns.bishopName,
    bishopNameNormalized: normalize.normalizePtBrPersonName(rawColumns.bishopName),
    bishopEmail: rawColumns.bishopEmail,
    documentRgOrPassportRaw: rawColumns.documentRgOrPassport,
    issuingAgencyRaw: rawColumns.issuingAgency,
    cpfRaw: rawColumns.cpf,
    cpfDigitsOnly: rawColumns.cpf.replace(/\D+/g, ""),
    guardianNameRaw: rawColumns.guardianName || null,
    guardianNameNormalized: rawColumns.guardianName
      ? normalize.normalizePtBrPersonName(rawColumns.guardianName)
      : null,
    guardianPhoneRaw: rawColumns.guardianPhone || null,
    parentAuthorizationAckRaw: rawColumns.parentAuthorizationAck,
    contact1NameRaw: rawColumns.contact1Name,
    contact1NameNormalized: normalize.normalizePtBrPersonName(rawColumns.contact1Name),
    contact1Email: rawColumns.contact1Email,
    contact1PhoneRaw: rawColumns.contact1Phone,
    contact2NameRaw: rawColumns.contact2Name,
    contact2NameNormalized: normalize.normalizePtBrPersonName(rawColumns.contact2Name),
    contact2Email: rawColumns.contact2Email,
    contact2PhoneRaw: rawColumns.contact2Phone,
    isChurchMemberRaw: rawColumns.isChurchMember,
    talentShowPresentationRaw: rawColumns.talentShowPresentation,
    medicalInfoRaw: rawColumns.medicalInfo,
    dietaryInfoRaw: rawColumns.dietaryInfo,
    healthConditionsSummaryRaw: rawColumns.healthConditionsSummary,
    healthConditionsDetailsRaw: rawColumns.healthConditionsDetails,
    firstNameRaw: rawColumns.firstName,
    lastNameRaw: rawColumns.lastName,
    preferredNameRaw: rawColumns.preferredName,
    fullNameRaw: `${rawColumns.firstName} ${rawColumns.lastName}`,
    firstNameNormalized: normalize.normalizePtBrPersonName(rawColumns.firstName),
    lastNameNormalized: normalize.normalizePtBrPersonName(rawColumns.lastName),
    preferredNameNormalized: normalize.normalizePtBrPersonName(rawColumns.preferredName),
    fullNameNormalized: normalize.normalizePtBrPersonName(
      `${rawColumns.firstName} ${rawColumns.lastName}`
    ),
    wasNameNormalized: true,
    hasHealthAlert: false,
    hasMissingGuardianForMinor: !rawColumns.guardianName || !rawColumns.guardianPhone,
    hasDocumentWarning: false,
    issues: [],
    rawColumns,
    createdAt: "2026-10-31T12:00:00.000Z",
    updatedAt: "2026-10-31T12:00:00.000Z",
  };
}

test("template FICHA AUTORIZACAO.pdf permanece byte-idêntico em src/assets", () => {
  const templatePath = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "ficha-autorizacao-template.pdf"
  );
  const buf = fs.readFileSync(templatePath);
  assert.equal(buf.length, 276809);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
  assert.equal(
    sha256,
    "ACB87C41AF5F1D84E0908E2741333F2921F1D0A4239CE9E95C03A2500C1137CF"
  );
});

test("PDF gerado mantém estritamente 1 página original, não usa Contatos 1/2 como responsável e não usa CPF como documento com foto", () => {
  const { normalize, pdf } = loadPdfModules();

  const recordWithoutGuardian = buildRecord(normalize, {
    guardianName: "",
    guardianPhone: "",
    cpf: "023.145.098-35",
  });

  const { pdfBuffer, payload } = pdf.renderAuthorizationPdfBuffer(recordWithoutGuardian);
  const latin1 = pdfBuffer.toString("latin1");

  // 1. Sempre 1 página (/Count 1)
  assert.match(latin1, /\/Type\s*\/Pages[\s\S]*?\/Count\s+1\b/);
  assert.doesNotMatch(latin1, /\/Count\s+2\b/);

  // 2. Contato 1 e Contato 2 NUNCA preenchem Responsável 1
  assert.equal(payload.guardian.guardian1FullName, "");
  assert.equal(payload.guardian.guardian1Phone, "");
  assert.equal(latin1.includes("Joana"), false);
  assert.equal(latin1.includes("16990001111"), false);

  // 3. CPF NUNCA é gravado na ficha (Outro Documento com Foto fica em branco)
  assert.equal(latin1.includes("023.145.098-35"), false);
  assert.equal(latin1.includes("02314509835"), false);

  // 4. Dados confirmados do evento e do participante estão presentes
  assert.equal(payload.header.venueName, "Ipê Park Hotel");
  assert.equal(payload.youth.fullName, "Gabriela dos Santos");
  assert.equal(payload.youth.birthDateFormatted, "20/08/2011");
  assert.equal(payload.youth.rgOrPassport, "55.666.777-8");
});

test("checkboxes médicos só marcam seleções positivas estruturadas e nunca inferem de negativas ou texto livre", () => {
  const { normalize, pdf } = loadPdfModules();

  // Caso 1: negativas e narrativa livre sem seleção estruturada em AG1
  const negativeRecord = buildRecord(normalize, {
    healthConditionsSummary: "Não",
    dietaryInfo: "Nenhuma restrição",
    medicalInfo: "Tomou dipirona semana passada por dor de cabeça leve",
  });
  const negPayload = pdf.buildAuthorizationPdfPayload(negativeRecord);
  assert.deepEqual(JSON.parse(JSON.stringify(negPayload.medicalCheckboxes)), {
    specialDiet: false,
    allergies: false,
    regularMedication: false,
    chronicDisease: false,
    otherProblems: false,
    recentSurgeryOrSeriousIllness: false,
    physicalLimitations: false,
  });

  // Caso 2: seleção estruturada positiva em AG1
  const positiveRecord = buildRecord(normalize, {
    healthConditionsSummary: "Alergias, Medicação Regular",
    dietaryInfo: "Dieta Especial",
    healthConditionsDetails: "Intolerância severa a lactose e uso diário de bombinha para asma.",
  });
  const posPayload = pdf.buildAuthorizationPdfPayload(positiveRecord);
  assert.equal(posPayload.medicalCheckboxes.specialDiet, true);
  assert.equal(posPayload.medicalCheckboxes.allergies, true);
  assert.equal(posPayload.medicalCheckboxes.regularMedication, true);
  assert.equal(posPayload.medicalCheckboxes.chronicDisease, false);
  assert.equal(posPayload.hasOverflowWarning, false);
});

test("texto médico muito extenso reduz fonte até 6pt em página única e emite aviso explícito de overflow", () => {
  const { normalize, pdf } = loadPdfModules();
  const longText =
    "Restrição alimentar múltipla com alergia severa a proteína do leite de vaca, amendoim, castanhas, frutos do mar e soja, exigindo preparo separado de todas as refeições no hotel, além de acompanhamento diário de medicação contínua prescrita pelo médico especialista com horários rigorosos às 07h, 13h, 19h e 22h durante todos os dias da sessão FSY Ribeirão Preto 2.";

  const record = buildRecord(normalize, {
    healthConditionsSummary: "Alergias, Dieta Especial, Medicação Regular",
    healthConditionsDetails: longText,
  });

  const { pdfBuffer, payload } = pdf.renderAuthorizationPdfBuffer(record);
  assert.equal(payload.medicalText.appliedFontSizePt, 6);
  assert.equal(payload.medicalText.exceededBoxCapacity, true);
  assert.equal(payload.hasOverflowWarning, true);
  assert.ok(payload.overflowFields.includes("Informações Médicas e Alimentares"));
  assert.match(pdfBuffer.toString("latin1"), /\/Count\s+1\b/);
});

test("lote ZIP aplica limite máximo de 50 PDFs e inclui manifesto-autorizacoes.json com progresso", () => {
  const { normalize, zip, pdf } = loadPdfModules();

  const records = [
    buildRecord(normalize, { _id: "10000000-0000-4000-8000-000000000001", firstName: "ANA" }),
    buildRecord(normalize, { _id: "10000000-0000-4000-8000-000000000002", firstName: "BRUNO" }),
  ];

  const batch = pdf.generateAuthorizationPdfBatchZip({
    records,
    partIndex: 1,
    partSize: 50,
    totalEligibleCount: 120,
  });

  assert.equal(batch.progress.partIndex, 1);
  assert.equal(batch.progress.partSize, 50);
  assert.equal(batch.progress.totalParts, 3);
  assert.equal(batch.progress.totalEligibleCount, 120);
  assert.equal(batch.progress.generatedCount, 2);

  const entries = zip.readZipArchive(batch.zipBuffer);
  assert.equal(entries.size, 3); // 2 PDFs + manifesto-autorizacoes.json
  const manifest = JSON.parse(entries.get("manifesto-autorizacoes.json").toString("utf8"));
  assert.equal(manifest.progress.totalParts, 3);
  assert.equal(manifest.entries.length, 2);

  // Acima de 50 registros deve lançar erro
  const fiftyOne = Array.from({ length: 51 }, (_, idx) =>
    buildRecord(normalize, {
      _id: `10000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
    })
  );
  assert.throws(() => pdf.generateAuthorizationPdfBatchZip({ records: fiftyOne }), /limite máximo de 50/);
});
