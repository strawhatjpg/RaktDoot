import { discoverCentres, listHospitals } from "../../../server/centres/discovery.ts";
import { apiError, json } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if (params.size === 0) return json({ hospitals: await listHospitals(), message: "Choose a hospital, bloodGroup and component to discover centres. Simulation labels must remain visible." });
    return json(await discoverCentres(params));
  } catch (error) { return apiError(error); }
}