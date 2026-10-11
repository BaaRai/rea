/**
 * Normalize a Claude Code `--output-format stream-json` transcript into the
 * Codex JSONL event shape the shared agent evaluator consumes. One completed
 * MCP call, its result, assistant text, and the final usage record are the
 * only facts the rubric needs; anything the transcript does not establish
 * stays absent rather than approximated.
 */

interface PendingCall {
  readonly id: string;
  readonly server: string | null;
  readonly tool: string;
  readonly arguments: unknown;
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const textValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** Claude names MCP tools `mcp__<server>__<tool>`; anything else is local. */
const mcpToolIdentity = (
  name: string,
): { readonly server: string | null; readonly tool: string } => {
  const match = /^mcp__([^_]+)__(.+)$/u.exec(name);
  return match === null
    ? { server: null, tool: name }
    : { server: match[1] ?? "", tool: match[2] ?? name };
};

/** Tool results carry a string or a content block list; both become blocks. */
const resultContent = (
  value: unknown,
): readonly { readonly type: string; readonly text?: string }[] => {
  const text = textValue(value);
  if (text !== undefined) return [{ type: "text", text }];
  return Array.isArray(value)
    ? value.flatMap((block) => {
        const object = record(block);
        return object === undefined
          ? []
          : [
              {
                type: textValue(object.type) ?? "text",
                ...(object.text === undefined
                  ? {}
                  : { text: textValue(object.text) ?? "" }),
              },
            ];
      })
    : [];
};

/**
 * Translate Claude Code stream events into Codex transcript events: assistant
 * text blocks and the final result become agent messages, a tool call pairs
 * with its tool_result to become one completed `mcp_tool_call` item, and the
 * closing result event contributes the turn usage.
 */
export const claudeCodeEventsToCodexEvents = (
  events: readonly unknown[],
): readonly unknown[] => {
  const pending = new Map<string, PendingCall>();
  const normalized: unknown[] = [];
  for (const value of events) {
    const event = record(value);
    if (event === undefined) continue;
    if (event.type === "assistant" || event.type === "user") {
      const message = record(event.message);
      const content = message === undefined ? undefined : message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        const item = record(block);
        if (item === undefined) continue;
        if (event.type === "assistant") {
          if (item.type === "text" && typeof item.text === "string")
            normalized.push({
              type: "item.completed",
              item: { type: "agent_message", text: item.text },
            });
          if (item.type === "tool_use") {
            const id = textValue(item.id);
            const name = textValue(item.name);
            if (id === undefined || name === undefined) continue;
            // Claude's local tools (Read, Bash, ...) have no MCP server; the
            // shared rubric only measures MCP calls, so they never become
            // call items. Foreign servers stay attributed to their server.
            if (!name.startsWith("mcp__")) continue;
            const identity = mcpToolIdentity(name);
            pending.set(id, {
              id,
              server: identity.server,
              tool: identity.tool,
              arguments: item.input ?? {},
            });
          }
          continue;
        }
        if (item.type !== "tool_result") continue;
        const id = textValue(item.tool_use_id);
        if (id === undefined) continue;
        const call = pending.get(id);
        if (call === undefined) continue;
        pending.delete(id);
        normalized.push({
          type: "item.completed",
          item: {
            type: "mcp_tool_call",
            id: call.id,
            server: call.server,
            tool: call.tool,
            arguments: call.arguments,
            status: "completed",
            result: {
              isError: item.is_error === true,
              content: resultContent(item.content),
            },
          },
        });
      }
      continue;
    }
    if (event.type !== "result") continue;
    const resultText = textValue(event.result);
    if (resultText !== undefined && resultText.length > 0)
      normalized.push({
        type: "item.completed",
        item: { type: "agent_message", text: resultText },
      });
    const usage = record(event.usage);
    normalized.push({
      type: "turn.completed",
      usage: {
        input_tokens: numberValue(usage?.input_tokens),
        cached_input_tokens: numberValue(usage?.cache_read_input_tokens),
        output_tokens: numberValue(usage?.output_tokens),
      },
    });
  }
  return normalized;
};
