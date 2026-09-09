import { mutateInclusion } from "@/lib/inclusion/server";
import { inclusionInterviewSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: { id: string; interviewId: string } }) {
  return mutateInclusion(request, inclusionInterviewSchema, "interview_update", params.id, params.interviewId);
}
