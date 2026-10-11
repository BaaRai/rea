import { describe, expect, it } from "vitest";

import { claudeCodeEventsToCodexEvents } from "../../src/evaluation/ClaudeAgentEval.js";
import { createEvidence } from "../../src/domain/evidence.js";
import { evaluateCodexEvents } from "../../src/evaluation/CodexAgentEval.js";

const javascriptEvidence = (operation: string) =>
  createEvidence(
    { path: "/tmp/app", sha256: "1".repeat(64), format: "zip" },
    { id: "javascript", name: "JavaScript analysis", version: null },
    {
      operation,
      parameters: {},
      result: { observed: true },
      evidenceLinks: [],
      authority: "shipped-artifact",
    },
  );

const scenario = (claudeEvents: readonly unknown[]) =>
  evaluateCodexEvents(
    claudeCodeEventsToCodexEvents(claudeEvents),
    "analyze_javascript_application",
    { requireEvidence: true, requiredAnswerTermGroups: [["nested"]] },
  );

describe("Claude Code transcript normalization", () => {
  it("pairs a tool call with its result into one completed rea call", () => {
    const delivered = javascriptEvidence("analyze_javascript_application");
    const metrics = scenario([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_1",
              name: "mcp__rea__analyze_javascript_application",
              input: { input_path: "/app" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: JSON.stringify(delivered),
            },
          ],
        },
      },
      {
        type: "result",
        subtype: "success",
        result: "The nested answer.",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 5,
        },
      },
    ]);

    expect(metrics.correctFirstTool).toBe(true);
    expect(metrics.reaCalls).toHaveLength(1);
    expect(metrics.reaCalls[0]).toMatchObject({
      server: "rea",
      tool: "analyze_javascript_application",
      arguments: { input_path: "/app" },
      evidenceIds: [delivered.evidence_id],
      error: false,
    });
    expect(metrics.finalMessage).toContain("The nested answer.");
    expect(metrics.inputTokens).toBe(100);
    expect(metrics.cachedInputTokens).toBe(5);
    expect(metrics.outputTokens).toBe(20);
    expect(metrics.answerTermCoverageMet).toBe(true);
  });

  it("keeps a failed tool result out of evidence delivery", () => {
    const metrics = scenario([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_2",
              name: "mcp__rea__analyze_javascript_application",
              input: { input_path: "/app" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_2",
              is_error: true,
              content: "invalid input",
            },
          ],
        },
      },
      { type: "result", subtype: "success", result: "Done.", usage: {} },
    ]);

    expect(metrics.reaCalls[0]?.error).toBe(true);
    expect(metrics.reaCalls[0]?.evidenceIds).toEqual([]);
  });

  it("leaves non-MCP and foreign-server tools outside the rea calls", () => {
    const metrics = scenario([
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Read", input: {} },
            {
              type: "tool_use",
              id: "t2",
              name: "mcp__other__search",
              input: {},
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "text" },
            { type: "tool_result", tool_use_id: "t2", content: "text" },
          ],
        },
      },
      { type: "result", subtype: "success", result: "No REA use.", usage: {} },
    ]);

    expect(metrics.reaCalls).toHaveLength(0);
    expect(metrics.correctFirstTool).toBe(false);
  });

  it("drops a tool use whose result never completed", () => {
    const events = claudeCodeEventsToCodexEvents([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_3",
              name: "mcp__rea__open_binary",
              input: {},
            },
          ],
        },
      },
      { type: "result", subtype: "success", result: "Aborted.", usage: {} },
    ]) as readonly { type: string; item?: { type: string } }[];
    expect(
      events.filter(({ item }) => item?.type === "mcp_tool_call"),
    ).toHaveLength(0);
    expect(events.some(({ type }) => type === "turn.completed")).toBe(true);
  });
});
