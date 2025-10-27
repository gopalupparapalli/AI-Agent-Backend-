import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { logEvent } from "./logger.js";
import { env } from "./encConfig.js";

const bedrock = new BedrockRuntimeClient({
  region: env.region,
  credentials:
    env.awsKey && env.awsSecret
      ? { accessKeyId: env.awsKey, secretAccessKey: env.awsSecret }
      : undefined,
});

export const analyzeWithBedrock = async (flow, logs, range) => {
  const statusCounts = logs.reduce((acc, log) => {
    const level = log.level || "unknown";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  const sampleLogs = logs
    .slice(0, 30)
    .map((l) => `[${l["@timestamp"]}] ${l.server || ""} ${l.level || ""} - ${l.message || ""}`)
    .join("\n");

  const prompt = `
You are an expert SRE assistant analyzing logs for '${flow}'.

Logs (past ${range || 1}h):
${sampleLogs}

Task:
1. Write a concise, meaningful operational summary (1 short paragraph).
2. Identify 3 likely root causes.
3. Suggest 3 recommended actions.

Return ONLY valid JSON:
{
  "summary": "...",
  "root_causes": ["..."],
  "actions": ["..."]
}
`;

  const cmd = new InvokeModelCommand({
    modelId: env.bedrockModel,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You are an SRE AI assistant. Respond only with professional JSON — no reasoning text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  logEvent("info", "Sending logs to Bedrock", { totalLogs: logs.length, flow });

  const response = await bedrock.send(cmd);
  const raw = new TextDecoder().decode(response.body);

  try {
    const cleaned = raw.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "").trim();
    const parsed = JSON.parse(cleaned);
    logEvent("info", "AI summary parsed successfully", { flow });
    return { statusCounts, ai: parsed };
  } catch {
    logEvent("warn", "AI summary returned non-JSON", { flow });
    return { statusCounts, ai: { summary: raw.trim(), root_causes: [], actions: [] } };
  }
};
