import { callBedrock } from './aiClient.js';
import { INTENT_TYPES } from './intent.js';

/**
 * Generate AI-powered response based on intent and data
 * @param {string} query - User query
 * @param {string} intent - Detected intent
 * @param {object} clusterInfo - Cluster data
 * @param {object} cmrInfo - CMR data
 * @param {object} entities - Extracted entities
 * @returns {Promise<object>} - AI response
 */
export async function reasonWithAI(query, intent, clusterInfo, cmrInfo, entities) {
  try {
    const prompt = buildPrompt(query, intent, clusterInfo, cmrInfo, entities);
    const systemPrompt = getSystemPrompt(intent);

    console.log(`📝 Prompt built for intent: ${intent}`);

    const aiResponse = await callBedrock(prompt, {
      systemPrompt,
      maxTokens: 1000,
      temperature: 0.3
    });

    console.log(`✅ AI Response received`);

    // Validate and structure response
    return structureResponse(aiResponse, intent, clusterInfo, cmrInfo);

  } catch (error) {
    console.error('❌ AI Reasoning failed:', error);
    return getFallbackResponse(intent, clusterInfo, cmrInfo, query);
  }
}

/**
 * Build comprehensive prompt based on intent type
 */
function buildPrompt(query, intent, clusterInfo, cmrInfo, entities) {
  let prompt = `User Query: "${query}"\n`;
  prompt += `Intent: ${intent}\n\n`;

  // Route to specific prompt builder based on intent
  switch (intent) {
    case INTENT_TYPES.DEPLOYMENT_READINESS:
      prompt += buildDeploymentReadinessPrompt(clusterInfo, cmrInfo, entities);
      break;
    
    case INTENT_TYPES.CLUSTER_HEALTH:
      prompt += buildClusterHealthPrompt(clusterInfo);
      break;
    
    case INTENT_TYPES.INCIDENTS:
      prompt += buildIncidentsPrompt(clusterInfo);
      break;
    
    case INTENT_TYPES.PERFORMANCE_METRICS:
      prompt += buildPerformancePrompt(clusterInfo, entities);
      break;
    
    case INTENT_TYPES.TROUBLESHOOTING:
      prompt += buildTroubleshootingPrompt(clusterInfo, entities, query);
      break;
    
    case INTENT_TYPES.BEST_PRACTICES:
      prompt += buildBestPracticesPrompt(query);
      break;
    
    case INTENT_TYPES.LOGS_ANALYSIS:
      prompt += buildLogsPrompt(clusterInfo, entities, query);
      break;
    
    case INTENT_TYPES.ALERTS:
      prompt += buildAlertsPrompt(clusterInfo);
      break;
    
    case INTENT_TYPES.CAPACITY_PLANNING:
      prompt += buildCapacityPrompt(clusterInfo, entities);
      break;
    
    case INTENT_TYPES.GENERAL:
    default:
      prompt += buildGeneralPrompt(query, clusterInfo);
      break;
  }

  // Add response format instructions
  prompt += `\n\n` + getResponseFormatInstructions(intent);

  return prompt;
}

/**
 * Get response format instructions based on intent
 */
function getResponseFormatInstructions(intent) {
  let instructions = `Provide response in this EXACT JSON format (no extra text before or after):\n`;
  instructions += `{\n`;
  instructions += `  "summary": "detailed analysis and answer to the user's question",\n`;
  
  // Only include 'ready' field for deployment queries
  if (intent === INTENT_TYPES.DEPLOYMENT_READINESS) {
    instructions += `  "ready": true/false,\n`;
  } else {
    instructions += `  "ready": null,\n`;
  }
  
  instructions += `  "risks": ["risk1", "risk2"] (empty array [] if none),\n`;
  instructions += `  "confidence": 0.0-1.0,\n`;
  instructions += `  "recommendations": ["actionable recommendation 1", "recommendation 2"]\n`;
  instructions += `}`;
  
  return instructions;
}

/**
 * Build deployment readiness specific prompt
 */
