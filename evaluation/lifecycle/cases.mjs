// Synthetic evaluation inputs, not customer artifacts or human adjudications.
// Each definition is a distinct product concept; snapshots are constructed here
// to keep repeated SOT scaffolding out of hand-authored case briefs.
const ac = text => [{ text, done: false }];
export const cases = [
  {
    conceptId: "campaign-consent", title: "Campaign consent workspace", role: "Campaign manager",
    problem: "Managers need to preserve the terms that a creator accepted.",
    action: "Issue a consent link", batch: "Issue links to selected creators",
    beforePolicy: "Managers may issue a consent link before negotiation confirmation.",
    afterPolicy: "Managers may issue a consent link only after negotiation confirmation.",
    monitoring: "Track viewed and submitted consent links without changing accepted terms.",
    retiredReason: "The legacy link-status screen is replaced by the consent workspace.",
    mergePolicy: "Batch issuance must record the confirmed terms for each creator.",
    metric: "submitted_links_per_campaign",
    sourceDigest: "sha256:fcbcc9a0c4c8557102c7b40594fa0ccbf2df1a79079bf35ce76cfd4a4efc661a",
    initiativeDigest: "sha256:be83b1a189e3706e4dcc31915c28d09801c4e0b187c4d57a26154211b9b1ddbe",
    definitionDigest: "sha256:8f11a4787c4e757ab5a754da4f9d363d132769727368f153be3777e30d632c51"
  },
  {
    conceptId: "room-booking", title: "Shared room reservations", role: "Office member",
    problem: "Members need predictable cancellation rules for shared rooms.",
    action: "Cancel a reservation", batch: "Cancel selected recurring reservations",
    beforePolicy: "Members may cancel a reservation until its start time.",
    afterPolicy: "Members may cancel a reservation only until thirty minutes before its start time.",
    monitoring: "Track cancelled and active reservations without changing room assignments.",
    retiredReason: "The legacy cancellation list is replaced by the reservation calendar.",
    mergePolicy: "Recurring cancellation must evaluate the cutoff for each occurrence.",
    metric: "cancelled_reservations_per_week",
    sourceDigest: "sha256:d69179991ddeb9170ba17343e3c5bc4b641c4611e4722555b8ada5c33d8f07e0",
    initiativeDigest: "sha256:a438ed71776a61f384818ddbe8bbc02acb01c83cf24d40b7f169097ea969d610",
    definitionDigest: "sha256:332e0da2f1fdcfd199af3881f0aa6d3af41a7a26b2eb47e4f64c87c2efe3323b"
  },
  {
    conceptId: "crm-export", title: "Sales contact exports", role: "Sales representative",
    problem: "Sales teams need to control which customer contacts leave the CRM.",
    action: "Export customer contacts", batch: "Export contacts from selected accounts",
    beforePolicy: "Sales representatives may export all contacts visible to their team.",
    afterPolicy: "Sales representatives may export only contacts with current export consent.",
    monitoring: "Track completed and rejected exports without editing customer records.",
    retiredReason: "The legacy export log screen is replaced by the account activity timeline.",
    mergePolicy: "Account exports must evaluate contact consent individually.",
    metric: "permitted_contact_exports_per_week",
    sourceDigest: "sha256:9f0bce9f073cf0d3d74f90f30117aeaed1e53687e98fd84d1fa892d98c87e252",
    initiativeDigest: "sha256:739b1ec8cd45043564684822f2c4915de7d8d076e0441532e9b55fc31b4ea4f1",
    definitionDigest: "sha256:e4d3d29696760047b06b20fa477956fbd9a50b4e95abe46e4fcefdf16503230a"
  }
];

