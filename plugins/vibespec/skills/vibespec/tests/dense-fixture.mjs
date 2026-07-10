export function createDenseSot() {
  const branchRanges = [[2, 9], [10, 17], [18, 25], [26, 33], [34, 41], [42, 45]];
  const features = branchRanges.map((_, index) => ({
    id: `F${index + 1}`,
    title: `Branch ${index + 1}`,
    desc: `Dense flow branch ${index + 1}`,
    status: "todo",
    priority: index < 2 ? "high" : "mid",
    acceptance: [],
    specs: []
  }));
  const pages = Array.from({ length: 45 }, (_, index) => ({
    id: `P${index + 1}`,
    title: index === 0 ? "Dense flow start" : `Screen ${index + 1}`,
    type: index === 0 ? "top" : (index % 4 === 0 ? "action" : "page"),
    refs: index === 0 ? features.map(feature => feature.id) : [],
    children: []
  }));
  const transitions = [];
  for (const [branchIndex, [start, end]] of branchRanges.entries()) {
    transitions.push({ from: "P1", to: `P${start}`, label: `Enter branch ${branchIndex + 1}` });
    for (let page = start; page < end; page++) {
      transitions.push({ from: `P${page}`, to: `P${page + 1}`, label: `Continue ${page}` });
    }
  }
  transitions.push(
    { from: "P9", to: "P10", label: "Cross 1" },
    { from: "P17", to: "P18", label: "Cross 2" },
    { from: "P25", to: "P26", label: "Cross 3" },
    { from: "P33", to: "P34", label: "Cross 4" },
    { from: "P9", to: "P10", label: "Cross 1 alternate" },
    { from: "P9", to: "P2", label: "Retry 1" },
    { from: "P17", to: "P10", label: "Retry 2" },
    { from: "P25", to: "P18", label: "Retry 3" },
    { from: "P45", to: "P1", label: "Return home" }
  );
  return {
    schemaVersion: "1.0",
    title: "Dense Flow Regression",
    lang: "en",
    prd: {
      oneLiner: "A dense graph used to verify VibeSpec flow layout",
      goal: "Keep large user flows readable across supported viewports",
      whyNow: "Dense generated products can expose layout regressions",
      category: "Test fixture",
      platforms: ["Web"],
      problem: "Large flow graphs can collapse or overlap",
      solution: "Exercise the real viewer with a representative dense graph",
      alternatives: "Manual visual inspection",
      differentiator: "Deterministic graph size and topology",
      targets: [{ name: "Planner", role: "Reviewer", needs: "Readable flows", pain: "Overlapping nodes and labels" }],
      scenarios: [{ text: "Review all branches from the start screen", start: "P1" }],
      northStar: "Collision-free dense flow renders",
      kpis: [{ name: "Layout collision count", target: "0", baseline: "Unknown", method: "Browser geometry", refs: features.map(feature => feature.id) }],
      inScope: ["Dense flow rendering"],
      nonGoals: ["Visual design approval"],
      assumptions: ["A Chromium browser is available"],
      risks: ["Edge crossings remain possible"],
      openQuestions: [],
      constraints: ["No npm dependencies"]
    },
    requirements: [{
      id: "R1",
      title: "Render dense flows",
      desc: "Display a representative large flow without layout collapse",
      status: "doing",
      priority: "high",
      acceptance: [],
      features
    }],
    ia: { sections: [{ id: "S1", title: "Dense screens", pages }] },
    flow: { start: "P1", transitions }
  };
}