function buildDeploymentReadinessPrompt(clusterInfo, cmrInfo, entities) {
  let prompt = `=== DEPLOYMENT READINESS CHECK ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `⚠️ No cluster data found for ${entities.clusterName || 'specified cluster'}.\n`;
    prompt += `Cannot assess deployment readiness without cluster information.\n`;
    return prompt;
  }

  if (!cmrInfo) {
    prompt += `⚠️ CMR ${entities.cmrId} not found in cluster ${clusterInfo.cluster}.\n`;
    prompt += `Cannot assess deployment readiness for non-existent CMR.\n`;
    return prompt;
  }

  prompt += `Cluster Information:\n`;
  prompt += `- Name: ${clusterInfo.cluster}\n`;
  prompt += `- Status: ${clusterInfo.status}\n`;
  prompt += `- Region: ${clusterInfo.region}\n\n`;

  prompt += `CMR Details:\n`;
  prompt += `- ID: ${cmrInfo.id}\n`;
  prompt += `- Status: ${cmrInfo.status}\n`;
  prompt += `- Description: ${cmrInfo.description}\n\n`;
  
  // Linked Incidents Analysis
  if (cmrInfo.linkedIncidents && cmrInfo.linkedIncidents.length > 0) {
    prompt += `Linked Incidents: ${cmrInfo.linkedIncidents.join(', ')}\n`;
    
    const incidents = clusterInfo.incidents.filter(inc => 
      cmrInfo.linkedIncidents.includes(inc.id)
    );
    
    if (incidents.length > 0) {
      prompt += `\nLinked Incident Status:\n`;
      incidents.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description}\n`;
        prompt += `    - Status: ${inc.status}\n`;
        prompt += `    - Priority: ${inc.priority}\n`;
        prompt += `    - Reported: ${inc.reportedAt}\n`;
        if (inc.resolvedAt) {
          prompt += `    - Resolved: ${inc.resolvedAt}\n`;
        }
      });
    }
  } else {
    prompt += `Linked Incidents: None\n`;
  }

  // Linked Problem Tickets Analysis
  if (cmrInfo.linkedPTs && cmrInfo.linkedPTs.length > 0) {
    prompt += `\nLinked Problem Tickets: ${cmrInfo.linkedPTs.join(', ')}\n`;
    
    const pts = clusterInfo.pts.filter(pt => 
      cmrInfo.linkedPTs.includes(pt.id)
    );
    
    if (pts.length > 0) {
      prompt += `\nProblem Ticket Status:\n`;
      pts.forEach(pt => {
        prompt += `  • ${pt.id}: ${pt.description}\n`;
        prompt += `    - Status: ${pt.status}\n`;
      });
    }
  } else {
    prompt += `\nLinked Problem Tickets: None\n`;
  }

  // Cluster-wide Open Incidents
  const openIncidents = clusterInfo.incidents.filter(inc => inc.status === 'open');
  prompt += `\n=== Cluster-Wide Health ===\n`;
  prompt += `Total Open Incidents: ${openIncidents.length}\n`;
  
  if (openIncidents.length > 0) {
    const highPriority = openIncidents.filter(inc => 
      inc.priority === 'critical' || inc.priority === 'high'
    );
    
    if (highPriority.length > 0) {
      prompt += `\nHigh Priority Open Incidents:\n`;
      highPriority.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description} (${inc.priority})\n`;
      });
    }
  }

  prompt += `\n=== DEPLOYMENT SAFETY CHECKLIST ===\n`;
  prompt += `Assess if deployment is SAFE by checking:\n`;
  prompt += `1. ✓ All linked incidents MUST be resolved\n`;
  prompt += `2. ✓ All linked problem tickets MUST be resolved\n`;
  prompt += `3. ✓ Cluster status MUST be 'healthy'\n`;
  prompt += `4. ✓ No critical or high-priority open incidents blocking deployment\n`;
  prompt += `5. ✓ CMR status should be 'approved'\n\n`;
  
  prompt += `IMPORTANT: Set ready=true ONLY if ALL conditions are met. Be conservative.\n`;
  prompt += `If ANY blocker exists, set ready=false and list ALL blockers in the risks array.\n`;

  return prompt;
}

/**
 * Build cluster health specific prompt
 */
function buildClusterHealthPrompt(clusterInfo) {
  let prompt = `=== CLUSTER HEALTH SUMMARY ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `No cluster data available. Cannot assess health.\n`;
    return prompt;
  }

  prompt += `Cluster: ${clusterInfo.cluster}\n`;
  prompt += `Overall Status: ${clusterInfo.status}\n`;
  prompt += `Region: ${clusterInfo.region}\n\n`;

  // Metrics Analysis
  if (clusterInfo.metrics) {
    prompt += `=== Resource Metrics ===\n`;
    prompt += `CPU Usage: ${clusterInfo.metrics.cpu}%\n`;
    prompt += `Memory Usage: ${clusterInfo.metrics.memory}%\n`;
    prompt += `Disk Usage: ${clusterInfo.metrics.disk}%\n\n`;
    
    prompt += `Thresholds for Reference:\n`;
    prompt += `- WARNING: CPU/Disk > 70%, Memory > 75%\n`;
    prompt += `- CRITICAL: CPU/Disk > 85%, Memory > 90%\n\n`;
  }

  // Incidents Summary
  prompt += `=== Incidents Overview ===\n`;
  prompt += `Total Incidents: ${clusterInfo.incidents.length}\n`;
  
  const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
  const resolvedIncidents = clusterInfo.incidents.filter(i => i.status === 'resolved');
  
  prompt += `Open: ${openIncidents.length}\n`;
  prompt += `Resolved: ${resolvedIncidents.length}\n\n`;

  if (openIncidents.length > 0) {
    // Group by priority
    const critical = openIncidents.filter(i => i.priority === 'critical');
    const high = openIncidents.filter(i => i.priority === 'high');
    const medium = openIncidents.filter(i => i.priority === 'medium');
    const low = openIncidents.filter(i => i.priority === 'low');
    
    if (critical.length > 0) {
      prompt += `Critical Priority (${critical.length}):\n`;
      critical.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description}\n`;
      });
    }
    
    if (high.length > 0) {
      prompt += `High Priority (${high.length}):\n`;
      high.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description}\n`;
      });
    }
    
    if (medium.length > 0) {
      prompt += `Medium Priority (${medium.length}):\n`;
      medium.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description}\n`;
      });
    }
  } else {
    prompt += `✓ No open incidents - cluster is incident-free.\n\n`;
  }

  // CMRs Summary
  prompt += `=== Change Management ===\n`;
  prompt += `Total CMRs: ${clusterInfo.cmrs.length}\n`;
  
  const pendingCMRs = clusterInfo.cmrs.filter(c => c.status === 'pending');
  const approvedCMRs = clusterInfo.cmrs.filter(c => c.status === 'approved');
  
  prompt += `Pending: ${pendingCMRs.length}\n`;
  prompt += `Approved: ${approvedCMRs.length}\n\n`;

  prompt += `Provide comprehensive health assessment including:\n`;
  prompt += `1. Overall health rating (healthy/degraded/critical)\n`;
  prompt += `2. Resource utilization analysis\n`;
  prompt += `3. Incident impact assessment\n`;
  prompt += `4. Recommendations for improvement\n`;

  return prompt;
}

/**
 * Build incidents specific prompt
 */
function buildIncidentsPrompt(clusterInfo) {
  let prompt = `=== INCIDENTS REPORT ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `No cluster specified. Cannot retrieve incident data.\n`;
    return prompt;
  }

  prompt += `Cluster: ${clusterInfo.cluster}\n`;
  prompt += `Total Incidents: ${clusterInfo.incidents.length}\n\n`;

  // Group by status
  const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
  const resolvedIncidents = clusterInfo.incidents.filter(i => i.status === 'resolved');

  if (openIncidents.length > 0) {
    prompt += `=== OPEN INCIDENTS (${openIncidents.length}) ===\n\n`;
    
    // Sort by priority
    const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
    openIncidents.sort((a, b) => 
      (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
    );
    
    openIncidents.forEach(inc => {
      prompt += `Incident: ${inc.id}\n`;
      prompt += `  Description: ${inc.description}\n`;
      prompt += `  Priority: ${inc.priority.toUpperCase()}\n`;
      prompt += `  Status: ${inc.status}\n`;
      prompt += `  Reported: ${inc.reportedAt}\n`;
      prompt += `\n`;
    });
  } else {
    prompt += `✓ No open incidents.\n\n`;
  }

  if (resolvedIncidents.length > 0) {
    prompt += `=== RECENTLY RESOLVED INCIDENTS (${resolvedIncidents.length}) ===\n\n`;
    
    // Show only most recent 5
    resolvedIncidents.slice(0, 5).forEach(inc => {
      prompt += `Incident: ${inc.id}\n`;
      prompt += `  Description: ${inc.description}\n`;
      prompt += `  Priority: ${inc.priority}\n`;
      prompt += `  Resolved: ${inc.resolvedAt || 'N/A'}\n`;
      prompt += `\n`;
    });
  }

  prompt += `Provide analysis including:\n`;
  prompt += `1. Incident trends and patterns\n`;
  prompt += `2. Impact on cluster stability\n`;
  prompt += `3. Recommendations for incident prevention\n`;
  prompt += `4. Priority-based action items\n`;

  return prompt;
}

