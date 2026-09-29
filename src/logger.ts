/**
 * Minimal leveled logger. Structured, single-line JSON to stdout so a process
 * supervisor can ship it. Never log secrets: pass only the fields you name here,
 * and never spread config or key material into a log call.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel): Logger {
  const threshold = ORDER[level];
  const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
    if (ORDER[lvl] < threshold) return;
    const line = { ts: new Date().toISOString(), level: lvl, msg, ...(fields ?? {}) };
    const sink = lvl === "error" || lvl === "warn" ? console.error : console.log;
    sink(JSON.stringify(line));
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}
