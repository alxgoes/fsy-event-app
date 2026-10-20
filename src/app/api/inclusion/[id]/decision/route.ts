import { mutateInclusion } from "@/lib/inclusion/server";
import { inclusionDecisionSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  return mutateInclusion(request, inclusionDecisionSchema, "decision", params.id);
}
