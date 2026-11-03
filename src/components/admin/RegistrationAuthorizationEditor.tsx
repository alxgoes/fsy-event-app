"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Save, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { AuthorizationAdjustmentsSchema, type AuthorizationAdjustmentValues, type RegistrationRecord } from "@/types/registrations";
import { patchRegistration, previewAuthorizationPdf, RegistrationsApiError } from "./RegistrationsApi";
import { btn, formatDateTime, isCancelledRegistration, Notice } from "./RegistrationsUi";

type FieldKey = keyof AuthorizationAdjustmentValues;
const FIELDS: { key: FieldKey; label: string; group: string; multiline?: boolean; placeholder?: string; type?: "tel" | "email" }[] = [
  { key: "firstName", label: "Nome", group: "Identificação" },
  { key: "lastName", label: "Sobrenome", group: "Identificação" },
  { key: "birthDate", label: "Data de nascimento", group: "Identificação", placeholder: "dd/mm/aaaa" },
  { key: "sex", label: "Sexo", group: "Identificação" },
  { key: "phone", label: "Telefone com DDD", group: "Identificação", type: "tel" },
  { key: "cpf", label: "CPF", group: "Identificação", placeholder: "000.000.000-00" },
  { key: "documentRgOrPassport", label: "RG, CIN ou passaporte", group: "Identificação" },
  { key: "issuingAgency", label: "Órgão emissor", group: "Identificação" },
  { key: "tshirtSize", label: "Tamanho da camiseta", group: "Identificação" },
  { key: "guardianName", label: "Nome do responsável legal", group: "Responsável e unidade" },
  { key: "guardianPhone", label: "Telefone do responsável com DDD", group: "Responsável e unidade", type: "tel" },
  { key: "stakeName", label: "Estaca ou distrito", group: "Responsável e unidade" },
  { key: "wardName", label: "Ala ou ramo", group: "Responsável e unidade" },
  { key: "bishopName", label: "Nome do bispo", group: "Responsável e unidade" },
  { key: "bishopEmail", label: "E-mail do bispo", group: "Responsável e unidade", type: "email" },
  { key: "medicalInfo", label: "Informações médicas", group: "Saúde e alimentação", multiline: true },
  { key: "dietaryInfo", label: "Alimentação", group: "Saúde e alimentação", multiline: true },
  { key: "healthConditionsSummary", label: "Condições de saúde selecionadas", group: "Saúde e alimentação", multiline: true },
  { key: "healthConditionsDetails", label: "Detalhes das condições de saúde", group: "Saúde e alimentação", multiline: true },
];
const GROUPS = [...new Set(FIELDS.map((field) => field.group))];

function initialValues(record: RegistrationRecord): AuthorizationAdjustmentValues {
  const importedSex = (record.sex ?? "").trim().toLocaleLowerCase("pt-BR").replace(/^sexo\s+/, "");
  return {
    firstName: record.firstNameRaw, lastName: record.lastNameRaw, birthDate: record.birthDateIso ? record.birthDateIso.split("-").reverse().join("/") : record.birthDateRaw ?? "",
    sex: ["m", "masc", "masculino"].includes(importedSex) ? "Masculino" : ["f", "fem", "feminino"].includes(importedSex) ? "Feminino" : "",
    phone: record.phoneRaw ?? "", cpf: record.cpfRaw ?? "", documentRgOrPassport: record.documentRgOrPassportRaw ?? "", issuingAgency: record.issuingAgencyRaw ?? "",
    tshirtSize: record.tshirtSize ?? "", guardianName: record.guardianNameRaw ?? "", guardianPhone: record.guardianPhoneRaw ?? "",
    stakeName: record.stakeName ?? "", wardName: record.wardName ?? "", bishopName: record.bishopNameRaw ?? "", bishopEmail: record.bishopEmail ?? "",
    medicalInfo: record.medicalInfoRaw ?? "", dietaryInfo: record.dietaryInfoRaw ?? "", healthConditionsSummary: record.healthConditionsSummaryRaw ?? "", healthConditionsDetails: record.healthConditionsDetailsRaw ?? "",
    ...record.authorizationAdjustments?.values,
  };
}

