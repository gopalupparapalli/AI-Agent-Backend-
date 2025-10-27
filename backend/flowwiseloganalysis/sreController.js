import { fetchLogsFromOpenSearch } from "./openSearchService.js";
import { analyzeWithBedrock } from "./bedRockService.js";
import { logEvent } from "./logger.js";

export const analyzeLogs = async (req, res) => {
  try {
    const { flow, range } = req.body;
    if (!flow) return res.status(400).json({ error: "Missing 'flow' field" });

    logEvent("info", "Analyze-logs called", { flow, range });

    const logs = await fetchLogsFromOpenSearch(flow, range || 1);
    if (!logs.length) {
      logEvent("warn", "No logs found for flow", { flow });
      return res.status(404).json({ error: `No logs found for ${flow}` });
    }

    const { statusCounts, ai } = await analyzeWithBedrock(flow, logs, range);
    logEvent("info", "AI summary generated", { flow });

    res.json({
      success: true,
      flow,
      totalLogs: logs.length,
      statusCounts,
      ai,
      logs,
    });
  } catch (err) {
    logEvent("error", "Analyze-logs failed", { message: err.message });
    res.status(500).json({ error: "AI analysis failed", message: err.message });
  }
};
