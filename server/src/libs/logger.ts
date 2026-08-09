export function logInfo(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

export function logError(...args: unknown[]) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}