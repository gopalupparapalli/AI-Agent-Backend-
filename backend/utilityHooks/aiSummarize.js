import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("AWS credentials not found in environment variables");
}

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function aiSummarize(cluster, filteredIncidents, filteredTickets, burnRate, depletionProjection, ptBreachAnalysis) {
  const modelId = "openai.gpt-oss-120b-1:0";

  const historicalTrend = [
    { week: "Week -4", burnRate: 0.5 },
    { week: "Week -3", burnRate: 0.8 },
    { week: "Week -2", burnRate: 1.1 },
    { week: "Last week", burnRate: burnRate.toFixed(2) },
  ];

  // Format PT data for better AI analysis
  const openPTs = filteredTickets.filter(t => t.status === "Open");
  const ptSummary = {
    totalOpen: openPTs.length,
    byPriority: {
      P1: openPTs.filter(t => t.priority === "P1").length,
      P2: openPTs.filter(t => t.priority === "P2").length,
      P3: openPTs.filter(t => t.priority === "P3").length,
      P4: openPTs.filter(t => t.priority === "P4").length
    },
    aging: {
      P1_over_7days: openPTs.filter(t => t.priority === "P1" && t.ageInDays > 7).length,
      P2_over_15days: openPTs.filter(t => t.priority === "P2" && t.ageInDays > 15).length,
      P3_over_30days: openPTs.filter(t => t.priority === "P3" && t.ageInDays > 30).length
    }
  };

  const input = {
    model: modelId,
    messages: [
      {
        role: "user",
        content: `You are an expert SRE analyst for cluster "${cluster || "ALL"}".

INCIDENT DATA: ${JSON.stringify(filteredIncidents, null, 2)}

PROBLEM TICKETS (PT) DATA: ${JSON.stringify(filteredTickets, null, 2)}

PT SUMMARY: ${JSON.stringify(ptSummary, null, 2)}

ERROR BUDGET RULES (Company Policy):
- 2 P1 PTs open > 7 days = Error Budget Breach
- 3 P2 PTs open > 15 days = Error Budget Breach  
- 5 P3 PTs open > 30 days = Error Budget Breach

PT BREACH ANALYSIS: ${ptBreachAnalysis ? JSON.stringify(ptBreachAnalysis, null, 2) : "No breach analysis available"}

BURN RATE: ${burnRate.toFixed(2)}
DEPLETION: ${depletionProjection}
HISTORICAL TREND: ${JSON.stringify(historicalTrend, null, 2)}

Task: Analyze the PT-based error budget status and provide actionable insights.
Focus on:
1. PT aging patterns and breach risk
2. Root causes of long-standing PTs  
3. Specific mitigation actions for aging PTs
4. Risk assessment based on PT breach rules

Return only JSON with no extra text:
{
  "cluster": "${cluster || "ALL"}",
  "status": "HEALTHY|WARNING|IN ERROR BUDGET",
  "executiveSummary": "Executive summary focusing on PT status and error budget impact...",
  "rootCauseAnalysis": "Analysis of why PTs are aging beyond company thresholds...",
  "mitigationPlan": ["Specific actionable steps to resolve aging PTs and prevent breaches"],
  "riskAssessment": "Risk level assessment based on PT breach analysis and company rules...",
  "depletionProjection": "PT-based error budget projection with timeline..."
}`,
      },
    ],
    temperature: 0,
    max_completion_tokens: 900,
  };

  try {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(input),
    });

    const response = await client.send(command);
    const bodyStr = new TextDecoder().decode(response.body);
    const body = JSON.parse(bodyStr);

    const rawText =
      body?.choices?.[0]?.message?.content ||
      body?.output_text ||
      JSON.stringify(body);

    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      
      // Enhance the result with PT-specific data
      result.ptAnalysis = ptBreachAnalysis || {};
      result.ptSummary = ptSummary;
      
      return result;
    }
    return { error: "No valid JSON in AI response", raw: rawText };
  } catch (err) {
    console.error("[AI Summarizer] Error:", err);
    return { error: "AI analysis failed" };
  }
}
