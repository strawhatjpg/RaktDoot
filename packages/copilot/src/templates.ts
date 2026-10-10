/**
 * Reviewed English message templates for Copilot drafts.
 *
 * Safety-critical text never comes from live LLM generation (.clinerules/04):
 * the model only chooses the draft type and audience; wording comes from here.
 * Rules baked in: licensed blood centre only, "may be eligible" (never "are"),
 * centre screening decides, opt-out on every message.
 * Member 1 can move these into packages/shared/i18n with hi / hi-Latn / mr translations.
 */
import type { BloodComponent, BloodGroup } from "@raktdoot/shared";

const COMPONENT_LABEL: Record<BloodComponent, string> = {
  WHOLE_BLOOD: "whole blood",
  PACKED_RED_CELLS: "red cells",
  PLATELETS: "platelets",
  PLASMA: "plasma",
  UNKNOWN: "blood",
};

export function componentLabel(component: BloodComponent): string {
  return COMPONENT_LABEL[component];
}

export interface OutreachTemplateInput {
  requestId: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  hospitalName: string;
}

export function donorOutreachMessage(input: OutreachTemplateInput): string {
  const units = input.units === 1 ? "1 unit" : `${input.units} units`;
  return [
    `RaktDoot: ${input.bloodGroup} ${componentLabel(input.component)} needed (${units}) for a verified request at ${input.hospitalName}.`,
    `If you may be eligible and are available, please reply Accept with your arrival time.`,
    `Donation happens only at a licensed blood centre; their screening decides if you can donate.`,
    `Request ID: ${input.requestId}. Reply PAUSE to stop alerts.`,
  ].join(" ");
}

export interface CampaignTemplateInput {
  district: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  weekStart: string; // YYYY-MM-DD
}

export function donationCampaignMessage(input: CampaignTemplateInput): string {
  return [
    `RaktDoot: blood centres in ${input.district} expect higher need for ${input.bloodGroup} ${componentLabel(input.component)} from the week of ${input.weekStart}.`,
    `If you may be eligible to donate, please consider booking a visit at a licensed blood centre near you.`,
    `The centre's screening decides if you can donate. Reply STOP to stop reminders.`,
  ].join(" ");
}
