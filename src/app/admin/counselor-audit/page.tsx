import React from "react";
import { CounselorAuditManager } from "@/components/admin/CounselorAuditManager";

export const metadata = {
  title: "Auditoria & Histórico dos Consultores — FSY Admin",
  description:
    "Registro e histórico de alterações feitas pelos consultores da Sessão Ribeirão Preto 2. Acesso exclusivo para Casal Diretor, Casal Logística e Coordenadores.",
};

export default function CounselorAuditPage() {
  return <CounselorAuditManager />;
}
