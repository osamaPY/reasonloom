import { createSampleWorkspace } from "@/src/server";

/** Creates the labelled sample workspace (idempotent). Synthetic data only. */
export async function POST() {
	const result = createSampleWorkspace();
	return Response.json(result, { status: result.created ? 201 : 200 });
}
