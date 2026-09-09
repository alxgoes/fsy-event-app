import { mutateInclusion } from "@/lib/inclusion/server";
import { inclusionInterviewSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return mutateInclusion(request, inclusionInterviewSchema, "interview_create", params.id);
}
