/**
 * CLI interface for tool calling agent.
 *
 * Usage:
 *   npx tsx index.ts "your question"                  # answer only (default)
 *   npx tsx index.ts --show_process "your question"   # show thinking + tools
 *   npx tsx index.ts --stream "your question"         # real-time streaming
 *   npx tsx index.ts --force_tool "your question"     # force tool usage
 *   npx tsx index.ts --list_tools                     # list tools
 */

import { Agent } from "./lib/agent.js";

interface Flags {
  question: string;
  showProcess: boolean;
  stream: boolean;
  forceTool: boolean;
  listTools: boolean;
}

function parseArgs(argv: string[]): Flags {
  const args = argv.slice(2);
  const flags: Flags = {
    question: "",
    showProcess: false,
    stream: false,
    forceTool: false,
    listTools: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--show_process":
        flags.showProcess = true;
        break;
      case "--stream":
        flags.stream = true;
        break;
      case "--force_tool":
        flags.forceTool = true;
        break;
      case "--list_tools":
        flags.listTools = true;
        break;
      default:
        if (!args[i].startsWith("-")) {
          flags.question = args[i];
        }
        break;
    }
  }

  return flags;
}

async function listTools(): Promise<void> {
  const agent = await Agent.create();
  for (const [name, tool] of agent.tools) {
    console.log(`${name}: ${tool.description}`);
  }
}

async function ask(
  question: string,
  options: { showProcess: boolean; stream: boolean; forceTool: boolean }
): Promise<void> {
  const agent = await Agent.create();
  try {
    const answer = await agent.chat(question, {
      verbose: options.showProcess || options.stream,
      stream: options.stream,
      forceTool: options.forceTool,
    });
    if (!options.showProcess && !options.stream) {
      console.log(answer);
    }
  } catch (e) {
    console.error(`[error] ${e}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv);

  if (flags.listTools) {
    await listTools();
    return;
  }

  if (!flags.question) {
    console.error("Error: question is required (unless using --list_tools)");
    process.exit(1);
  }

  await ask(flags.question, {
    showProcess: flags.showProcess,
    stream: flags.stream,
    forceTool: flags.forceTool,
  });
}

main().catch((e) => {
  console.error(`[error] ${e}`);
  process.exit(1);
});
