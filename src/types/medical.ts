import { z } from "zod";

const optionalText = z.string().trim().max(6000).nullish();
export const medicalRecordSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  user_id: z.string().uuid().nullish(),
  company_id: optionalText, room: optionalText,
  allergies: optionalText, is_severe_allergy: z.boolean().optional(),
  dietary_restrictions: optionalText, medications: optionalText,
  emergency_contact_name: optionalText, emergency_contact_phone: optionalText,
  emergency_contact_rel: optionalText,
  contact_2_name: optionalText, contact_2_phone: optionalText,
  contact_2_rel: optionalText, contact_2_relationship: optionalText,
  contact_3_name: optionalText, contact_3_phone: optionalText,
  contact_3_rel: optionalText, contact_3_relationship: optionalText,
  bishop_name: optionalText, bishop_phone: optionalText, bishop_ward: optionalText,
  blood_type: optionalText, doctor_notes: optionalText,
}).strict();
export const medicalRecordUpdateSchema = medicalRecordSchema.partial().extend({ id: z.string().uuid() }).strict();