/** Rascunho e PDF vivem somente em memória e são descartados ao fechar o detalhe. */
export function RegistrationAuthorizationEditor({ record, useNormalizedNames, onSaved, onCancel }: {
  record: RegistrationRecord;
  useNormalizedNames: boolean;
  onSaved: (record: RegistrationRecord) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AuthorizationAdjustmentValues>({});
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWarning, setPreviewWarning] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const values = { ...initialValues(record), ...draft };
  const validation = useMemo(() => AuthorizationAdjustmentsSchema.safeParse(draft), [draft]);
  const fieldErrors = new Map<string, string>();
  if (!validation.success) for (const issue of validation.error.issues) fieldErrors.set(String(issue.path[0]), issue.message);
  const changed = Object.keys(draft).length > 0;
  const cancelled = isCancelledRegistration(record);
  const inputKey = `${record.authorizationAdjustments?.editedAt ?? ""}|${useNormalizedNames}|${JSON.stringify(draft)}`;
  const currentPreviewUrl = previewKey === inputKey ? previewUrl : null;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const clearTimer = window.setTimeout(() => {
      setPreviewLoading(validation.success && !cancelled);
      setPreviewError(null);
      setPreviewUrl(null);
      setPreviewWarning(false);
    }, 0);
    const timer = window.setTimeout(() => {
      if (!validation.success || cancelled) return;
      previewAuthorizationPdf(record.id, validation.data, useNormalizedNames, controller.signal)
        .then(({ blob, headers }) => {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
          setPreviewKey(inputKey);
          setPreviewWarning(headers.get("x-authorization-overflow-warning") === "1");
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setPreviewError(error instanceof RegistrationsApiError ? error.message : "Não foi possível atualizar a pré-visualização.");
        })
        .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    }, 600);
    return () => {
      window.clearTimeout(clearTimer);
      window.clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, inputKey, useNormalizedNames, validation, cancelled]);

  const save = async (reset = false) => {
    if (!reset && (!validation.success || !changed)) return;
    setBusy(reset ? "reset" : "save");
    setFeedback(null);
    try {
      const result = await patchRegistration(record.id, reset ? { resetAdjustments: true } : { adjustments: validation.success ? validation.data : {} });
      if (!mountedRef.current) return;
      setDraft({});
      onSaved(result);
      setFeedback({ tone: "ok", text: reset ? "Ajustes desfeitos. A autorização voltou a usar os dados importados." : "Ajustes salvos. A autorização já usa os dados revisados." });
    } catch (error) {
      if (mountedRef.current) setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível salvar os ajustes." });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  return (
    <section id={`authorization-editor-${record.id}`} aria-label="Editar dados da autorização" className="space-y-4 rounded-2xl border border-[#007DA5]/40 bg-[#FAF8F5] p-4 dark:bg-slate-950">
      <div>
        <h3 className="font-heading text-lg font-bold">Editar dados da autorização</h3>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Os ajustes valem para o PDF. O original da planilha permanece guardado.</p>
        {record.authorizationAdjustments && <p className="mt-2 text-sm">Editado por {record.authorizationAdjustments.editedByName} em {formatDateTime(record.authorizationAdjustments.editedAt)}.</p>}
      </div>
      <form noValidate autoComplete="off" onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-5">
        {GROUPS.map((group) => (
          <fieldset key={group} disabled={busy !== null}>
            <legend className="mb-3 text-sm font-bold">{group}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.filter((field) => field.group === group).map((field) => {
                const id = `authorization-${record.id}-${field.key}`;
                const error = fieldErrors.get(field.key);
                const control = {
                  id, value: values[field.key] ?? "", "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined,
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, [field.key]: value }));
                    setFeedback(null);
                  },
                };
                return (
                  <div key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                    <label htmlFor={id} className="mb-1 block text-sm font-semibold">{field.label}</label>
                    {field.key === "sex" ? <NativeSelect {...control} className="min-h-11"><option value="">Não informado</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></NativeSelect> : field.multiline ? <Textarea {...control} rows={3} maxLength={2000} className="min-h-24" /> : <Input {...control} type={field.type ?? "text"} placeholder={field.placeholder} maxLength={2000} className="min-h-11" />}
                    {error && <p id={`${id}-error`} className="mt-1 text-sm text-[#B91C1C] dark:text-red-300">{error}</p>}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        <section aria-label="Pré-visualização do PDF" aria-busy={previewLoading} className="space-y-3">
          <h4 className="text-sm font-bold">Pré-visualização do PDF</h4>
          {cancelled ? <Notice tone="info">Autorizações não são geradas para inscrições canceladas. Os ajustes podem ser salvos ou desfeitos.</Notice> : !validation.success ? <Notice tone="warn">Confira os campos destacados para atualizar a pré-visualização e salvar.</Notice> : previewError ? <Notice tone="error">{previewError}</Notice> : <>
            {previewLoading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Atualizando pré-visualização…</p>}
            {currentPreviewUrl && <><iframe src={`${currentPreviewUrl}#toolbar=0`} title="Pré-visualização da autorização com os ajustes atuais" className="h-[65vh] min-h-80 w-full rounded-xl border border-slate-300 bg-white" /><a href={currentPreviewUrl} target="_blank" rel="noopener noreferrer" className={btn.secondary}><ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir pré-visualização</a></>}
            {previewWarning && <Notice tone="warn">Alguns campos precisam de mais espaço. Confira o PDF antes de baixar.</Notice>}
          </>}
        </section>
        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="submit" className={btn.primary} disabled={busy !== null || !changed || !validation.success}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Salvar</button>
          {record.authorizationAdjustments && <button type="button" className={btn.secondary} disabled={busy !== null} onClick={() => void save(true)}>{busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />} Desfazer ajustes</button>}
          <button type="button" className={btn.ghost} disabled={busy !== null} onClick={onCancel}>Fechar edição{changed ? " sem salvar" : ""}</button>
        </div>
      </form>
    </section>
  );
}
