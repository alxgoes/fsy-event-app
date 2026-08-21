import React from "react";
import { CompanyManager } from "@/components/admin/CompanyManager";

export const metadata = {
  title: "Gestão de Companhias — FSY Admin",
};

export default function AdminCompaniesPage() {
  return <CompanyManager />;
}
