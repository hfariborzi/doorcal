/**
 * Logs an error without dumping the whole object. Provider SDK errors can carry the request they were
 * thrown from, including Authorization headers, so only the message and status code go to the logs.
 */
export function logError(context: string, err: unknown) {
  const e = err as { message?: string; code?: unknown; status?: unknown; name?: string } | undefined;
  const code = e?.code ?? e?.status;
  console.error(`[${context}] ${e?.name ?? "Error"}${code !== undefined ? ` (${String(code)})` : ""}: ${e?.message ?? String(err)}`);
}

export function logWarn(context: string, message: string) {
  console.warn(`[${context}] ${message}`);
}
