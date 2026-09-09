"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Calendar, FileText, Loader2, Plus, RefreshCw, Save, Search } from "lucide-react";
import {
  INCLUSION_DECISION_LABELS, INCLUSION_DECISIONS, INCLUSION_PHASE_LABELS, INCLUSION_PHASES,
  createInclusionSchema, inclusionDecisionSchema, inclusionInterviewSchema,
  type CreateInclusionInput, type InclusionCase, type InclusionCaseDetail,
  type InclusionContacts, type InclusionDecisionInput, type InclusionInterview,
  type InclusionInterviewInput, type InclusionResponse, type UpdateInclusionInput,
} from "@/types/inclusion";
import type { YouthMedicalProfile } from "./MedicalDashboard";
import styles from "./InclusionManager.module.css";

interface Props {
  records: YouthMedicalProfile[];
  recordsLoading: boolean;
  requestedRecord: { id: string; request: number } | null;
  onOpenMedicalRecord: (id: string) => void;
  onMedicalRecordsChanged: () => Promise<void>;
}

const emptyContact = () => ({ name: "", phone: "", relationship: "", ward: "" });
const emptyContacts = (): InclusionContacts => ({ parent: emptyContact(), bishop: emptyContact() });
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const localInputDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const interviewLabels = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" };
const historyLabels: Record<string, string> = {
  create: "Acompanhamento iniciado", update: "Acompanhamento atualizado",
  interview_create: "Entrevista registrada", interview_update: "Entrevista atualizada",
  decision: "Decisão registrada", archive: "Acompanhamento arquivado",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/inclusion${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body: InclusionResponse<T> = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (body.code === "DUPLICATE_CASE") throw new Error("Esta ficha já tem um acompanhamento. Volte à lista para abri-lo.");
    if (body.code === "INCLUSION_NOT_CONFIGURED") throw new Error("O módulo de inclusão ainda não está disponível. Peça à administração para concluir a configuração.");
    if (response.status === 409) throw new Error("Este acompanhamento foi atualizado por outra pessoa. Seus campos foram mantidos. Confira suas anotações e use Recarregar antes de salvar novamente.");
    if (response.status === 401 || response.status === 403) throw new Error("Sua sessão não permite acessar este acompanhamento. Entre novamente ou procure a coordenação.");
    if (response.status >= 500) throw new Error("O acompanhamento de inclusão está indisponível. Tente novamente; se o problema continuar, avise a administração.");
    throw new Error(body.error || "Não foi possível concluir a operação. Confira os campos e tente novamente.");
  }
  if (!body.data) throw new Error("Não foi possível confirmar os dados. Recarregue o acompanhamento.");
  return body.data;
}

function ContactFields({ contacts }: { contacts: InclusionContacts }) {
  return <div className={styles.twoColumns}>
    <fieldset className={styles.fields}>
      <legend>Responsável</legend>
      <label>Nome<input name="parent_name" maxLength={160} defaultValue={contacts.parent.name} autoComplete="off" /></label>
      <label>Telefone<input name="parent_phone" type="tel" maxLength={50} defaultValue={contacts.parent.phone} autoComplete="off" /></label>
      <label>Vínculo com o jovem<input name="parent_relationship" maxLength={100} defaultValue={contacts.parent.relationship} placeholder="Ex.: mãe, pai, responsável legal" /></label>
    </fieldset>
    <fieldset className={styles.fields}>
      <legend>Bispo ou presidente de ramo</legend>
      <label>Nome<input name="bishop_name" maxLength={160} defaultValue={contacts.bishop.name} autoComplete="off" /></label>
      <label>Telefone<input name="bishop_phone" type="tel" maxLength={50} defaultValue={contacts.bishop.phone} autoComplete="off" /></label>
      <label>Ala ou ramo<input name="bishop_ward" maxLength={160} defaultValue={contacts.bishop.ward} /></label>
    </fieldset>
  </div>;
}

const value = (form: FormData, name: string) => String(form.get(name) || "").trim();
function contactsFromForm(form: FormData): InclusionContacts {
  return {
    parent: { name: value(form, "parent_name"), phone: value(form, "parent_phone"), relationship: value(form, "parent_relationship"), ward: "" },
    bishop: { name: value(form, "bishop_name"), phone: value(form, "bishop_phone"), relationship: "Bispo ou presidente de ramo", ward: value(form, "bishop_ward") },
  };
}

