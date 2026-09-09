import { z } from "zod";
import { readInclusion, mutateInclusion } from "@/lib/inclusion/server";
import { updateInclusionSchema } from "@/types/inclusion";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return readInclusion(params.id); }
export async function PATCH(request: Request, { params }: Context) {
  return mutateInclusion(request, updateInclusionSchema, "update", params.id);
}
export async function DELETE(request: Request, { params }: Context) {
  return mutateInclusion(request, z.object({ version: z.number().int().positive() }).strict(), "archive", params.id);
}
