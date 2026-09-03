import React from "react";
import { ExecutiveDashboard } from "@/components/admin/ExecutiveDashboard";

export const metadata = {
  title: "Visão Geral da Coordenação — FSY 2027",
  description: "Painel de controle executivo para a coordenação e líderes da Sessão Ribeirão Preto 2.",
};

export default function AdminPage() {
  return <ExecutiveDashboard />;
}
