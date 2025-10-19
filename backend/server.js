import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

import { runAgent } from "./utilityHooks/agent.js";
// Add this import at the top
import { handleConversationalQuery } from "./utilityHooks/conversationalAgent.js";

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(bodyParser.json());

const clustersToMonitor = ["UPI", "Lending", "Payments"];

console.log("SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY ? "Loaded" : "Missing");
console.log("NOTIFY_EMAIL:", process.env.NOTIFY_EMAIL ? "Loaded" : "Missing");
console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "Loaded" : "Missing");
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "Loaded" : "Missing");

// Enhanced daily notification with PT breach monitoring
cron.schedule(
  "0 12 * * *",
  async () => {
    console.log("Running daily PT breach monitoring and notifications...");
    const results = await Promise.all(
      clustersToMonitor.map(async (cluster) => {
        try {
          const agentResult = await runAgent(cluster);
          const status = agentResult.summary?.status || "UNKNOWN";
          const riskScore = agentResult.riskScore || 0;
          
          console.log(`[Cron] Cluster ${cluster}: Status=${status}, Risk=${riskScore}, Notification=${agentResult.notifyResult}`);
          
          return {
            cluster,
            status,
            riskScore,
            notification: agentResult.notifyResult
          };
        } catch (err) {
          console.error(`[Cron] Error monitoring cluster ${cluster}:`, err);
          return {
            cluster,
            status: "ERROR", 
            error: err.message
          };
        }
      })
    );
    
    console.log("[Cron] Daily PT monitoring completed:", results);
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);

// Enhanced AI Summary endpoint with PT breach analysis
app.get("/api/ai/summary", async (req, res) => {
  const cluster = req.query.cluster || null;
  
  try {
    console.log(`[API] AI Summary request for cluster: ${cluster || "ALL"}`);
    const agentResult = await runAgent(cluster);
    
    res.json({
      ok: true,
      source: "PT-enhanced-agent",
      cluster: cluster || "ALL",
      analysis: agentResult.summary,
      riskScore: agentResult.riskScore,
      timestamp: agentResult.timestamp
    });
  } catch (error) {
    console.error("[API] AI Summary error:", error);
    res.status(500).json({ 
      ok: false, 
      error: "AI summary generation failed",
      details: error.message
    });
  }
});

// Enhanced immediate notification with PT status check
app.post("/api/notify", async (req, res) => {
  const { cluster } = req.body;
  if (!cluster) return res.status(400).json({ ok: false, error: "Cluster is required" });

  try {
    console.log(`[API] Manual notification request for cluster: ${cluster}`);
    const agentResult = await runAgent(cluster);
    
    res.json({ 
      ok: true, 
      cluster,
      notifyResult: agentResult.notifyResult,
      status: agentResult.summary?.status || "UNKNOWN",
      riskScore: agentResult.riskScore,
      timestamp: agentResult.timestamp
    });
  } catch (error) {
    console.error("[API] Manual notification error:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Notification request failed",
      details: error.message
    });
  }
});

// New endpoint: PT Breach Status
app.get("/api/pt-status", async (req, res) => {
  const cluster = req.query.cluster || null;
  
  try {
    const analysisResult = await runAgent(cluster);  // Invokes your agent which calculates PT analysis
    
    res.json({
      ok: true,
      cluster: cluster || "ALL",
      status: analysisResult.summary?.status || "UNKNOWN",
      riskScore: analysisResult.riskScore,
      ptAnalysis: analysisResult.summary?.ptAnalysis || {},
      timestamp: analysisResult.timestamp
    });
  } catch (error) {
    console.error("Error in /api/pt-status:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to retrieve PT status",
      details: error.message
    });
  }
});



// Add this new endpoint after your existing endpoints
// Conversational AI endpoint - THE GAME CHANGER! 🚀
// Replace the debug chat endpoint in your server.js with this:
app.post("/api/chat", async (req, res) => {
  const { query, cluster } = req.body;
  
  console.log(`[API] Conversational query: "${query}" for cluster: ${cluster || "ALL"}`);
  
  if (!query) {
    return res.status(400).json({ ok: false, error: "Query is required" });
  }
  
  try {
    // Use the real conversational agent instead of debug response
    const response = await handleConversationalQuery(query, cluster);
    console.log(`[API] Chat response generated successfully`);
    res.json(response);
  } catch (error) {
    console.error("[API] Chat error:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Failed to process conversational query",
      details: error.message
    });
  }
});



// Batch analysis endpoint for multiple clusters
app.post("/api/batch-analysis", async (req, res) => {
  const { clusters = ["UPI", "Lending", "Payments"], analysisType = "status" } = req.body;
  
  try {
    console.log(`[API] Batch analysis request: ${analysisType} for clusters: ${clusters.join(", ")}`);
    
    const results = await Promise.all(
      clusters.map(async (cluster) => {
        try {
          const agentResult = await runAgent(cluster);
          return {
            cluster,
            status: agentResult.summary?.status || "UNKNOWN",
            riskScore: agentResult.riskScore,
            openPTs: agentResult.summary?.ptAnalysis?.totalOpenPTs || 0,
            breachRisk: agentResult.summary?.ptBreachAnalysis?.breachingSummary || []
          };
        } catch (error) {
          return {
            cluster,
            error: error.message,
            status: "ERROR"
          };
        }
      })
    );
    
    res.json({
      ok: true,
      analysisType,
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error) {
    console.error("[API] Batch analysis error:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Batch analysis failed",
      details: error.message
    });
  }
});





app.listen(PORT, () => {
  console.log(`🚀 Enhanced SLI Budget Forecaster with PT-based Error Budget running on http://localhost:${PORT}`);
});
