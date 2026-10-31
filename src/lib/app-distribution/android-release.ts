import fs from "node:fs";
import path from "node:path";
import { EVENT_NAME } from "@/lib/event/identity";
import type {
  AndroidApkSignatureMetadata,
  AppDistributionManifest,
  AppReleaseAvailability,
} from "@/types/app-distribution";

const ANDROID_RELEASE_METADATA_PATH = path.join(
  process.cwd(),
  "android",
  "release-metadata.json"
);

function readLocalAndroidReleaseMetadata(): AndroidApkSignatureMetadata {
  const fallback: AndroidApkSignatureMetadata = {
    applicationId: "br.com.fsyrp2.app",
    versionName: "1.0.0",
    versionCode: 1,
    minSdk: 26,
    targetSdk: 35,
    compileSdk: 35,
    apkFileName: "fsy-rp2-2027-v1.0.0-release.apk",
    sizeBytes: null,
    sha256: null,
    signingSchemes: [],
    signerCertificateSha256: null,
    builtAtIso: null,
  };

  try {
    if (!fs.existsSync(ANDROID_RELEASE_METADATA_PATH)) {
      return fallback;
    }
    const parsed = JSON.parse(
      fs.readFileSync(ANDROID_RELEASE_METADATA_PATH, "utf8")
    ) as Partial<AndroidApkSignatureMetadata>;
    const hasVerifiedArtifact =
      typeof parsed.sha256 === "string" &&
      parsed.sha256.length === 64 &&
      typeof parsed.sizeBytes === "number" &&
      parsed.sizeBytes > 0;
    const schemes =
      hasVerifiedArtifact && Array.isArray(parsed.signingSchemes)
        ? parsed.signingSchemes.filter((s): s is "v2" | "v3" => s === "v2" || s === "v3")
        : [];
    return {
      ...fallback,
      ...parsed,
      applicationId: "br.com.fsyrp2.app",
      signingSchemes: schemes,
    };
  } catch {
    return fallback;
  }
}

function validateHttpsDownloadUrl(rawUrl: string | undefined): {
  url: string;
  hostname: string;
} | null {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return { url: parsed.toString(), hostname: parsed.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

export function getAppDistributionManifest(): AppDistributionManifest {
  const androidMeta = readLocalAndroidReleaseMetadata();
  const androidHttps = validateHttpsDownloadUrl(
    process.env.NEXT_PUBLIC_ANDROID_APK_URL
  );
  const iosHttps = validateHttpsDownloadUrl(process.env.NEXT_PUBLIC_IOS_APP_URL);

  const hasLocalArtifact = Boolean(androidMeta.sha256 && androidMeta.sizeBytes);
  let androidAvailability: AppReleaseAvailability = "pwa_fallback";
  if (androidHttps) {
    androidAvailability =
      androidHttps.hostname === "play.google.com"
        ? "ready_external_store"
        : "ready_direct_download";
  } else if (hasLocalArtifact) {
    androidAvailability = "local_artifact_built";
  }

  const iosAvailability: AppReleaseAvailability = iosHttps
    ? "ready_external_store"
    : "pwa_fallback";

  const androidInstructions = androidHttps
    ? [
        "Toque em Baixar APK para iniciar o download seguro em HTTPS.",
        "Abra o arquivo .apk concluído e autorize a instalação desta fonte se solicitado pelo Android.",
        "Confira que o pacote é br.com.fsyrp2.app da Sessão Ribeirão Preto 2.",
      ]
    : hasLocalArtifact
      ? [
          "O pacote APK nativo (br.com.fsyrp2.app) foi compilado e aguarda publicação do link HTTPS pela coordenação.",
          "Enquanto o link público não estiver configurado, instale pelo navegador Chrome tocando no menu (⋮) -> 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
        ]
      : [
          "O instalador Android (.apk) ainda não foi publicado neste ambiente.",
          "Você pode instalar o aplicativo web pelo Chrome tocando no menu (⋮) -> 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
        ];

  return {
    eventName: EVENT_NAME,
    updatedAtIso: androidMeta.builtAtIso ?? new Date().toISOString(),
    android: {
      platform: "android",
      availability: androidAvailability,
      downloadUrl: androidHttps?.url ?? null,
      installInstructionsPtBr: androidInstructions,
      androidMetadata: androidMeta,
    },
    ios: {
      platform: "ios",
      availability: iosAvailability,
      downloadUrl: iosHttps?.url ?? null,
      installInstructionsPtBr: iosHttps
        ? [
            "Abra o link oficial no TestFlight / App Store para instalar o aplicativo nativo iOS.",
          ]
        : [
            "No iPhone ou iPad, abra este portal no Safari, toque em Compartilhar e selecione 'Adicionar à Tela de Início'.",
          ],
    },
  };
}