export function inputsFor(c) {
  const source = {
    schemaVersion: "1.0", title: c.title, lang: "en",
    prd: {
      oneLiner: `${c.title} for ${c.role.toLowerCase()}s`, goal: "Preserve the current policy while improving the workflow.",
      whyNow: "The team is introducing batch actions and needs a shared planning baseline.", category: "Operations", platforms: ["Web"],
      problem: c.problem, solution: `${c.action} through a managed workspace.`, alternatives: "Separate spreadsheets and messages",
      differentiator: "One recorded policy for individual and batch actions.",
      targets: [{ name: c.role, role: c.role, needs: c.action, pain: c.problem }],
      scenarios: [{ text: `${c.role} opens a record, checks eligibility and completes the action.`, start: "P1" }],
      northStar: "Completed eligible actions", kpis: [{ id: "K1", name: "Completed actions", target: "Set after baseline collection", baseline: "Unknown", method: "Weekly operational aggregate", refs: ["F1"], measurement: { mode: "external", source: "Synthetic operational reporting contract", metric: c.metric, refresh: "weekly" } }],
      inScope: [c.action], nonGoals: ["Automatically changing product policies"], assumptions: ["Synthetic case; no live service or deployment is claimed."],
      risks: ["A batch action may retain an older policy."], constraints: [c.beforePolicy], openQuestions: []
    },
    requirements: [
      { id: "R1", title: "Primary workflow", desc: c.problem, status: "todo", priority: "high", acceptance: ac("The recorded eligibility policy is visible before acting."), features: [
        { id: "F1", title: c.action, desc: c.beforePolicy, status: "todo", priority: "high", acceptance: ac("Ineligible actions show a reason without changing the record."), specs: [{ title: "Eligibility", desc: c.beforePolicy, acceptance: ac("The action uses the current eligibility rule.") }] }
      ] },
      { id: "R2", title: "Profile preferences", desc: "Users can inspect their profile preferences independently of the primary policy.", status: "todo", priority: "low", acceptance: ac("Preferences remain available while workflows change."), features: [
        { id: "F2", title: "Read profile", desc: "Display the current user name and locale.", status: "todo", priority: "low", acceptance: ac("Opening the profile does not change primary records."), specs: [] }
      ] }
    ],
    ia: { sections: [{ id: "S1", title: "Workspace", pages: [
      { id: "P1", title: "Records", type: "top", surface: "screen", refs: ["F1"], children: [{ id: "P2", title: "Record details", type: "page", surface: "screen", refs: ["F1:0"], children: [] }] },
      { id: "P3", title: "Profile", type: "top", surface: "screen", refs: ["F2"], children: [] }
    ] }] },
    flow: { start: "P1", transitions: [{ from: "P1", to: "P2", ref: "F1:0" }, { from: "P1", to: "P3", ref: "F2" }] },
    semantic: { contractVersion: "semantic-0.1", events: [], decisions: [] }
  };
  const initiative = {
    schemaVersion: "1.1", title: c.batch, lang: "en",
    initiative: { productId: c.conceptId, id: "batch", path: "1-1", status: "implemented", parent: { scopeId: "root", canonicalization: "sot-c14n-v1", digest: c.sourceDigest } },
    prd: { problem: c.problem, solution: c.batch, goal: "Reduce repetitive action steps.", inScope: [c.batch], nonGoals: ["Changing the original eligibility policy"], constraints: [c.mergePolicy], kpis: [{ id: "K1", name: "Batch completion", target: "Set after baseline collection", baseline: "Unknown", method: "Weekly batch log review", refs: ["F1"], measurement: { mode: "manual", process: "Count completed batches in the synthetic audit log", frequency: "weekly" } }] },
    requirements: [{ id: "R1", title: "Batch workflow", desc: c.batch, status: "done", priority: "high", acceptance: ac("Eligible selected records can be processed together."), features: [
      { id: "F1", title: c.batch, desc: c.beforePolicy, status: "done", priority: "high", acceptance: ac("Each selected record uses the policy declared in this initiative."), specs: [] }
    ] }],
    ia: { sections: [{ id: "S1", title: "Workspace", boundary: { scopeId: "root", sectionId: "S1" }, pages: [
      { id: "P1", title: "Records", type: "top", surface: "screen", refs: [], boundary: { scopeId: "root", pageId: "P1" }, children: [{ id: "P2", title: "Batch action", type: "action", surface: "panel", refs: ["F1"], children: [] }] }
    ] }] },
    flow: { start: "P1", transitions: [{ from: "P1", to: "P2", ref: "F1" }] },
    semantic: { contractVersion: "semantic-0.1", events: [], decisions: [] }
  };
  return { source, initiative };
}