/**
 * Build performance metrics specific prompt
 */
function buildPerformancePrompt(clusterInfo, entities) {
  let prompt = `=== PERFORMANCE ANALYSIS ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `No cluster specified.\n\n`;
    prompt += `Provide general guidance on:\n`;
    prompt += `- Key performance metrics to monitor (CPU, memory, disk, latency, throughput)\n`;
    prompt += `- Performance optimization strategies\n`;
    prompt += `- Identifying bottlenecks\n`;
    prompt += `- Best practices for performance monitoring\n`;
    return prompt;
  }

  prompt += `Cluster: ${clusterInfo.cluster}\n`;
  prompt += `Status: ${clusterInfo.status}\n\n`;
  
  if (clusterInfo.metrics) {
    prompt += `=== Current Metrics ===\n`;
    prompt += `CPU Usage: ${clusterInfo.metrics.cpu}%\n`;
    prompt += `Memory Usage: ${clusterInfo.metrics.memory}%\n`;
    prompt += `Disk Usage: ${clusterInfo.metrics.disk}%\n\n`;
    
    prompt += `=== Threshold Analysis ===\n`;
    prompt += `Standard Thresholds:\n`;
    prompt += `- CPU: ⚠️ Warning > 70%, 🚨 Critical > 85%\n`;
    prompt += `- Memory: ⚠️ Warning > 75%, 🚨 Critical > 90%\n`;
    prompt += `- Disk: ⚠️ Warning > 70%, 🚨 Critical > 85%\n\n`;
    
    // Automatic threshold checking
    const issues = [];
    if (clusterInfo.metrics.cpu > 85) {
      issues.push('CPU is in CRITICAL range');
    } else if (clusterInfo.metrics.cpu > 70) {
      issues.push('CPU is in WARNING range');
    }
    
    if (clusterInfo.metrics.memory > 90) {
      issues.push('Memory is in CRITICAL range');
    } else if (clusterInfo.metrics.memory > 75) {
      issues.push('Memory is in WARNING range');
    }
    
    if (clusterInfo.metrics.disk > 85) {
      issues.push('Disk is in CRITICAL range');
    } else if (clusterInfo.metrics.disk > 70) {
      issues.push('Disk is in WARNING range');
    }
    
    if (issues.length > 0) {
      prompt += `⚠️ Performance Issues Detected:\n`;
      issues.forEach(issue => {
        prompt += `  • ${issue}\n`;
      });
      prompt += `\n`;
    } else {
      prompt += `✓ All metrics within healthy range.\n\n`;
    }
  }

  // If specific metric mentioned
  if (entities.metric) {
    prompt += `User specifically asked about: ${entities.metric.toUpperCase()}\n`;
    prompt += `Focus the analysis on this metric.\n\n`;
  }

  prompt += `Provide:\n`;
  prompt += `1. Current performance assessment\n`;
  prompt += `2. Comparison against healthy baselines\n`;
  prompt += `3. Identified bottlenecks or concerns\n`;
  prompt += `4. Optimization recommendations\n`;
  prompt += `5. Capacity planning suggestions if needed\n`;

  return prompt;
}

/**
 * Build troubleshooting specific prompt
 */
function buildTroubleshootingPrompt(clusterInfo, entities, query) {
  let prompt = `=== TROUBLESHOOTING REQUEST ===\n\n`;
  prompt += `User's Problem: "${query}"\n\n`;
  
  if (clusterInfo) {
    prompt += `Cluster Context:\n`;
    prompt += `- Name: ${clusterInfo.cluster}\n`;
    prompt += `- Status: ${clusterInfo.status}\n`;
    prompt += `- Region: ${clusterInfo.region}\n\n`;
    
    if (clusterInfo.metrics) {
      prompt += `Current State:\n`;
      prompt += `- CPU: ${clusterInfo.metrics.cpu}%\n`;
      prompt += `- Memory: ${clusterInfo.metrics.memory}%\n`;
      prompt += `- Disk: ${clusterInfo.metrics.disk}%\n\n`;
    }
    
    const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
    if (openIncidents.length > 0) {
      prompt += `Active Issues:\n`;
      openIncidents.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description} (${inc.priority})\n`;
      });
      prompt += `\n`;
    }
  }

  prompt += `Provide systematic troubleshooting guidance:\n`;
  prompt += `1. DIAGNOSIS: Steps to identify the root cause\n`;
  prompt += `2. POTENTIAL CAUSES: Most likely reasons based on symptoms\n`;
  prompt += `3. REMEDIATION: Immediate actions to resolve the issue\n`;
  prompt += `4. VERIFICATION: How to confirm the fix worked\n`;
  prompt += `5. PREVENTION: Steps to prevent recurrence\n\n`;
  
  prompt += `Be specific and actionable. Provide commands or procedures where applicable.\n`;

  return prompt;
}

/**
 * Build best practices specific prompt
 */
function buildBestPracticesPrompt(query) {
  let prompt = `=== SRE BEST PRACTICES QUERY ===\n\n`;
  prompt += `Question: "${query}"\n\n`;
  
  prompt += `Provide expert SRE guidance covering:\n`;
  prompt += `1. Industry-standard best practices\n`;
  prompt += `2. Recommended approaches and methodologies\n`;
  prompt += `3. Common pitfalls and anti-patterns to avoid\n`;
  prompt += `4. Implementation guidelines with examples\n`;
  prompt += `5. Trade-offs and considerations\n\n`;
  
  prompt += `Draw from established SRE principles:\n`;
  prompt += `- Google SRE practices\n`;
  prompt += `- DevOps best practices\n`;
  prompt += `- ITIL/ITSM frameworks\n`;
  prompt += `- Observability and monitoring standards\n`;
  prompt += `- Incident management protocols\n\n`;
  
  prompt += `Be comprehensive yet practical. Focus on actionable advice.\n`;

  return prompt;
}

/**
 * Build logs analysis specific prompt
 */
function buildLogsPrompt(clusterInfo, entities, query) {
  let prompt = `=== LOG ANALYSIS REQUEST ===\n\n`;
  prompt += `Query: "${query}"\n\n`;
  
  if (clusterInfo) {
    prompt += `Cluster: ${clusterInfo.cluster}\n`;
    prompt += `Status: ${clusterInfo.status}\n\n`;
    
    const recentIncidents = clusterInfo.incidents
      .filter(i => i.status === 'open')
      .slice(0, 3);
    
    if (recentIncidents.length > 0) {
      prompt += `Related Open Incidents:\n`;
      recentIncidents.forEach(inc => {
        prompt += `  • ${inc.id}: ${inc.description}\n`;
      });
      prompt += `\n`;
    }
  }

  prompt += `Provide comprehensive log analysis guidance:\n\n`;
  
  prompt += `1. WHAT LOGS TO CHECK:\n`;
  prompt += `   - Application logs\n`;
  prompt += `   - System logs (syslog, dmesg)\n`;
  prompt += `   - Container/Pod logs (kubectl logs)\n`;
  prompt += `   - Infrastructure logs (load balancer, network)\n\n`;
  
  prompt += `2. KEY PATTERNS TO LOOK FOR:\n`;
  prompt += `   - Error messages and stack traces\n`;
  prompt += `   - Warnings that preceded failures\n`;
  prompt += `   - Timeout or connection errors\n`;
  prompt += `   - Resource exhaustion indicators\n`;
  prompt += `   - Repeated error patterns\n\n`;
  
  prompt += `3. LOG ANALYSIS TECHNIQUES:\n`;
  prompt += `   - Time correlation with incident\n`;
  prompt += `   - grep/awk patterns for filtering\n`;
  prompt += `   - Log aggregation tools (ELK, Splunk, CloudWatch)\n`;
  prompt += `   - Structured logging queries\n\n`;
  
  prompt += `4. ACTIONABLE COMMANDS:\n`;
  prompt += `   - Provide specific commands for the context\n`;
  prompt += `   - Include kubectl, grep, or other relevant tools\n\n`;
  
  prompt += `Be specific to the user's problem if cluster context is available.\n`;

  return prompt;
}

/**
 * Build alerts specific prompt
 */
function buildAlertsPrompt(clusterInfo) {
  let prompt = `=== ALERT MANAGEMENT ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `No cluster specified.\n\n`;
    prompt += `Provide general guidance on:\n`;
    prompt += `- Setting up effective alerts\n`;
    prompt += `- Alert fatigue prevention\n`;
    prompt += `- Alert prioritization strategies\n`;
    prompt += `- Integration with incident management\n`;
    return prompt;
  }

  prompt += `Cluster: ${clusterInfo.cluster}\n`;
  prompt += `Status: ${clusterInfo.status}\n\n`;
  
  // Derive alerts from metrics
  const alerts = [];
  if (clusterInfo.metrics) {
    if (clusterInfo.metrics.cpu > 85) {
      alerts.push({ severity: 'CRITICAL', metric: 'CPU', value: clusterInfo.metrics.cpu, threshold: 85 });
    } else if (clusterInfo.metrics.cpu > 70) {
      alerts.push({ severity: 'WARNING', metric: 'CPU', value: clusterInfo.metrics.cpu, threshold: 70 });
    }
    
    if (clusterInfo.metrics.memory > 90) {
      alerts.push({ severity: 'CRITICAL', metric: 'Memory', value: clusterInfo.metrics.memory, threshold: 90 });
    } else if (clusterInfo.metrics.memory > 75) {
      alerts.push({ severity: 'WARNING', metric: 'Memory', value: clusterInfo.metrics.memory, threshold: 75 });
    }
    
    if (clusterInfo.metrics.disk > 85) {
      alerts.push({ severity: 'CRITICAL', metric: 'Disk', value: clusterInfo.metrics.disk, threshold: 85 });
    } else if (clusterInfo.metrics.disk > 70) {
      alerts.push({ severity: 'WARNING', metric: 'Disk', value: clusterInfo.metrics.disk, threshold: 70 });
    }
  }
  
  // Incident-based alerts
  const criticalIncidents = clusterInfo.incidents.filter(
    i => i.status === 'open' && i.priority === 'critical'
  );
  
  const highIncidents = clusterInfo.incidents.filter(
    i => i.status === 'open' && i.priority === 'high'
  );
  
  if (criticalIncidents.length > 0) {
    alerts.push({ 
      severity: 'CRITICAL', 
      metric: 'Incidents', 
      value: `${criticalIncidents.length} critical incidents`, 
      threshold: 0 
    });
  }
  
  if (highIncidents.length > 0) {
    alerts.push({ 
      severity: 'WARNING', 
      metric: 'Incidents', 
      value: `${highIncidents.length} high priority incidents`, 
      threshold: 0 
    });
  }
  
  prompt += `=== ACTIVE ALERTS ===\n`;
  if (alerts.length > 0) {
    const critical = alerts.filter(a => a.severity === 'CRITICAL');
    const warnings = alerts.filter(a => a.severity === 'WARNING');
    
    if (critical.length > 0) {
      prompt += `\n🚨 CRITICAL (${critical.length}):\n`;
      critical.forEach(alert => {
        prompt += `  • ${alert.metric}: ${alert.value}`;
        if (alert.threshold > 0) {
          prompt += ` (threshold: ${alert.threshold}%)`;
        }
        prompt += `\n`;
      });
    }
    
    if (warnings.length > 0) {
      prompt += `\n⚠️ WARNINGS (${warnings.length}):\n`;
      warnings.forEach(alert => {
        prompt += `  • ${alert.metric}: ${alert.value}`;
        if (alert.threshold > 0) {
          prompt += ` (threshold: ${alert.threshold}%)`;
        }
        prompt += `\n`;
      });
    }
  } else {
    prompt += `✓ No active alerts - all metrics within normal range.\n`;
  }
  
  if (criticalIncidents.length > 0) {
    prompt += `\n=== CRITICAL INCIDENTS ===\n`;
    criticalIncidents.forEach(inc => {
      prompt += `  • ${inc.id}: ${inc.description}\n`;
    });
  }
  
  prompt += `\nProvide:\n`;
  prompt += `1. Alert prioritization and triage\n`;
  prompt += `2. Immediate actions for critical alerts\n`;
  prompt += `3. Investigation steps for warnings\n`;
  prompt += `4. Alert management recommendations\n`;

  return prompt;
}

/**
 * Build capacity planning specific prompt
 */
function buildCapacityPrompt(clusterInfo, entities) {
  let prompt = `=== CAPACITY PLANNING ===\n\n`;
  
  if (!clusterInfo) {
    prompt += `No cluster specified.\n\n`;
    prompt += `Provide general capacity planning guidance:\n`;
    prompt += `- Capacity planning methodologies\n`;
    prompt += `- Resource forecasting techniques\n`;
    prompt += `- Scaling strategies (horizontal vs vertical)\n`;
    prompt += `- Cost optimization considerations\n`;
    prompt += `- When to scale up vs scale out\n`;
    return prompt;
  }

  prompt += `Cluster: ${clusterInfo.cluster}\n`;
  prompt += `Region: ${clusterInfo.region}\n\n`;
  
  if (clusterInfo.metrics) {
    prompt += `=== Current Resource Utilization ===\n`;
    prompt += `CPU: ${clusterInfo.metrics.cpu}%\n`;
    prompt += `Memory: ${clusterInfo.metrics.memory}%\n`;
    prompt += `Disk: ${clusterInfo.metrics.disk}%\n\n`;
    
    prompt += `=== Capacity Analysis ===\n`;
    
    // Calculate headroom
    const cpuHeadroom = 100 - clusterInfo.metrics.cpu;
    const memoryHeadroom = 100 - clusterInfo.metrics.memory;
    const diskHeadroom = 100 - clusterInfo.metrics.disk;
    
    prompt += `Available Headroom:\n`;
    prompt += `- CPU: ${cpuHeadroom}%\n`;
    prompt += `- Memory: ${memoryHeadroom}%\n`;
    prompt += `- Disk: ${diskHeadroom}%\n\n`;
    
    // Determine urgency
    const needsScaling = [];
    if (clusterInfo.metrics.cpu > 70) needsScaling.push('CPU');
    if (clusterInfo.metrics.memory > 75) needsScaling.push('Memory');
    if (clusterInfo.metrics.disk > 70) needsScaling.push('Disk');
    
    if (needsScaling.length > 0) {
      prompt += `⚠️ Resources Approaching Capacity: ${needsScaling.join(', ')}\n`;
      prompt += `Scaling should be considered soon.\n\n`;
    } else {
      prompt += `✓ Adequate capacity available across all resources.\n\n`;
    }
  }
  
  prompt += `Provide capacity planning recommendations:\n`;
  prompt += `1. Current capacity utilization assessment\n`;
  prompt += `2. Growth trend analysis and projections\n`;
  prompt += `3. Timeline for when scaling will be needed\n`;
  prompt += `4. Recommended scaling strategy (horizontal/vertical)\n`;
  prompt += `5. Cost vs performance trade-offs\n`;
  prompt += `6. Implementation plan for scaling\n`;

  return prompt;
}

/**
 * Build general prompt for any SRE question
 */
function buildGeneralPrompt(query, clusterInfo) {
  let prompt = `=== GENERAL SRE QUERY ===\n\n`;
  prompt += `Question: "${query}"\n\n`;
  
  // Provide context if available
  if (clusterInfo) {
    prompt += `Available Cluster Context:\n`;
    prompt += `- Cluster: ${clusterInfo.cluster}\n`;
    prompt += `- Status: ${clusterInfo.status}\n`;
    prompt += `- Region: ${clusterInfo.region}\n`;
    
    if (clusterInfo.metrics) {
      prompt += `- Metrics: CPU ${clusterInfo.metrics.cpu}%, Memory ${clusterInfo.metrics.memory}%, Disk ${clusterInfo.metrics.disk}%\n`;
    }
    
    const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
    prompt += `- Incidents: ${clusterInfo.incidents.length} total, ${openIncidents.length} open\n`;
    prompt += `- CMRs: ${clusterInfo.cmrs.length} total\n\n`;
  } else {
    prompt += `No specific cluster context provided.\n\n`;
  }

  prompt += `Answer this SRE question comprehensively using:\n\n`;
  
  prompt += `1. SRE PRINCIPLES & BEST PRACTICES:\n`;
  prompt += `   - Draw from Google SRE book principles\n`;
  prompt += `   - Industry-standard approaches\n`;
  prompt += `   - DevOps and ITIL frameworks\n\n`;
  
  prompt += `2. PRACTICAL GUIDANCE:\n`;
  prompt += `   - Actionable recommendations\n`;
  prompt += `   - Real-world implementation advice\n`;
  prompt += `   - Tools and techniques\n\n`;
  
  prompt += `3. CONTEXT-AWARE RESPONSE:\n`;
  prompt += `   - Use cluster data if relevant to question\n`;
  prompt += `   - Provide specific examples\n`;
  prompt += `   - Address user's actual need\n\n`;
  
  prompt += `Be comprehensive yet concise. Focus on providing genuine value.\n`;
  prompt += `If the question is about concepts (SLO, SLA, monitoring, etc.), explain clearly with examples.\n`;
  prompt += `If the question is technical, provide specific steps or commands.\n`;

  return prompt;
}

/**
 * Get system prompt based on intent
 */
function getSystemPrompt(intent) {
  let basePrompt = `You are an expert SRE (Site Reliability Engineering) AI assistant with deep knowledge of:\n`;
  basePrompt += `- Cloud infrastructure (AWS, Azure, GCP) and Kubernetes\n`;
  basePrompt += `- Incident management, troubleshooting, and root cause analysis\n`;
  basePrompt += `- Performance optimization, monitoring, and capacity planning\n`;
  basePrompt += `- Deployment strategies (blue-green, canary, rolling updates)\n`;
  basePrompt += `- Observability (logs, metrics, traces, APM)\n`;
  basePrompt += `- SLO/SLA/SLI design and management\n`;
  basePrompt += `- Chaos engineering and disaster recovery\n`;
  basePrompt += `- Automation, CI/CD, and Infrastructure as Code\n\n`;
  
  switch (intent) {
    case INTENT_TYPES.DEPLOYMENT_READINESS:
      return basePrompt + `CRITICAL: Your role is to assess deployment safety. Only approve deployments if ALL blockers are resolved. Be thorough, cautious, and conservative. Safety is paramount. List every risk clearly.`;
    
    case INTENT_TYPES.CLUSTER_HEALTH:
      return basePrompt + `Focus on comprehensive health assessment. Identify issues proactively. Provide clear, actionable status reports. Highlight both current state and potential concerns.`;
    
    case INTENT_TYPES.INCIDENTS:
      return basePrompt + `Focus on incident analysis and management. Prioritize by severity and impact. Provide actionable insights for resolution and prevention. Help reduce MTTR (Mean Time To Recovery).`;
    
    case INTENT_TYPES.PERFORMANCE_METRICS:
      return basePrompt + `Focus on performance analysis and optimization. Compare metrics against industry standards and thresholds. Identify bottlenecks and suggest specific optimizations with expected impact.`;
    
    case INTENT_TYPES.TROUBLESHOOTING:
      return basePrompt + `Focus on systematic problem-solving. Provide step-by-step diagnostic procedures. Use structured approaches (eliminate possibilities, check logs, analyze metrics). Help identify root cause efficiently.`;
    
    case INTENT_TYPES.BEST_PRACTICES:
      return basePrompt + `Focus on industry standards and proven approaches. Explain the 'why' behind best practices. Discuss trade-offs and considerations. Provide implementation guidance with real-world examples.`;
    
    case INTENT_TYPES.LOGS_ANALYSIS:
      return basePrompt + `Focus on log analysis techniques. Guide users on what to look for, how to filter noise, and how to correlate events. Provide specific commands and queries for log investigation.`;
    
    case INTENT_TYPES.ALERTS:
      return basePrompt + `Focus on alert management and triage. Help prioritize alerts by severity and impact. Suggest immediate actions for critical alerts. Provide guidance on reducing alert fatigue.`;
    
    case INTENT_TYPES.CAPACITY_PLANNING:
      return basePrompt + `Focus on capacity planning and resource optimization. Analyze usage trends and project future needs. Recommend scaling strategies with cost-benefit analysis. Balance performance with efficiency.`;
    
    case INTENT_TYPES.GENERAL:
      return basePrompt + `Provide comprehensive, accurate responses to SRE questions. Draw from established principles and practices. Be helpful, educational, and practical. Tailor responses to user's knowledge level.`;
    
    default:
      return basePrompt + `Provide expert SRE guidance. Be comprehensive, accurate, and helpful. Focus on actionable recommendations and practical solutions.`;
  }
}

/**
 * Structure and validate AI response
 */
function structureResponse(aiResponse, intent, clusterInfo, cmrInfo) {
  // Ensure all required fields exist with proper defaults
  const structured = {
    summary: aiResponse.summary || 'Analysis completed.',
    ready: aiResponse.ready !== undefined ? aiResponse.ready : null,
    risks: Array.isArray(aiResponse.risks) ? aiResponse.risks : [],
    confidence: typeof aiResponse.confidence === 'number' ? Math.max(0, Math.min(1, aiResponse.confidence)) : 0.7,
    recommendations: Array.isArray(aiResponse.recommendations) ? aiResponse.recommendations : []
  };

  // Special validation for deployment readiness
  if (intent === INTENT_TYPES.DEPLOYMENT_READINESS) {
    // Force ready to false if critical conditions not met
    if (!cmrInfo) {
      structured.ready = false;
      if (!structured.risks.includes('CMR not found')) {
        structured.risks.push('CMR not found');
      }
    }
    
    if (clusterInfo && clusterInfo.status !== 'healthy') {
      structured.ready = false;
      if (!structured.risks.some(r => r.toLowerCase().includes('cluster') && r.toLowerCase().includes('health'))) {
        structured.risks.push(`Cluster status is ${clusterInfo.status}, not healthy`);
      }
    }
    
    if (cmrInfo && cmrInfo.linkedIncidents && cmrInfo.linkedIncidents.length > 0) {
      const linkedIncidents = clusterInfo.incidents.filter(inc => 
        cmrInfo.linkedIncidents.includes(inc.id) && inc.status === 'open'
      );
      
      if (linkedIncidents.length > 0) {
        structured.ready = false;
        linkedIncidents.forEach(inc => {
          const riskMsg = `Linked incident ${inc.id} still open (${inc.priority} priority)`;
          if (!structured.risks.includes(riskMsg)) {
            structured.risks.push(riskMsg);
          }
        });
      }
    }
  }

  return structured;
}

/**
 * Fallback response when AI fails
 */
function getFallbackResponse(intent, clusterInfo, cmrInfo, query) {
  console.log('⚠️  Using fallback response mechanism');

  switch (intent) {
    case INTENT_TYPES.DEPLOYMENT_READINESS:
      return getDeploymentFallback(clusterInfo, cmrInfo);
    
    case INTENT_TYPES.CLUSTER_HEALTH:
      return getHealthFallback(clusterInfo);
    
    case INTENT_TYPES.INCIDENTS:
      return getIncidentsFallback(clusterInfo);
    
    case INTENT_TYPES.PERFORMANCE_METRICS:
      return getPerformanceFallback(clusterInfo);
    
    case INTENT_TYPES.TROUBLESHOOTING:
      return getTroubleshootingFallback(query);
    
    case INTENT_TYPES.BEST_PRACTICES:
      return getBestPracticesFallback(query);
    
    case INTENT_TYPES.GENERAL:
      return getGeneralFallback(query);
    
    default:
      return {
        summary: 'AI reasoning temporarily unavailable. Please try again or rephrase your question.',
        ready: null,
        risks: ['AI service unavailable'],
        confidence: 0.3,
        recommendations: ['Retry the query', 'Contact support if issue persists']
      };
  }
}

/**
 * Fallback for deployment readiness
 */
function getDeploymentFallback(clusterInfo, cmrInfo) {
  if (!clusterInfo || !cmrInfo) {
    return {
      summary: 'Cannot assess deployment readiness - cluster or CMR not found.',
      ready: false,
      risks: ['Missing required data'],
      confidence: 0.5,
      recommendations: ['Verify CMR ID and cluster name', 'Check that CMR exists in the specified cluster']
    };
  }

  const risks = [];
  let ready = true;

  if (clusterInfo.status !== 'healthy') {
    risks.push(`Cluster status: ${clusterInfo.status}`);
    ready = false;
  }

  const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
  if (openIncidents.length > 0) {
    risks.push(`${openIncidents.length} open incidents on cluster`);
    ready = false;
  }

  if (cmrInfo.linkedIncidents && cmrInfo.linkedIncidents.length > 0) {
    const linkedOpen = clusterInfo.incidents.filter(
      i => cmrInfo.linkedIncidents.includes(i.id) && i.status === 'open'
    );
    if (linkedOpen.length > 0) {
      risks.push(`${linkedOpen.length} linked incidents still open`);
      ready = false;
    }
  }

  if (cmrInfo.linkedPTs && cmrInfo.linkedPTs.length > 0) {
    const linkedPTs = clusterInfo.pts.filter(pt => 
      cmrInfo.linkedPTs.includes(pt.id) && pt.status !== 'resolved'
    );
    if (linkedPTs.length > 0) {
      risks.push(`${linkedPTs.length} linked problem tickets unresolved`);
      ready = false;
    }
  }

  return {
    summary: ready 
      ? `${cmrInfo.id} appears ready for deployment. Basic checks passed.`
      : `${cmrInfo.id} has blockers preventing deployment. Review risks before proceeding.`,
    ready,
    risks,
    confidence: 0.6,
    recommendations: ready 
      ? ['Proceed with deployment', 'Monitor closely post-deployment', 'Have rollback plan ready']
      : ['Resolve all open incidents', 'Complete linked problem tickets', 'Re-check readiness after fixes']
  };
}

/**
 * Fallback for cluster health
 */
function getHealthFallback(clusterInfo) {
  if (!clusterInfo) {
    return {
      summary: 'Cluster data not available. Cannot assess health.',
      ready: null,
      risks: ['No cluster data found'],
      confidence: 0.3,
      recommendations: ['Verify cluster name', 'Check data source connectivity']
    };
  }

  const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
  const criticalIncidents = openIncidents.filter(i => i.priority === 'critical');
  const risks = [];

  if (clusterInfo.status !== 'healthy') {
    risks.push(`Cluster status is ${clusterInfo.status}`);
  }

  if (criticalIncidents.length > 0) {
    risks.push(`${criticalIncidents.length} critical incidents`);
  }

  if (clusterInfo.metrics) {
    if (clusterInfo.metrics.cpu > 85) risks.push(`High CPU: ${clusterInfo.metrics.cpu}%`);
    if (clusterInfo.metrics.memory > 90) risks.push(`High Memory: ${clusterInfo.metrics.memory}%`);
    if (clusterInfo.metrics.disk > 85) risks.push(`High Disk: ${clusterInfo.metrics.disk}%`);
  }
  
  return {
    summary: `Cluster ${clusterInfo.cluster} is ${clusterInfo.status}. ${openIncidents.length} open incidents (${criticalIncidents.length} critical).`,
    ready: null,
    risks,
    confidence: 0.7,
    recommendations: risks.length > 0
      ? ['Address critical incidents first', 'Investigate resource usage spikes', 'Review incident patterns']
      : ['Continue regular monitoring', 'Maintain current health status', 'Plan for capacity growth']
  };
}

/**
 * Fallback for incidents
 */
function getIncidentsFallback(clusterInfo) {
  if (!clusterInfo) {
    return {
      summary: 'Cluster data not available. Cannot retrieve incidents.',
      ready: null,
      risks: ['No cluster data'],
      confidence: 0.3,
      recommendations: ['Verify cluster name']
    };
  }

  const openIncidents = clusterInfo.incidents.filter(i => i.status === 'open');
  const highPriority = openIncidents.filter(i => i.priority === 'high' || i.priority === 'critical');

  return {
    summary: `Found ${clusterInfo.incidents.length} total incidents on ${clusterInfo.cluster}. ${openIncidents.length} open (${highPriority.length} high priority).`,
    ready: null,
    risks: highPriority.map(i => `${i.id}: ${i.description} (${i.priority})`),
    confidence: 0.7,
    recommendations: highPriority.length > 0
      ? ['Prioritize critical and high-severity incidents', 'Allocate resources for resolution', 'Establish incident response team']
      : ['Monitor for new incidents', 'Review resolution patterns', 'Update runbooks based on learnings']
  };
}

/**
 * Fallback for performance
 */
function getPerformanceFallback(clusterInfo) {
  if (!clusterInfo || !clusterInfo.metrics) {
    return {
      summary: 'Performance data not available.',
      ready: null,
      risks: ['No metrics data'],
      confidence: 0.4,
      recommendations: ['Check monitoring system', 'Verify metrics collection']
    };
  }

  const risks = [];
  if (clusterInfo.metrics.cpu > 70) risks.push(`CPU usage: ${clusterInfo.metrics.cpu}%`);
  if (clusterInfo.metrics.memory > 75) risks.push(`Memory usage: ${clusterInfo.metrics.memory}%`);
  if (clusterInfo.metrics.disk > 70) risks.push(`Disk usage: ${clusterInfo.metrics.disk}%`);

  return {
    summary: `Current metrics - CPU: ${clusterInfo.metrics.cpu}%, Memory: ${clusterInfo.metrics.memory}%, Disk: ${clusterInfo.metrics.disk}%`,
    ready: null,
    risks,
    confidence: 0.7,
    recommendations: risks.length > 0
      ? ['Investigate high resource usage', 'Consider scaling', 'Optimize resource-intensive processes']
      : ['Metrics within healthy range', 'Continue monitoring trends', 'Plan for future capacity needs']
  };
}

/**
 * Fallback for troubleshooting
 */
function getTroubleshootingFallback(query) {
  return {
    summary: 'General troubleshooting guidance: Check logs, verify configurations, test connectivity, review recent changes.',
    ready: null,
    risks: ['AI analysis unavailable - using generic guidance'],
    confidence: 0.4,
    recommendations: [
      'Check application and system logs for errors',
      'Verify network connectivity and DNS resolution',
      'Review recent deployments or configuration changes',
      'Check resource utilization (CPU, memory, disk)',
      'Retry with more specific details about the problem'
    ]
  };
}

/**
 * Fallback for best practices
 */
function getBestPracticesFallback(query) {
  return {
    summary: 'SRE best practices include: monitoring and observability, incident management, capacity planning, automation, and continuous improvement.',
    ready: null,
    risks: [],
    confidence: 0.5,
    recommendations: [
      'Implement comprehensive monitoring and alerting',
      'Establish SLO/SLA frameworks',
      'Automate toil and repetitive tasks',
      'Conduct regular post-incident reviews',
      'Maintain up-to-date runbooks and documentation'
    ]
  };
}

/**
 * Fallback for general queries
 */
function getGeneralFallback(query) {
  return {
    summary: 'I can help with SRE topics including deployment readiness, cluster health, incidents, performance, troubleshooting, and best practices.',
    ready: null,
    risks: [],
    confidence: 0.5,
    recommendations: [
      'Ask about specific cluster health or incidents',
      'Check deployment readiness for a CMR',
      'Inquire about SRE best practices',
      'Get troubleshooting guidance for issues',
      'Learn about monitoring and observability'
    ]
  };
}
