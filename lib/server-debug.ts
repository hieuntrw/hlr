const ENABLE = process.env.DEBUG_SERVER_LOGS === "1";

function debug(...args: unknown[]) {
  if (ENABLE) console.log(...args);
}

function info(...args: unknown[]) {
  if (ENABLE) console.info(...args);
}

function warn(...args: unknown[]) {
  if (ENABLE) console.warn(...args);
}

function error(...args: unknown[]) {
  // Always log errors so failures are visible
  console.error(...args);
}

const logger = {
  debug,
  info,
  warn,
  error,
};

export default logger;
