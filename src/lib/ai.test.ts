import { describe, expect, it } from "vitest";
import {
  ManualCopyPasteProvider,
  allowedProposedActionTypes,
  manualCopyPasteProviderConfig,
} from "./ai";

describe("ManualCopyPasteProvider", () => {
  it("creates a conservative manual prompt", () => {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const prompt = provider.createPrompt({
      entryTitle: "Check density",
      entryBody: "Cells looked dense; plan a lower seeding density comparison.",
      allowedActionTypes: allowedProposedActionTypes,
    });

    expect(prompt).toContain("Never mutate inventory");
    expect(prompt).toContain("Return only a JSON array");
    expect(prompt).toContain("Check density");
  });

  it("parses fenced JSON into pending proposed actions", () => {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const actions = provider.parseResponse(`\`\`\`json
[
  {
    "sourceType": "ai",
    "actionType": "create_experiment",
    "reason": "Entry suggests a follow-up comparison.",
    "payload": { "title": "Lower seeding density comparison" }
  }
]
\`\`\``);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionType: "create_experiment",
      status: "pending",
      sourceLabel: "Manual copy-paste AI",
    });
  });
});
