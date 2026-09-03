import React from "react";
import { EventLandingPage } from "@/components/landing/EventLandingPage";

export const metadata = {
  title: "FSY 2027 • Sessão Ribeirão Preto 2 — Regozijai-vos em Cristo",
  description:
    "Portal oficial da Sessão Ribeirão Preto 2 do FSY 2027. Programação, companhias, contagem regressiva e informações da conferência.",
};

export default function HomePage() {
  return <EventLandingPage />;
}
