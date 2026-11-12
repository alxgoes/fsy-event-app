/**
 * Contrato de distribuição e metadados do aplicativo nativo Android (APK assinado) e iOS.
 * Permite que a página `/instalar` e os clientes nativos consultem a disponibilidade real
 * do pacote assinado sem depender de links fictícios ou placeholders.
 */

export type NativePlatformId = "android" | "ios";

export type AppReleaseAvailability =
  | "ready_direct_download" // Arquivo APK assinado hospedado em HTTPS pronto para download
  | "ready_external_store" // Link oficial externo (Play Store / TestFlight / App Store)
  | "local_artifact_built" // APK assinado gerado e verificado na release pipeline, aguardando publicação HTTPS
  | "pwa_fallback"; // Utilize instalação via navegador (PWA) enquanto binário não está publicado

export interface AndroidApkSignatureMetadata {
  readonly applicationId: "br.com.fsyrp2.app";
  readonly versionName: string;
  readonly versionCode: number;
  readonly minSdk: number;
  readonly targetSdk: number;
  readonly compileSdk: number;
  readonly apkFileName: string;
  readonly sizeBytes: number | null;
  readonly sha256: string | null;
  readonly signingSchemes: readonly ("v2" | "v3")[];
  readonly signerCertificateSha256: string | null;
  readonly builtAtIso: string | null;
  readonly minSupportedVersionCode?: number;
  readonly releaseNotesPtBr?: readonly string[];
}

export interface PlatformReleaseStatus {
  readonly platform: NativePlatformId;
  readonly availability: AppReleaseAvailability;
  readonly downloadUrl: string | null; // Somente preenchido quando um binário/store HTTPS real estiver disponível
  readonly installInstructionsPtBr: readonly string[];
  readonly androidMetadata?: AndroidApkSignatureMetadata;
}

export interface AppDistributionManifest {
  readonly eventName: string;
  readonly updatedAtIso: string;
  readonly android: PlatformReleaseStatus;
  readonly ios: PlatformReleaseStatus;
}
