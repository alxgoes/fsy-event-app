import { mutateInclusion } from "@/lib/inclusion/server";
import { inclusionDecisionSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return mutateInclusion(request, inclusionDecisionSchema, "decision", params.id);
}
