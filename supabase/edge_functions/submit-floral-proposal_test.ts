import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const sourceUrl = new URL("./submit-floral-proposal.ts", import.meta.url);

Deno.test("project revision rechecks CRM authorization immediately before its sole finalization RPC", async () => {
  const source = await Deno.readTextFile(sourceUrl);
  const finalizationRpc = source.indexOf('supabase.rpc("finalize_project_proposal_revision"');
  const branchStart = source.lastIndexOf('if (mode === "project_revision")', finalizationRpc);
  const authorizationRecheck = source.indexOf("await assertInternalCrmUser(req);", branchStart);
  const nextRpc = source.indexOf('supabase.rpc("finalize_project_proposal_revision"', finalizationRpc + 1);

  assert(branchStart >= 0, "project revision branch is required");
  assert(authorizationRecheck > branchStart, "authorization must be rechecked inside the revision branch");
  assert(finalizationRpc > authorizationRecheck, "authorization must be rechecked before finalization");
  assertEquals(nextRpc, -1, "the edge function must invoke the atomic finalization RPC once");

  const between = source.slice(authorizationRecheck, finalizationRpc);
  assert(!between.includes(".from("), "no data access may separate the immediate recheck from the RPC");
});

Deno.test("submit function remains standalone", async () => {
  const source = await Deno.readTextFile(sourceUrl);
  assert(!source.includes("../_shared/"));
  assert(!/from\s+["']\.\/[^"']+["']/.test(source));
});
