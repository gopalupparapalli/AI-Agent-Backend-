// backend/sreRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const router = express.Router();
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
const filePath = path.resolve("data/dummy-logs.json");

// -------------------- Logging Middleware --------------------
router.use((req, res, next) => {
  const start = Date.now();
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  if (Object.keys(req.body || {}).length > 0) console.log("Body:", req.body);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`✅ [${req.method} ${req.originalUrl}] ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// -------------------- Dummy metadata for dashboard --------------------
const meta = {
  cmrs: [
    { id: "CMR001", flow: "billing-service", owner: "DevOps", status: "Pending" },
    { id: "CMR002", flow: "payment-service", owner: "SRE Team", status: "Approved" },
    { id: "CMR003", flow: "auth-service", owner: "Platform", status: "Review" }
  ],
  incidents: [
    { id: "INC1001", flow: "billing-service", status: "Open" },
    { id: "INC1002", flow: "auth-service", status: "Closed" }
  ],
  pts: [
    { id: "PT501", flow: "billing-service", status: "In Progress" },
    { id: "PT502", flow: "payment-service", status: "Resolved" },
    { id: "PT503", flow: "auth-service", status: "In Progress" }
  ]
};

// -------------------- GET: Dashboard linking CMR, incident, PT --------------------
router.get("/dashboard", (_, res) => {
  console.log("🔍 Generating dashboard summary...");
  const result = meta.cmrs.map((cmr) => {
    const incident = meta.incidents.find((i) => i.flow === cmr.flow && i.status === "Open");
    const pts = meta.pts.filter((p) => p.flow === cmr.flow).map((p) => p.id);
    return { ...cmr, incident: incident ? incident.id : null, pts };
  });
  res.json(result);
});

// -------------------- POST: Analyze logs via Bedrock --------------------
router.post("/analyze-logs", async (req, res) => {
  try {
    const { flow, range } = req.body;
    console.log(`🧠 GPT‑OSS analyzing logs for ${flow} (${range}h)`);

    // ---------------- Read and Prepare Logs ----------------
    const logs = JSON.parse(fs.readFileSync(filePath));
    const subset = logs.filter(l => l.request.url.includes(flow)).slice(0, 60);

    if (!subset.length) {
      return res.status(404).json({ error: `No logs found for ${flow}` });
    }

    // Count by status code
    const statusCounts = subset.reduce((acc, log) => {
      const code = log.response?.status || "unknown";
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    const countsText = Object.entries(statusCounts)
      .map(([code, count]) => `• HTTP ${code}: ${count} occurrences`)
      .join("\n");

    // Condense logs for token efficiency
    const logLines = subset
      .slice(0, 40)
      .map(
        l =>
          `[${l["@timestamp"]}] ${l.request.method} ${l.request.url} (${l.response.status}) - ${l.message}`
      )
      .join("\n");

    const prompt = `
Service: ${flow}
Time‑range: ${range} hours

Summary of HTTP responses:
${countsText}

Logs:
${logLines}

Task:
1. Identify error patterns (4xx / 5xx).
2. Infer likely root causes (network, DB, config).
3. Suggest 3 actionable remediation steps.
4. Write the summary in clear English (≤ 10 lines).
`;

    // ---------------- GPT‑OSS Chat Completions payload ----------------
    const body = {
      messages: [
        {
          role: "system",
          content:
            "You are an expert SRE assistant analyzing production logs and presenting concise reliability insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      top_p: 0.9,
      max_completion_tokens: 800
    };

    console.log("📨 Sending GPT‑OSS prompt (" + prompt.length + " chars)...");

    const cmd = new InvokeModelCommand({
      modelId: "openai.gpt-oss-120b-1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body)
    });

    const response = await bedrock.send(cmd);
    const raw = new TextDecoder().decode(response.body);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("⚠️ Non‑JSON Bedrock output, returning raw text.");
    }

    const aiSummary =
      parsed?.choices?.[0]?.message?.content?.trim() ||
      parsed?.choices?.[0]?.text?.trim() ||
      raw.trim() ||
      "No summary generated.";

    console.log("📋 AI Summary:\n", aiSummary);

    res.json({ flow, summary: aiSummary, logs: subset, statusCounts });
  } catch (err) {
    console.error("❌ GPT‑OSS analysis failed:", err);
    res.status(500).json({ error: "AI analysis failed", message: err.message });
  }
});



export default router;
