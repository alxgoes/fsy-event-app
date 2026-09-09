import { readInclusion, mutateInclusion } from "@/lib/inclusion/server";
import { createInclusionSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
export async function GET() { return readInclusion(); }
export async function POST(request: Request) {
  return mutateInclusion(request, createInclusionSchema, "create");
}
