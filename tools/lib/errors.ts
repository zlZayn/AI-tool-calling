/**
 * Custom error classes for sandbox tool execution.
 *
 * Keeps error messages identical to the Python version,
 * but provides structured types for programmatic handling.
 */

/** Error kind — used to distinguish failure modes. */
export type SandboxErrorKind =
  | "timeout"
  | "not_found"
  | "crash"
  | "execution_error";

/** Thrown when a sandbox process exceeds its time limit. */
export class SandboxError extends Error {
  readonly kind: SandboxErrorKind;

  constructor(kind: SandboxErrorKind, message: string) {
    super(message);
    this.name = "SandboxError";
    this.kind = kind;
  }

  /** Create a timeout error. */
  static timeout(seconds: number = 30): SandboxError {
    return new SandboxError("timeout", `timeout (${seconds}s)`);
  }

  /** Create a "process not found" error. */
  static notFound(program: string): SandboxError {
    return new SandboxError("not_found", `Error: ${program} not found`);
  }

  /** Create a crash error (killed by signal). */
  static crash(signal: number): SandboxError {
    return new SandboxError(
      "crash",
      `Error: process crashed (signal ${signal})`
    );
  }

  /** Create an execution error from stderr output. */
  static executionError(stderr: string): SandboxError {
    return new SandboxError("execution_error", stderr);
  }
}

/** 沙箱工具的统一错误出口：预期失败（SandboxError）转成结果文本，其余原样抛。
 *  三个 run_* 工具（python / r / shell）此前各自抄了一份同形的 try/catch。 */
export async function withSandboxErrors(run: () => Promise<string>): Promise<string> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof SandboxError) return e.message;
    throw e;
  }
}
