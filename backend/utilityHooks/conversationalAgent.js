import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { runAgent } from "./agent.js";
import { getFilteredTickets, getFilteredIncidents } from "./filterData.js";

// Use your existing Bedrock client setup
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function handleConversationalQuery(query, cluster = null) {
  try {
    // Step 1: Classify user intent using Bedrock
    const intent = await classifyUserIntent(query);
    
    // Step 2: Execute appropriate action based on intent
    let response;
    switch (intent.category) {
      case "STATUS_CHECK":
        response = await handleStatusQuery(cluster, intent);
        break;
      case "PREDICTION":
        response = await handlePredictionQuery(cluster, intent);
        break;
      case "RESOLUTION":
        response = await handleResolutionQuery(cluster, intent);
        break;
      case "ANALYSIS":
        response = await handleAnalysisQuery(cluster, intent);
        break;
      default:
        response = await handleGeneralQuery(cluster);
    }
    
    return {
      ok: true,
      query,
      cluster: cluster || "ALL",
      intent: intent.category,
      response,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("[Conversational Agent] Error:", error);
    return {
      ok: false,
      query,
      error: "Failed to process conversational query",
      details: error.message
    };
  }
}

// Classify user intent using Bedrock (same model as your aiSummarize)
async function classifyUserIntent(query) {
  const modelId = "openai.gpt-oss-120b-1:0"; // Same model you're using

  const input = {
    model: modelId,
    messages: [
      {
        role: "user",
        content: `You are an intent classifier for an SRE dashboard. Classify this user query into one of these categories:

STATUS_CHECK: Questions about current PT status, error budget health, cluster status
- Examples: "What's the status of UPI cluster?", "How many P1 PTs are open?", "Is Payments in error budget?"

PREDICTION: Questions about future projections, breach timeline, trend analysis  
- Examples: "When will UPI breach error budget?", "Predict PT aging trends", "What's the risk next week?"

RESOLUTION: Questions about fixes, recommendations, mitigation steps
- Examples: "How to resolve aging PTs?", "What should we prioritize?", "Action plan for breaches?"

ANALYSIS: Deep dive questions, root cause, patterns, correlations
- Examples: "Why are PTs aging?", "What's causing the delays?", "Pattern analysis of incidents?"

User Query: "${query}"

Return ONLY JSON: {"category": "STATUS_CHECK|PREDICTION|RESOLUTION|ANALYSIS", "confidence": 0.95, "entities": ["cluster_name", "priority"]}`
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 150,
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

    const rawText = body?.choices?.[0]?.message?.content || body?.output_text || "{}";
    const match = rawText.match(/\{[\s\S]*\}/);
    
    if (match) {
      return JSON.parse(match[0]);
    }
    
    // Fallback classification based on keywords
    return classifyByKeywords(query);
    
  } catch (error) {
    console.error("[Intent Classification] Error:", error);
    return classifyByKeywords(query);
  }
}

// Fallback keyword-based classification
function classifyByKeywords(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes("status") || lowerQuery.includes("how many") || lowerQuery.includes("current")) {
    return { category: "STATUS_CHECK", confidence: 0.8, entities: [] };
  }
  if (lowerQuery.includes("predict") || lowerQuery.includes("when") || lowerQuery.includes("forecast")) {
    return { category: "PREDICTION", confidence: 0.8, entities: [] };
  }
  if (lowerQuery.includes("resolve") || lowerQuery.includes("fix") || lowerQuery.includes("action")) {
    return { category: "RESOLUTION", confidence: 0.8, entities: [] };
  }
  if (lowerQuery.includes("analyze") || lowerQuery.includes("why") || lowerQuery.includes("pattern")) {
    return { category: "ANALYSIS", confidence: 0.8, entities: [] };
  }
  
  return { category: "STATUS_CHECK", confidence: 0.6, entities: [] };
}

// Handle status check queries - REMOVED unused parameters
async function handleStatusQuery(cluster) {
  const agentResult = await runAgent(cluster);
  const ptAnalysis = agentResult.summary?.ptBreachAnalysis || {};
  
  let naturalResponse = `🔍 **Status Report for ${cluster || "ALL clusters"}:**\n\n`;
  
  // Error Budget Status
  naturalResponse += `**Error Budget Status**: ${agentResult.summary?.status || "UNKNOWN"}\n`;
  
  if (ptAnalysis.isInErrorBudget) {
    naturalResponse += `⚠️ **CRITICAL**: Error budget is breached!\n`;
    naturalResponse += `**Reason**: ${ptAnalysis.breachReason}\n\n`;
  } else if (ptAnalysis.isAtRisk) {
    naturalResponse += `⚡ **WARNING**: Approaching error budget breach\n`;
    naturalResponse += `**Risk**: ${ptAnalysis.riskReason}\n\n`;
  } else {
    naturalResponse += `✅ **HEALTHY**: Error budget is within limits\n\n`;
  }
  
  // PT Summary
  naturalResponse += `**Problem Tickets Summary:**\n`;
  naturalResponse += `• Total Open PTs: ${ptAnalysis.totalOpenPTs || 0}\n`;
  naturalResponse += `• Risk Score: ${agentResult.riskScore || 0}/100\n`;
  
  if (ptAnalysis.p1Analysis?.breachingCount > 0) {
    naturalResponse += `• ⚠️ P1 Breaching: ${ptAnalysis.p1Analysis.breachingCount} PTs\n`;
  }
  if (ptAnalysis.p2Analysis?.breachingCount > 0) {
    naturalResponse += `• ⚠️ P2 Breaching: ${ptAnalysis.p2Analysis.breachingCount} PTs\n`;
  }
  if (ptAnalysis.p3Analysis?.breachingCount > 0) {
    naturalResponse += `• ⚠️ P3 Breaching: ${ptAnalysis.p3Analysis.breachingCount} PTs\n`;
  }
  
  // Quick recommendations
  if (agentResult.summary?.mitigationPlan?.length > 0) {
    naturalResponse += `\n**Immediate Actions:**\n`;
    agentResult.summary.mitigationPlan.slice(0, 3).forEach((action, i) => {
      naturalResponse += `${i + 1}. ${action}\n`;
    });
  }

  return {
    naturalLanguage: naturalResponse,
    structured: {
      errorBudgetStatus: agentResult.summary?.status,
      riskScore: agentResult.riskScore,
      openPTs: ptAnalysis.totalOpenPTs || 0,
      breachingSummary: ptAnalysis.breachingSummary || [],
      recommendations: agentResult.summary?.mitigationPlan || []
    }
  };
}

// Handle prediction queries - REMOVED unused parameters
async function handlePredictionQuery(cluster) {
  const tickets = getFilteredTickets(cluster);
  const agentResult = await runAgent(cluster);
  const ptAnalysis = agentResult.summary?.ptBreachAnalysis || {};
  
  // Calculate predictions based on current PT aging
  const openPTs = tickets.filter(t => t.status === "Open");
  const predictions = {
    breachProbability: calculateBreachProbability(ptAnalysis),
    timeline: calculateBreachTimeline(openPTs),
    trend: calculateTrend(ptAnalysis),
    riskFactors: identifyRiskFactors(ptAnalysis)
  };
  
  let naturalResponse = `📊 **Prediction Analysis for ${cluster || "ALL clusters"}:**\n\n`;
  
  naturalResponse += `🔮 **Breach Probability**: ${predictions.breachProbability}% chance of error budget breach in next 14 days\n\n`;
  
  naturalResponse += `⏰ **Critical Timelines:**\n`;
  if (predictions.timeline.p1 !== "No risk") {
    naturalResponse += `• P1 PTs: ${predictions.timeline.p1}\n`;
  }
  if (predictions.timeline.p2 !== "No risk") {
    naturalResponse += `• P2 PTs: ${predictions.timeline.p2}\n`;
  }
  if (predictions.timeline.p3 !== "No risk") {
    naturalResponse += `• P3 PTs: ${predictions.timeline.p3}\n`;
  }
  
  naturalResponse += `\n📈 **Trend**: ${predictions.trend}\n`;
  
  if (predictions.riskFactors.length > 0) {
    naturalResponse += `\n⚠️ **Risk Factors:**\n`;
    predictions.riskFactors.forEach(factor => {
      naturalResponse += `• ${factor}\n`;
    });
  }
  
  naturalResponse += `\n🎯 **Recommended Focus**: `;
  if (predictions.breachProbability > 70) {
    naturalResponse += `IMMEDIATE action on breaching PTs required`;
  } else if (predictions.breachProbability > 40) {
    naturalResponse += `Monitor aging PTs closely and prepare mitigation`;
  } else {
    naturalResponse += `Continue current PT resolution pace`;
  }

  return {
    naturalLanguage: naturalResponse,
    structured: predictions
  };
}

// Handle resolution queries - REMOVED unused parameters
async function handleResolutionQuery(cluster) {
  const agentResult = await runAgent(cluster);
  const ptAnalysis = agentResult.summary?.ptBreachAnalysis || {};
  
  const resolutionPlan = generateSmartResolutionPlan(ptAnalysis, agentResult.summary);
  
  let naturalResponse = `🛠️ **Smart Resolution Plan for ${cluster || "ALL clusters"}:**\n\n`;
  
  if (resolutionPlan.priority.length > 0) {
    naturalResponse += `🔥 **PRIORITY (Do First):**\n`;
    resolutionPlan.priority.forEach((action, i) => {
      naturalResponse += `${i + 1}. ${action}\n`;
    });
    naturalResponse += `\n`;
  }
  
  if (resolutionPlan.quickWins.length > 0) {
    naturalResponse += `⚡ **Quick Wins (< 2 days):**\n`;
    resolutionPlan.quickWins.forEach(action => {
      naturalResponse += `• ${action}\n`;
    });
    naturalResponse += `\n`;
  }
  
  if (resolutionPlan.strategic.length > 0) {
    naturalResponse += `📋 **Strategic Actions (1-2 weeks):**\n`;
    resolutionPlan.strategic.forEach(action => {
      naturalResponse += `• ${action}\n`;
    });
    naturalResponse += `\n`;
  }
  
  naturalResponse += `💡 **Expected Impact**: ${resolutionPlan.expectedImpact}`;

  return {
    naturalLanguage: naturalResponse,
    structured: resolutionPlan
  };
}

// Handle analysis queries - REMOVED unused parameters
async function handleAnalysisQuery(cluster) {
  const tickets = getFilteredTickets(cluster);
  const incidents = getFilteredIncidents(cluster);
  
  const analysis = performAdvancedAnalysis(tickets, incidents, cluster);
  
  let naturalResponse = `🔍 **Advanced Analysis for ${cluster || "ALL clusters"}:**\n\n`;
  
  naturalResponse += `**📊 Key Metrics:**\n`;
  naturalResponse += `• Total PTs: ${tickets.length}\n`;
  naturalResponse += `• Open PTs: ${tickets.filter(t => t.status === "Open").length}\n`;
  naturalResponse += `• Average Age: ${analysis.metrics.averageAge} days\n`;
  naturalResponse += `• Most Common Type: ${analysis.metrics.commonType}\n\n`;
  
  naturalResponse += `**🔄 Patterns Detected:**\n`;
  analysis.patterns.forEach(pattern => {
    naturalResponse += `• ${pattern}\n`;
  });
  
  naturalResponse += `\n**💡 Insights:**\n`;
  analysis.insights.forEach(insight => {
    naturalResponse += `• ${insight}\n`;
  });
  
  naturalResponse += `\n**🎯 Strategic Recommendations:**\n`;
  analysis.recommendations.forEach(rec => {
    naturalResponse += `• ${rec}\n`;
  });

  return {
    naturalLanguage: naturalResponse,
    structured: analysis
  };
}

// Handle general queries - REMOVED unused parameters
async function handleGeneralQuery(cluster) {
  const agentResult = await runAgent(cluster);
  
  return {
    naturalLanguage: `Here's the current overview for ${cluster || "ALL clusters"}:
• Status: ${agentResult.summary?.status || "UNKNOWN"}
• Open PTs: ${agentResult.summary?.ptAnalysis?.totalOpenPTs || 0}
• Risk Score: ${agentResult.riskScore}/100

💬 **For more specific help, try asking:**
• "What's the status of UPI cluster?"
• "When will Payments breach error budget?"
• "How to resolve aging P1 PTs?"
• "Analyze PT patterns for Lending cluster"`,
    structured: agentResult.summary
  };
}

// Helper functions for predictions (rest of the code remains the same)
function calculateBreachProbability(ptAnalysis) {
  let probability = 0;
  
  if (ptAnalysis.isInErrorBudget) return 100;
  
  if (ptAnalysis.p1Analysis?.riskCount > 0) probability += 40;
  if (ptAnalysis.p2Analysis?.riskCount > 1) probability += 30;
  if (ptAnalysis.p3Analysis?.riskCount > 2) probability += 20;
  
  return Math.min(probability, 95);
}

function calculateBreachTimeline(openPTs) {
  const p1PTs = openPTs.filter(pt => pt.priority === "P1");
  const p2PTs = openPTs.filter(pt => pt.priority === "P2");
  const p3PTs = openPTs.filter(pt => pt.priority === "P3");
  
  const timeline = {
    p1: "No risk",
    p2: "No risk", 
    p3: "No risk"
  };
  
  if (p1PTs.length > 0) {
    const oldestP1 = Math.max(...p1PTs.map(pt => pt.ageInDays));
    const daysLeft = 7 - oldestP1;
    timeline.p1 = daysLeft > 0 ? `${daysLeft} days until potential breach` : "ALREADY BREACHING";
  }
  
  if (p2PTs.length > 0) {
    const oldestP2 = Math.max(...p2PTs.map(pt => pt.ageInDays));
    const daysLeft = 15 - oldestP2;
    timeline.p2 = daysLeft > 0 ? `${daysLeft} days until potential breach` : "ALREADY BREACHING";
  }
  
  if (p3PTs.length > 0) {
    const oldestP3 = Math.max(...p3PTs.map(pt => pt.ageInDays));
    const daysLeft = 30 - oldestP3;
    timeline.p3 = daysLeft > 0 ? `${daysLeft} days until potential breach` : "ALREADY BREACHING";
  }
  
  return timeline;
}

function calculateTrend(ptAnalysis) {
  const riskScore = ptAnalysis.riskScore || 0;
  
  if (riskScore > 80) return "Rapidly deteriorating - immediate action needed";
  if (riskScore > 60) return "Concerning trend - increased monitoring required";
  if (riskScore > 30) return "Stable but elevated risk levels";
  return "Improving or stable trend";
}

function identifyRiskFactors(ptAnalysis) {
  const factors = [];
  
  if (ptAnalysis.p1Analysis?.riskCount > 0) {
    factors.push(`${ptAnalysis.p1Analysis.riskCount} P1 PTs approaching 7-day limit`);
  }
  if (ptAnalysis.p2Analysis?.riskCount > 1) {
    factors.push(`${ptAnalysis.p2Analysis.riskCount} P2 PTs approaching 15-day limit`);
  }
  if (ptAnalysis.p3Analysis?.riskCount > 2) {
    factors.push(`${ptAnalysis.p3Analysis.riskCount} P3 PTs approaching 30-day limit`);
  }
  if (ptAnalysis.totalOpenPTs > 25) {
    factors.push(`High PT volume (${ptAnalysis.totalOpenPTs}) may impact resolution speed`);
  }
  
  return factors;
}

// Generate smart resolution plan
function generateSmartResolutionPlan(ptAnalysis, summary) {
  const priority = [];
  const quickWins = [];
  const strategic = [];
  
  // Priority actions
  if (ptAnalysis.isInErrorBudget) {
    priority.push("EMERGENCY: Resolve all breaching PTs within 24 hours");
    priority.push("Escalate to senior engineering team");
  }
  
  if (ptAnalysis.p1Analysis?.breachingCount > 0) {
    priority.push(`Immediately resolve ${ptAnalysis.p1Analysis.breachingCount} breaching P1 PTs`);
  }
  
  // Quick wins
  if (ptAnalysis.p1Analysis?.riskCount > 0) {
    quickWins.push(`Fast-track ${ptAnalysis.p1Analysis.riskCount} aging P1 PTs`);
  }
  if (ptAnalysis.p2Analysis?.riskCount > 0) {
    quickWins.push(`Triage ${ptAnalysis.p2Analysis.riskCount} aging P2 PTs`);
  }
  
  // Strategic actions
  if (ptAnalysis.totalOpenPTs > 20) {
    strategic.push("Review PT assignment and resource allocation");
    strategic.push("Implement automation for common PT types");
  }
  strategic.push("Establish proactive monitoring to prevent PT creation");
  strategic.push("Optimize PT resolution workflows");
  
  let expectedImpact = "Maintain healthy error budget status";
  if (ptAnalysis.isInErrorBudget) {
    expectedImpact = "Critical - Required for error budget recovery";
  } else if (ptAnalysis.riskScore > 60) {
    expectedImpact = "High - Prevents imminent error budget breach";
  }
  
  return {
    priority: priority.slice(0, 3),
    quickWins: quickWins.slice(0, 4),
    strategic: strategic.slice(0, 4),
    expectedImpact
  };
}

// Perform advanced analysis
function performAdvancedAnalysis(tickets, incidents, cluster) {
  const openPTs = tickets.filter(t => t.status === "Open");
  const resolvedPTs = tickets.filter(t => t.status === "Resolved");
  
  // Calculate metrics
  const averageAge = openPTs.length > 0 ? 
    (openPTs.reduce((sum, pt) => sum + pt.ageInDays, 0) / openPTs.length).toFixed(1) : 0;
  
  const typeCount = tickets.reduce((acc, pt) => {
    const type = pt.requestType || pt.category || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  const commonType = Object.entries(typeCount)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || "Unknown";
  
  // Identify patterns
  const patterns = [];
  if (openPTs.filter(pt => pt.priority === "P1").length > 3) {
    patterns.push("High P1 PT volume indicates systemic issues");
  }
  if (averageAge > 10) {
    patterns.push("Above-average PT aging suggests resolution bottlenecks");
  }
  if (incidents.length > 5 && tickets.length > 15) {
    patterns.push("Strong correlation between incidents and PT creation");
  }
  
  // Generate insights
  const insights = [
    `${Math.round((resolvedPTs.length / tickets.length) * 100)}% PT resolution rate`,
    `${commonType} is the most common PT category`,
    `Peak PT creation typically follows incident spikes`
  ];
  
  const recommendations = [
    "Implement automated PT classification and routing",
    "Focus on preventing recurring PT categories", 
    "Establish PT aging alerts and escalation procedures",
    "Review and optimize resource allocation for PT resolution"
  ];
  
  return {
    metrics: {
      averageAge,
      commonType,
      resolutionRate: Math.round((resolvedPTs.length / tickets.length) * 100)
    },
    patterns,
    insights,
    recommendations
  };
}
