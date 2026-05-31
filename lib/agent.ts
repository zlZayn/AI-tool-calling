/**
 * Agent — LLM with tool calling capability.
 *
 * Direct port of lib/agent.py. The OpenAI TypeScript SDK has nearly
 * identical API surface to the Python version.
 */

import OpenAI from "openai";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllTools } from "../tools/index.js";
import type { Tool } from "../tools/lib/types.js";
import { toJsonSchema } from "../tools/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export class Agent {
  private client: OpenAI;
  private model: string;
  public tools: Map<string, Tool>;
  private schemas: OpenAI.ChatCompletionTool[];
  private messages: ChatMessage[] = [];

  private constructor(
    client: OpenAI,
    model: string,
    tools: Map<string, Tool>,
    schemas: OpenAI.ChatCompletionTool[]
  ) {
    this.client = client;
    this.model = model;
    this.tools = tools;
    this.schemas = schemas;
  }

  /** Async factory — reads config, initializes tools, builds schemas. */
  static async create(configPath: string = "../config/config.json"): Promise<Agent> {
    const cfgPath = join(__dirname, configPath);
    let raw: string;
    try {
      raw = await readFile(cfgPath, "utf-8");
    } catch {
      throw new Error(
        `Config not found: ${cfgPath}\n` +
        `Copy the example config and fill in your API key:\n` +
        `  cp config/config_example.json config/config.json`
      );
    }
    const cfg = JSON.parse(raw);

    const client = new OpenAI({
      apiKey: cfg.api_key,
      baseURL: cfg.base_url,
    });
    const model = cfg.model;
    const tools = getAllTools();
    const schemas = Array.from(tools.values()).map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: toJsonSchema(t.parameters),
      },
    }));

    return new Agent(client, model, tools, schemas);
  }

  /** Strip verbose assistant text, keep tool calls and results. */
  private static compact(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
      if (msg.role === "assistant" && msg.tool_calls) {
        return { ...msg, content: "" };
      }
      return msg;
    });
  }

  /**
   * Send a message and return the answer.
   *
   * @param userMessage - The user's question or prompt.
   * @param options.verbose - Print thinking/tool/answer to stdout.
   * @param options.stream - Print chunks in real-time (effective when verbose=true).
   * @param options.forceTool - Force the LLM to use a tool.
   * @returns The final answer string.
   */
  async chat(
    userMessage: string,
    options: {
      verbose?: boolean;
      stream?: boolean;
      forceTool?: boolean;
    } = {}
  ): Promise<string> {
    const { verbose = false, stream = false, forceTool = false } = options;

    this.messages.push({ role: "user", content: userMessage });
    const toolChoice = forceTool ? ("required" as const) : ("auto" as const);
    const live = verbose && stream;

    while (true) {
      const apiStream = await this.client.chat.completions.create({
        model: this.model,
        messages: Agent.compact(this.messages) as OpenAI.ChatCompletionMessageParam[],
        tools: this.schemas.length > 0 ? this.schemas : undefined,
        tool_choice: toolChoice as OpenAI.ChatCompletionToolChoiceOption,
        stream: true,
      });

      let content = "";
      let reasoning = "";
      let contentStarted = false;
      const toolCalls = new Map<number, ToolCallAccumulator>();

      for await (const chunk of apiStream) {
        if (!chunk.choices.length) continue;
        const delta = chunk.choices[0].delta;

        // Reasoning (thinking) — some models support reasoning_content
        const rc = (delta as Record<string, unknown>).reasoning_content as string | undefined;
        if (rc) {
          if (live && !reasoning) process.stdout.write("  [llm-thinking] ");
          reasoning += rc;
          if (live) process.stdout.write(rc);
        }

        // Content
        if (delta.content) {
          content += delta.content;
          if (live && !contentStarted) {
            process.stdout.write("[llm-answer] ");
            contentStarted = true;
          }
          if (live) process.stdout.write(delta.content);
        }

        // Tool calls (accumulate chunks)
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: "", name: "", arguments: "" });
            }
            const acc = toolCalls.get(idx)!;
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function) {
              if (tcDelta.function.name) acc.name = tcDelta.function.name;
              if (tcDelta.function.arguments) acc.arguments += tcDelta.function.arguments;
            }
          }
        }
      }

      // Non-streaming verbose: print accumulated output at once
      if (verbose && !stream) {
        if (reasoning) console.log(`  [llm-thinking] ${reasoning}`);
        if (content) console.log(`[llm-answer] ${content}`);
      }

      // Streaming newline after thinking
      if (live && reasoning) console.log();

      // No tool calls -> done
      if (toolCalls.size === 0) {
        if (live && content) console.log();
        this.messages.push({ role: "assistant", content });
        return content;
      }

      // Execute tool calls
      const tcList = Array.from(toolCalls.entries())
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content,
        tool_calls: tcList.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      this.messages.push(assistantMsg);

      for (const tc of tcList) {
        const fnName = tc.name;
        const fnArgs = tc.arguments;

        if (verbose) console.log(`  [tool-call] ${fnName}(${fnArgs})`);

        const tool = this.tools.get(fnName);
        let result: string;
        if (tool) {
          try {
            const parsed = JSON.parse(fnArgs);
            result = await tool.handler(parsed);
          } catch (e) {
            result = `Error: ${e}`;
          }
        } else {
          result = `Error: unknown tool '${fnName}'`;
        }

        if (verbose) console.log(`  [tool-result] ${result}`);

        this.messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: fnName,
          content: result,
        });
      }
    }
  }
}
