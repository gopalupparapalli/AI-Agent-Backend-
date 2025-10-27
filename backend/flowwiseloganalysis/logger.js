export const logEvent = (level, msg, meta = null) => {
  const t = new Date().toISOString();
  console.log(`${t} | ${level.toUpperCase()} | ${msg}${meta ? " | " + JSON.stringify(meta) : ""}`);
};
