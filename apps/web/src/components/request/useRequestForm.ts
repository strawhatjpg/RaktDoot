"use client";
// Form state for a new request + mapping of M1's ExtractedRequest into the form.
import { useEffect, useMemo, useState } from "react";
import type { BloodGroup, ExtractedRequest, HospitalDTO, LanguageCode } from "@raktdoot/shared";
import { api } from "../../lib/api.ts";
import { REQUESTABLE_COMPONENTS, type RequestableComponent } from "./Pickers.tsx";

export function useRequestForm() {
  const [hospitals, setHospitals] = useState<HospitalDTO[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [component, setComponent] = useState<RequestableComponent | null>(null);
  const [units, setUnits] = useState(1);
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    api.hospitals().then((h) => { setHospitals(h); if (h.length === 1) setHospitalId(h[0]!.id); }).catch(() => setHospitals([]));
  }, []);

  function applyExtraction(x: ExtractedRequest & { usedAi: boolean }) {
    setLanguage(x.language);
    if (x.bloodGroup.value) setBloodGroup(x.bloodGroup.value);
    if (x.component.value && (REQUESTABLE_COMPONENTS as readonly string[]).includes(x.component.value)) setComponent(x.component.value as RequestableComponent);
    if (x.units.value) setUnits(Math.min(100, Math.max(1, Math.round(x.units.value))));
    if (x.neededBy.value && new Date(x.neededBy.value).getTime() > Date.now()) setNeededBy(new Date(x.neededBy.value).toISOString());
    if (x.hospitalName.value) {
      const q = x.hospitalName.value.toLowerCase();
      const hit = hospitals.find((h) => { const n = h.name.toLowerCase().replace("fictional ", ""); return n.includes(q) || q.includes(n); });
      if (hit) setHospitalId(hit.id);
    }
    setAiNote(`${x.usedAi ? "AI" : "Smart rules"} understood your message${x.missingFields.length ? `. Still needed: ${x.missingFields.join(", ")}` : ""}.`);
  }

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!hospitalId) m.push("hospital");
    if (!bloodGroup) m.push("blood group");
    if (!component) m.push("component");
    if (!neededBy) m.push("needed by");
    return m;
  }, [hospitalId, bloodGroup, component, neededBy]);

  return {
    hospitals, hospital: hospitals.find((h) => h.id === hospitalId),
    hospitalId, setHospitalId, bloodGroup, setBloodGroup, component, setComponent,
    units, setUnits, neededBy, setNeededBy, language, aiNote, applyExtraction, missing,
  };
}
