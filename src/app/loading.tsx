import React from "react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function Loading() {
  return (
    <LoadingScreen
      title="Carregando o FSY 2027"
      message="Sincronizando atividades e informações da sessão..."
      submessage="Aguarde um instante enquanto preparamos seu ambiente"
    />
  );
}
