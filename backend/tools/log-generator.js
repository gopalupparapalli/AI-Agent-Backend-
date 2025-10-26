// backend/tools/log-generator.js
import fs from "fs";

const methods = ["GET", "POST", "PUT"];
const statuses = [200, 400, 404, 500];
const flows = ["billing-service", "payment-service", "invoice-api", "auth-service"];
const servers = ["prd-node-1", "prd-node-2", "prd-api-3", "prd-cache-1"];
const messages = [
  "Latency spike detected",
  "Database reconnecting",
  "Cache eviction initiated",
  "User API error",
  "Container restarted",
  "Service healthy",
  "Circuit breaker opened",
  "Timeout while calling third-party API"
];

function generateLogs(count = 2000) {
  const logs = [];
  for (let i = 0; i < count; i++) {
    logs.push({
      "@timestamp": new Date(Date.now() - Math.random() * 1e9).toISOString(),
      request: {
        method: methods[Math.floor(Math.random() * methods.length)],
        url: `/api/v1/${flows[Math.floor(Math.random() * flows.length)]}`
      },
      response: { status: statuses[Math.floor(Math.random() * statuses.length)] },
      message: messages[Math.floor(Math.random() * messages.length)],
      server: servers[Math.floor(Math.random() * servers.length)],
      latency: Math.floor(Math.random() * 300)
    });
  }
  return logs;
}

const logs = generateLogs(200);
fs.writeFileSync("backend/data/dummy-logs.json", JSON.stringify(logs, null, 2));
console.log("✅ 200 dummy logs written to backend/data/dummy-logs.json");
