import express from "express";
import { analyzeLogs } from "./sreController.js";
import { logEvent } from "./logger.js";


const router = express.Router();

router.use((req, res, next) => {
  const start = Date.now();
  logEvent("info", `Incoming ${req.method} ${req.originalUrl}`, { body: req.body });
  res.on("finish", () => {
    logEvent("info", `${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      durationMs: Date.now() - start,
    });
  });
  next();
});

// ✅ Dashboard: show CMRs, linked incidents, and flow info
router.get("/dashboard", (_, res) => {
  logEvent("info", "SRE Dashboard data fetched");

  const dashboardData = [
    {
      cmrNumber: "CMR-220",
      flow: "prd-node-1",
      incidents: ["INC-1001", "INC-1002"],
      status: "Open",
    },
    {
      cmrNumber: "CMR-221",
      flow: "prd-node-3",
      incidents: ["INC-1003"],
      status: "Closed",
    },
  ];

  res.json({ success: true, data: dashboardData });
});



router.post("/analyze-logs", analyzeLogs);

export default router;
