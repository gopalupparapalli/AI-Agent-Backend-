import { getFilteredIncidents, getFilteredTickets } from "./filterData.js";
import { calculateBurnAndProjection } from "./caluclateBurn.js";
import { aiSummarize } from "./aiSummarize.js";
import { sendNotification } from "./sendNotification.js";

export async function fetchDataTool(cluster) {
  try {
    const incidents = getFilteredIncidents(cluster);
    const tickets = getFilteredTickets(cluster);
    
    console.log(`[Agent] Fetched ${incidents.length} incidents and ${tickets.length} PTs for cluster: ${cluster || "ALL"}`);
    
    return { incidents, tickets };
  } catch (error) {
    console.error("[Agent] Error in fetchDataTool:", error);
    return { incidents: [], tickets: [] };
  }
}

export async function calculateBurnTool(incidents, tickets) {
  try {
    const analysis = calculateBurnAndProjection(incidents, tickets);
    
    console.log(`[Agent] Burn analysis - Status: ${analysis.status}, Risk Score: ${analysis.ptBreachAnalysis?.riskScore || 0}`);
    
    return analysis;
  } catch (error) {
    console.error("[Agent] Error in calculateBurnTool:", error);
    return {
      burnRate: 0,
      depletionProjection: "Unable to calculate burn rate",
      status: "UNKNOWN",
      ptBreachAnalysis: { isInErrorBudget: false, riskScore: 0 }
    };
  }
}

export async function aiSummarizeTool(cluster, incidents, tickets, burnRate, depletionProjection, ptBreachAnalysis) {
  try {
    const summary = await aiSummarize(cluster, incidents, tickets, burnRate, depletionProjection, ptBreachAnalysis);
    
    console.log(`[Agent] AI Summary generated for cluster: ${cluster || "ALL"}, Status: ${summary.status || "UNKNOWN"}`);
    
    return summary;
  } catch (error) {
    console.error("[Agent] Error in aiSummarizeTool:", error);
    return {
      error: "AI summarization failed",
      cluster: cluster || "ALL",
      status: "UNKNOWN",
      executiveSummary: "Unable to generate AI summary due to processing error",
      rootCauseAnalysis: "Error in AI analysis pipeline",
      mitigationPlan: ["Check AI service connectivity", "Review input data format"],
      riskAssessment: "Unable to assess risk due to AI processing error",
      depletionProjection: "Unable to project error budget status"
    };
  }
}

export async function notifyTool(cluster) {
  try {
    const result = await sendNotification(cluster);
    console.log(`[Agent] Notification sent for cluster: ${cluster}, Result: ${result}`);
    return result;
  } catch (error) {
    console.error("[Agent] Error in notifyTool:", error);
    return `Notification failed for cluster ${cluster}: ${error.message}`;
  }
}
