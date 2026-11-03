import type { RegistrationRecord } from "@/types/registrations";
import { normalizePtBrPersonName, parseRegistrationBirthDate } from "./normalize";

/** Projeção usada apenas pelo PDF. rawColumns e a identidade importada permanecem intactos. */
export function applyAuthorizationAdjustments(record: RegistrationRecord): RegistrationRecord {
  const values = record.authorizationAdjustments?.values;
  if (!values) return record;
  const adjusted = { ...record };
  const fields = {
    firstName: "firstNameRaw", lastName: "lastNameRaw", birthDate: "birthDateRaw",
    sex: "sex", phone: "phoneRaw", cpf: "cpfRaw", documentRgOrPassport: "documentRgOrPassportRaw",
    issuingAgency: "issuingAgencyRaw", guardianName: "guardianNameRaw", guardianPhone: "guardianPhoneRaw",
    stakeName: "stakeName", wardName: "wardName", bishopName: "bishopNameRaw", bishopEmail: "bishopEmail",
    tshirtSize: "tshirtSize", medicalInfo: "medicalInfoRaw", dietaryInfo: "dietaryInfoRaw",
    healthConditionsSummary: "healthConditionsSummaryRaw", healthConditionsDetails: "healthConditionsDetailsRaw",
  } as const;
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    if (values[key] !== undefined) Object.assign(adjusted, { [fields[key]]: values[key] });
  }
  adjusted.firstNameNormalized = normalizePtBrPersonName(adjusted.firstNameRaw);
  adjusted.lastNameNormalized = normalizePtBrPersonName(adjusted.lastNameRaw);
  adjusted.fullNameRaw = [adjusted.firstNameRaw, adjusted.lastNameRaw].filter(Boolean).join(" ");
  adjusted.fullNameNormalized = [adjusted.firstNameNormalized, adjusted.lastNameNormalized].filter(Boolean).join(" ");
  adjusted.guardianNameNormalized = normalizePtBrPersonName(adjusted.guardianNameRaw);
  adjusted.bishopNameNormalized = normalizePtBrPersonName(adjusted.bishopNameRaw);
  adjusted.birthDateIso = parseRegistrationBirthDate(adjusted.birthDateRaw).iso;
  adjusted.cpfDigitsOnly = adjusted.cpfRaw?.replace(/\D/g, "") || null;
  return adjusted;
}

export function isCancelledRegistration(record: Pick<RegistrationRecord, "status">): boolean {
  return /^cancelad/i.test(record.status.trim());
}

export function isApprovedRegistration(record: Pick<RegistrationRecord, "status">): boolean {
  return /^(aprovad[oa]|confirmad[oa])$/i.test(record.status.trim());
}
