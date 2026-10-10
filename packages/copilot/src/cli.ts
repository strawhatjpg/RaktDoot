/**
 * Demo CLI (no Next.js needed). Uses SIMULATED requests/donors + the real forecast service.
 *
 *   npm run demo -w @raktdoot/copilot -- briefing Pune
 *   npm run demo -w @raktdoot/copilot -- ask "Which requests are at risk today?"
 *   npm run demo -w @raktdoot/copilot -- approve-demo
 */
import { ApprovalStore } from "./approval.ts";
import { buildShortageBriefing, formatBriefing } from "./briefing.ts";
import { createCopilot, providersFromEnv } from "./agent.ts";
import { draftOutreach } from "./draft-tool.ts";
import { forecastClientFromEnv } from "./forecast-client.ts";
import { MOCK_DISTRICT, createMockDataSource } from "./mock-data.ts";

const data = createMockDataSource();
const forecast = forecastClientFromEnv();
const approvals = new ApprovalStore({
  data,
  onApproved: (draft) => console.log(`[dispatch stub] would hand draft ${draft.id} to outreach (Member 2)`),
});

const [command = "help", ...rest] = process.argv.slice(2);

try {
  if (command === "briefing") {
    console.log(formatBriefing(await buildShortageBriefing({ data, forecast }, rest[0] ?? MOCK_DISTRICT)));
  } else if (command === "ask") {
    const copilot = createCopilot({ data, forecast, approvals, providers: providersFromEnv() });
    const answer = await copilot.ask(rest.join(" ") || "Which open requests are at risk, and what should I do?");
    console.log(answer.text);
    console.log(`\n[provider ${answer.provider} · tools: ${answer.toolsUsed.join(", ") || "none"} · drafts: ${answer.draftIds.join(", ") || "none"}]`);
    for (const draft of approvals.list("PENDING_APPROVAL")) {
      console.log(`\nDRAFT ${draft.id} (${draft.kind}, needs coordinator approval)\n${draft.message}`);
    }
  } else if (command === "approve-demo") {
    // Shows the human-approval gate without an LLM.
    const blocked = await draftOutreach({ data, approvals }, { kind: "DONOR_OUTREACH", requestId: "REQ-1002", rationale: "demo" });
    console.log("Unverified request ->", blocked);
    const made = await draftOutreach({ data, approvals }, { kind: "DONOR_OUTREACH", requestId: "REQ-1001", rationale: "2 units uncovered" });
    console.log("Verified request ->", made);
    const id = String(made.draftId);
    console.log("Requester tries to approve ->", await approvals.approve(id, "REQUESTER"));
    console.log("Coordinator approves ->", (await approvals.approve(id, "COORDINATOR", "ok")).ok);
  } else {
    console.log("Commands: briefing [district] | ask <question> | approve-demo");
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
