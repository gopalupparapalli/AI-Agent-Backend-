import {
  fetchDataTool,
  calculateBurnTool,
  aiSummarizeTool,
  notifyTool,
} from "./agentTools.js";

export async function runAgent(cluster) {
  const { incidents, tickets } = await fetchDataTool(cluster);
  const { burnRate, depletionProjection } = await calculateBurnTool(incidents, tickets);
  const summary = await aiSummarizeTool(cluster, incidents, tickets, burnRate, depletionProjection);

  let notifyResult = "Notification not needed";
  if (summary.status && summary.status.toUpperCase().includes("ERROR")) {
    notifyResult = await notifyTool(cluster);
  }

  return { cluster, summary, notifyResult, burnRate, depletionProjection };
}
