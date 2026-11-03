import { NextResponse } from "next/server";
import { getAppDistributionManifest } from "@/lib/app-distribution/android-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = getAppDistributionManifest();
  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
}