export function InclusionManager({ records, recordsLoading, requestedRecord, onOpenMedicalRecord, onMedicalRecordsChanged }: Props) {
  const [cases, setCases] = useState<InclusionCase[]>([]);
  const [detail, setDetail] = useState<InclusionCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [newParticipant, setNewParticipant] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [editor, setEditor] = useState<"case" | "interviews" | "decision" | "history">("case");
  const [interview, setInterview] = useState<InclusionInterview | "new" | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastRequest = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const selectedRecord = records.find(record => record.id === recordId);
  const canLeave = () => !dirty || window.confirm("Há alterações não salvas. Deseja descartá-las?");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setCases(await request<InclusionCase[]>("")); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os acompanhamentos."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const openCase = useCallback(async (id: string) => {
    const sequence = ++requestSequence.current;
    setDetailLoading(true);
    setError("");
    setNotice("");
    setCreating(false);
    setDetail(null);
    setDirty(false);
    setInterview(null);
    setEditor("case");
    try {
      const result = await request<InclusionCaseDetail>(`/${id}`);
      if (sequence === requestSequence.current) setDetail(result);
    } catch (err) {
      if (sequence === requestSequence.current) setError(err instanceof Error ? err.message : "Não foi possível abrir o acompanhamento.");
    } finally { if (sequence === requestSequence.current) setDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (!requestedRecord || loading || lastRequest.current === requestedRecord.request) return;
    lastRequest.current = requestedRecord.request;
    if (dirty && !window.confirm("Há alterações não salvas. Deseja descartá-las para abrir outro acompanhamento?")) return;
    const existing = cases.find(item => item.medical_record_id === requestedRecord.id);
    if (existing) { void openCase(existing.id); }
    else { ++requestSequence.current; setDetailLoading(false); setRecordId(requestedRecord.id); setNewParticipant(false); setCreating(true); setDetail(null); setDirty(false); }
  }, [requestedRecord, loading, cases, openCase, dirty]);

  async function mutate(path: string, payload: CreateInclusionInput | UpdateInclusionInput | InclusionInterviewInput | InclusionDecisionInput, method: "POST" | "PATCH", message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await request<InclusionCase>(path, { method, body: JSON.stringify(payload) });
      setDirty(false);
      setCreating(false);
      setInterview(null);
      setCases(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      setNotice(message);
      const updated = await request<InclusionCaseDetail>(`/${saved.id}`);
      setDetail(updated);
      if (path === "" || (method === "PATCH" && !path.includes("/interviews"))) await onMedicalRecordsChanged();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente."); }
    finally { setBusy(false); }
  }

  const initialContacts: InclusionContacts = selectedRecord ? {
    parent: { name: selectedRecord.emergency_contact_name || "", phone: selectedRecord.emergency_contact_phone || "", relationship: selectedRecord.emergency_contact_relationship || "", ward: "" },
    bishop: { name: selectedRecord.bishop_name || "", phone: selectedRecord.bishop_phone || "", relationship: "Bispo ou presidente de ramo", ward: selectedRecord.bishop_ward || "" },
  } : emptyContacts();
  const filtered = cases.filter(item => (!phaseFilter || item.phase === phaseFilter) && item.full_name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return <section className={styles.root} aria-label="Acompanhamento de inclusão" aria-busy={busy}>
    <div className={styles.toolbar}>
      <div><h2>Inclusão</h2><p>Organize os contatos, as entrevistas e os apoios de cada jovem.</p></div>
      <button className={styles.primary} disabled={busy || loading || Boolean(error && !cases.length)} onClick={() => {
        if (!canLeave()) return;
        ++requestSequence.current; setDetailLoading(false); setCreating(true); setDetail(null); setRecordId(""); setNewParticipant(false); setDirty(false); setNotice("");
      }}><Plus aria-hidden="true" />Novo acompanhamento</button>
    </div>

    {error && <div role="alert" className={styles.error}><p>{error}</p><button disabled={busy} onClick={() => {
      if (!canLeave()) return;
      setDirty(false); if (detail) void openCase(detail.id); else void loadCases();
    }}><RefreshCw aria-hidden="true" />Recarregar</button></div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}

    {creating ? <form className={styles.panel} onChange={() => setDirty(true)} onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const payload = createInclusionSchema.safeParse({ ...(newParticipant ? { new_record: { full_name: value(form, "full_name") } } : { medical_record_id: recordId }), needs: value(form, "needs"), support_plan: value(form, "support_plan"), contacts: contactsFromForm(form) });
      if (!payload.success) { setError(payload.error.issues[0].message); return; }
      void mutate("", payload.data, "POST", "Acompanhamento criado.");
    }}>
      <fieldset disabled={busy} className={styles.fields}>
        <h3>Novo acompanhamento</h3>
        <div className={styles.choices}>
          <label><input type="radio" name="source" checked={!newParticipant} onChange={() => { setNewParticipant(false); setRecordId(""); }} />Usar ficha existente</label>
          <label><input type="radio" name="source" checked={newParticipant} onChange={() => { setNewParticipant(true); setRecordId(""); }} />Cadastrar jovem sem ficha</label>
        </div>
        {newParticipant ? <label>Nome completo do jovem<input name="full_name" required minLength={2} maxLength={160} autoComplete="off" /><span className={styles.help}>Uma ficha médica será criada, sem exigir conta de acesso.</span></label> : <label>Ficha médica<select required value={recordId} disabled={recordsLoading} onChange={event => setRecordId(event.target.value)}><option value="">{recordsLoading ? "Carregando fichas…" : "Selecione o jovem"}</option>{records.filter(record => !cases.some(item => item.medical_record_id === record.id)).map(record => <option key={record.id} value={record.id}>{record.full_name}{record.company_id ? ` · ${record.company_id}` : ""}</option>)}</select></label>}
        <label>Necessidades e dificuldades relatadas<textarea name="needs" required maxLength={6000} rows={4} placeholder="Descreva o que o jovem e seus responsáveis relatam e o apoio que precisam avaliar." /></label>
        <label>Apoios previstos<textarea name="support_plan" maxLength={6000} rows={3} /></label>
        <ContactFields key={newParticipant ? "new" : recordId} contacts={initialContacts} />
        <div className={styles.actions}><button type="button" onClick={() => { if (canLeave()) { setCreating(false); setDirty(false); } }}>Cancelar</button><button className={styles.primary} type="submit">{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{busy ? "Salvando…" : "Criar acompanhamento"}</button></div>
      </fieldset>
    </form> : detailLoading ? <p role="status" className={styles.panel}>Carregando acompanhamento…</p> : detail ? <div className={styles.panel}>
      <div className={styles.toolbar}><div><button disabled={busy} onClick={() => { if (canLeave()) { setDetail(null); setDirty(false); setNotice(""); } }}><ArrowLeft aria-hidden="true" />Todos os acompanhamentos</button><h3 className={styles.participant}>{detail.full_name}</h3><p>{INCLUSION_PHASE_LABELS[detail.phase]}</p></div><button disabled={busy} onClick={() => onOpenMedicalRecord(detail.medical_record_id)}><FileText aria-hidden="true" />Abrir ficha médica</button></div>
      <nav className={styles.sections} aria-label="Seções do acompanhamento">{([{ key: "case", label: "Acompanhamento" }, { key: "interviews", label: "Entrevistas" }, { key: "decision", label: "Decisão da equipe" }, { key: "history", label: "Histórico" }] as const).map(item => <button key={item.key} aria-current={editor === item.key ? "page" : undefined} disabled={busy} onClick={() => { if (canLeave()) { setEditor(item.key); setDirty(false); setInterview(null); } }}>{item.label}</button>)}</nav>

      {editor === "case" && <form key={`${detail.id}-${detail.version}`} onChange={() => setDirty(true)} onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        const phase = value(form, "phase") as UpdateInclusionInput["phase"];
        if (detail.decision && phase !== detail.phase && !window.confirm("Reabrir o acompanhamento removerá a decisão atual. O registro anterior continuará no histórico. Deseja continuar?")) return;
        void mutate(`/${detail.id}`, { version: detail.version, needs: value(form, "needs"), support_plan: value(form, "support_plan"), contacts: contactsFromForm(form), ...(phase !== detail.phase ? { phase } : {}) }, "PATCH", "Acompanhamento atualizado.");
      }}><fieldset disabled={busy || detail.phase === "arquivado"} className={styles.fields}>
        <label>Fase do acompanhamento<select name="phase" defaultValue={detail.phase}>{INCLUSION_PHASES.filter(phase => !["concluido", "arquivado"].includes(phase) || phase === detail.phase).map(phase => <option key={phase} value={phase}>{INCLUSION_PHASE_LABELS[phase]}</option>)}</select></label>
        <label>Necessidades e dificuldades relatadas<textarea name="needs" required maxLength={6000} rows={4} defaultValue={detail.needs} /></label>
        <label>Apoios previstos<textarea name="support_plan" maxLength={6000} rows={3} defaultValue={detail.support_plan} /></label>
        <ContactFields contacts={detail.contacts} />
        <p className={styles.help}>Os contatos do responsável e do bispo são compartilhados com a ficha médica.</p>
        <div className={styles.actions}><span className={styles.help}>{dirty ? "Há alterações não salvas." : `Atualizado em ${dateTime(detail.updated_at)}`}</span><button type="submit" className={styles.primary}>{busy ? "Salvando…" : "Salvar acompanhamento"}</button></div>
      </fieldset></form>}

      {editor === "interviews" && <div className={styles.fields}>
        <div className={styles.toolbar}><h4>Entrevistas e conversas</h4><button className={styles.primary} disabled={busy || detail.phase === "arquivado"} onClick={() => { if (canLeave()) { setInterview("new"); setDirty(false); } }}><Plus aria-hidden="true" />Agendar entrevista</button></div>
        {interview && <form key={typeof interview === "string" ? interview : interview.id} className={styles.interviewForm} onChange={() => setDirty(true)} onSubmit={event => {
          event.preventDefault(); const form = new FormData(event.currentTarget); const scheduled = new Date(value(form, "scheduled_at"));
          if (Number.isNaN(scheduled.getTime())) { setError("Informe a data e o horário da entrevista."); return; }
          const payload = inclusionInterviewSchema.safeParse({ version: detail.version, scheduled_at: scheduled.toISOString(), participants: value(form, "participants"), status: value(form, "status"), summary: value(form, "summary") });
          if (!payload.success) { setError(payload.error.issues[0].message); return; }
          void mutate(`/${detail.id}/interviews${interview === "new" ? "" : `/${interview.id}`}`, payload.data, interview === "new" ? "POST" : "PATCH", "Entrevista salva.");
        }}><fieldset disabled={busy} className={styles.fields}>
          <h4>{interview === "new" ? "Nova entrevista" : "Atualizar entrevista"}</h4>
          <div className={styles.twoColumns}><label>Data e horário<input name="scheduled_at" type="datetime-local" required defaultValue={interview === "new" ? "" : localInputDate(interview.scheduled_at)} /></label><label>Situação<select name="status" defaultValue={interview === "new" ? "agendada" : interview.status}>{Object.entries(interviewLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          <label>Participantes da conversa<input name="participants" required minLength={2} maxLength={500} defaultValue={interview === "new" ? "" : interview.participants} placeholder="Jovem, responsáveis e membros da equipe presentes" /></label>
          <label>Resumo e próximos passos<textarea name="summary" rows={4} maxLength={6000} defaultValue={interview === "new" ? "" : interview.summary} /><span className={styles.help}>Obrigatório para entrevistas realizadas.</span></label>
          <div className={styles.actions}><button type="button" onClick={() => { if (canLeave()) { setInterview(null); setDirty(false); } }}>Cancelar</button><button type="submit" className={styles.primary}>{busy ? "Salvando…" : "Salvar entrevista"}</button></div>
        </fieldset></form>}
        {!detail.interviews.length && !interview && <p className={styles.empty}>Nenhuma entrevista registrada. Agende a primeira conversa com o jovem e seus responsáveis.</p>}
        <ol className={styles.timeline}>{detail.interviews.map(item => <li key={item.id}><div className={styles.toolbar}><h4><Calendar aria-hidden="true" />{dateTime(item.scheduled_at)}</h4><span className={styles.status}>{interviewLabels[item.status]}</span></div><p>{item.participants}</p>{item.summary && <p className={styles.prose}>{item.summary}</p>}<button disabled={busy || detail.phase === "arquivado"} onClick={() => { if (canLeave()) { setInterview(item); setDirty(false); } }}>Editar entrevista</button></li>)}</ol>
      </div>}

      {editor === "decision" && <div className={styles.fields}>
        {detail.decision && <div className={styles.decision}><h4>{INCLUSION_DECISION_LABELS[detail.decision]}</h4><p className={styles.prose}>{detail.decision_reason}</p>{detail.decided_at && <p className={styles.help}>Registrada em {dateTime(detail.decided_at)}. Consulte a autoria no histórico.</p>}</div>}
        <form key={`decision-${detail.version}`} onChange={() => setDirty(true)} onSubmit={event => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          const payload = inclusionDecisionSchema.safeParse({ version: detail.version, decision: value(form, "decision"), reason: value(form, "reason"), support_plan: value(form, "support_plan"), confirmed_by_human: form.get("confirmed_by_human") === "on" });
          if (!payload.success) { setError(payload.error.issues[0].message); return; }
          void mutate(`/${detail.id}/decision`, payload.data, "POST", "Decisão da equipe registrada.");
        }}><fieldset disabled={busy || detail.phase === "arquivado"} className={styles.fields}>
          <h4>{detail.decision ? "Atualizar decisão da equipe" : "Registrar decisão da equipe"}</h4>
          <p>A decisão é da equipe responsável, após avaliar as entrevistas e as condições de apoio ao jovem.</p>
          <label>Decisão<select name="decision" required defaultValue=""><option value="" disabled>Selecione a decisão da equipe</option>{INCLUSION_DECISIONS.map(key => <option key={key} value={key}>{INCLUSION_DECISION_LABELS[key]}</option>)}</select></label>
          <label>Justificativa<textarea name="reason" rows={4} required minLength={10} maxLength={6000} /></label>
          <label>Apoios e condições combinados<textarea name="support_plan" rows={3} maxLength={6000} defaultValue={detail.support_plan} /><span className={styles.help}>Obrigatório quando a participação depende de apoio.</span></label>
          <label className={styles.checkbox}><input name="confirmed_by_human" type="checkbox" required />Confirmo que esta decisão foi tomada pela equipe responsável.</label>
          <div className={styles.actions}><p className={styles.help}>A autoria, a data e a justificativa serão registradas.</p><button type="submit" className={styles.primary}>{busy ? "Registrando…" : "Registrar decisão"}</button></div>
        </fieldset></form>
      </div>}

      {editor === "history" && <div><h4>Histórico do acompanhamento</h4>{!detail.history.length ? <p className={styles.empty}>O histórico aparecerá após o primeiro registro.</p> : <ol className={styles.timeline}>{detail.history.map(item => <li key={item.id}><h4>{historyLabels[item.action] || "Registro atualizado"}</h4><p>{item.actor_name || "Equipe responsável"} · {dateTime(item.created_at)}</p>{typeof item.details.reason === "string" && <p className={styles.prose}>{item.details.reason}</p>}{typeof item.details.decision === "string" && item.details.decision in INCLUSION_DECISION_LABELS && <p>{INCLUSION_DECISION_LABELS[item.details.decision as keyof typeof INCLUSION_DECISION_LABELS]}</p>}</li>)}</ol>}</div>}
    </div> : <div className={styles.panel}>
      <div className={styles.filters}><label><span className={styles.searchLabel}><Search aria-hidden="true" />Buscar jovem</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do jovem" /></label><label>Fase<select value={phaseFilter} onChange={event => setPhaseFilter(event.target.value)}><option value="">Todas as fases</option>{INCLUSION_PHASES.map(phase => <option key={phase} value={phase}>{INCLUSION_PHASE_LABELS[phase]}</option>)}</select></label><button disabled={loading} onClick={() => void loadCases()}><RefreshCw aria-hidden="true" />Atualizar</button></div>
      {loading ? <p role="status" className={styles.empty}>Carregando acompanhamentos…</p> : !filtered.length ? <p className={styles.empty}>{cases.length ? "Nenhum acompanhamento corresponde à busca." : error ? "Os acompanhamentos não puderam ser carregados." : "Nenhum acompanhamento iniciado. Use Novo acompanhamento para selecionar uma ficha ou cadastrar um jovem."}</p> : <ul className={styles.list}>{filtered.map(item => <li key={item.id}><button onClick={() => void openCase(item.id)}><span><strong>{item.full_name}</strong><small>Atualizado em {dateTime(item.updated_at)}</small></span><span className={styles.status}>{INCLUSION_PHASE_LABELS[item.phase]}</span></button></li>)}</ul>}
    </div>}
  </section>;
}
