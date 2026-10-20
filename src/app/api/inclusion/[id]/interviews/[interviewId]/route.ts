import { mutateInclusion } from "@/lib/inclusion/server";
import { inclusionInterviewSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params: paramsPromise }: { params: Promise<{ id: string; interviewId: string }> }) {
  const params = await paramsPromise;
  return mutateInclusion(request, inclusionInterviewSchema, "interview_update", params.id, params.interviewId);
}
