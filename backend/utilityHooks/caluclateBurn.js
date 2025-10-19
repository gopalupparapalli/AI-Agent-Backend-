export function calculateBurnAndProjection(filteredIncidents, filteredTickets, windowDays = 7, allowedPer28d = 2) {
  const incidentsCount = filteredIncidents.length;
  const ticketsCount = filteredTickets.length;
  const issuesCount = incidentsCount + ticketsCount;
  const windowBudget = allowedPer28d * (windowDays / 28);
  const burnRate = windowBudget === 0 ? 0 : issuesCount / windowBudget;

  // PT-based Error Budget Breach Analysis (Company Rules)
  const ptBreachAnalysis = calculatePTBreachStatus(filteredTickets);
  
  let depletionProjection;
  let status = "HEALTHY";

  // PT breach conditions take priority over burn rate
  if (ptBreachAnalysis.isInErrorBudget) {
    status = "IN ERROR BUDGET";
    depletionProjection = `Error budget BREACHED: ${ptBreachAnalysis.breachReason} Immediate resolution required.`;
  } else if (ptBreachAnalysis.isAtRisk) {
    status = "WARNING";
    depletionProjection = `Error budget at RISK: ${ptBreachAnalysis.riskReason} Monitor PT aging closely.`;
  } else if (issuesCount === 0) {
    depletionProjection = "No issues observed this period; error budget healthy.";
  } else {
    // Original burn rate logic
    const allowedTotal = allowedPer28d;
    const currentPeriod = windowDays;
    const burnPerDay = issuesCount / currentPeriod;
    const remainingIssues = allowedTotal - issuesCount;
    if (remainingIssues <= 0) {
      status = "IN ERROR BUDGET";
      depletionProjection = "Error budget exhausted based on incident count.";
    } else {
      const estDaysLeft = Math.ceil(remainingIssues / burnPerDay);
      depletionProjection = `At current burn rate, error budget will be depleted in approximately ${estDaysLeft} days.`;
    }
  }

  return { 
    burnRate, 
    depletionProjection, 
    status,
    issuesCount, 
    incidentsCount, 
    ticketsCount,
    ptBreachAnalysis
  };
}

// Calculate PT breach status based on company rules
function calculatePTBreachStatus(tickets) {
  const openPTs = tickets.filter(t => t.status === "Open");
  
  // Company Error Budget Rules:
  // 2 P1 PTs open > 7 days = Breach
  // 3 P2 PTs open > 15 days = Breach  
  // 5 P3 PTs open > 30 days = Breach
  
  const p1Analysis = analyzePriorityBreach(openPTs, "P1", 7, 2);
  const p2Analysis = analyzePriorityBreach(openPTs, "P2", 15, 3);
  const p3Analysis = analyzePriorityBreach(openPTs, "P3", 30, 5);
  
  const isInErrorBudget = p1Analysis.isBreaching || p2Analysis.isBreaching || p3Analysis.isBreaching;
  const isAtRisk = p1Analysis.isAtRisk || p2Analysis.isAtRisk || p3Analysis.isAtRisk;
  
  let breachReason = "";
  let riskReason = "";
  
  if (p1Analysis.isBreaching) breachReason += `${p1Analysis.breachingCount} P1 PTs open > 7 days (threshold: 2). `;
  if (p2Analysis.isBreaching) breachReason += `${p2Analysis.breachingCount} P2 PTs open > 15 days (threshold: 3). `;
  if (p3Analysis.isBreaching) breachReason += `${p3Analysis.breachingCount} P3 PTs open > 30 days (threshold: 5). `;
  
  if (p1Analysis.isAtRisk) riskReason += `${p1Analysis.riskCount} P1 PTs approaching 7-day threshold. `;
  if (p2Analysis.isAtRisk) riskReason += `${p2Analysis.riskCount} P2 PTs approaching 15-day threshold. `;
  if (p3Analysis.isAtRisk) riskReason += `${p3Analysis.riskCount} P3 PTs approaching 30-day threshold. `;
  
  return {
    isInErrorBudget,
    isAtRisk,
    breachReason: breachReason.trim(),
    riskReason: riskReason.trim(),
    p1Analysis,
    p2Analysis, 
    p3Analysis,
    totalOpenPTs: openPTs.length,
    riskScore: calculateRiskScore(p1Analysis, p2Analysis, p3Analysis),
    breachingSummary: generateBreachingSummary(p1Analysis, p2Analysis, p3Analysis)
  };
}

function analyzePriorityBreach(tickets, priority, maxDays, threshold) {
  const priorityTickets = tickets.filter(t => t.priority === priority);
  const breachingTickets = priorityTickets.filter(t => t.ageInDays > maxDays);
  const riskTickets = priorityTickets.filter(t => t.ageInDays > (maxDays * 0.8) && t.ageInDays <= maxDays);
  
  return {
    isBreaching: breachingTickets.length >= threshold,
    isAtRisk: riskTickets.length >= Math.max(1, threshold - 1) && breachingTickets.length < threshold,
    breachingCount: breachingTickets.length,
    riskCount: riskTickets.length,
    totalCount: priorityTickets.length,
    threshold,
    maxDays,
    breachingTickets: breachingTickets.map(t => ({
      id: t.id,
      ticketId: t.ticketId,
      ageInDays: t.ageInDays,
      assignee: t.assignee,
      description: t.description.substring(0, 100) + "..."
    })),
    riskTickets: riskTickets.map(t => ({
      id: t.id,
      ticketId: t.ticketId,
      ageInDays: t.ageInDays,
      assignee: t.assignee,
      description: t.description.substring(0, 100) + "..."
    }))
  };
}

function calculateRiskScore(p1Analysis, p2Analysis, p3Analysis) {
  let score = 0;
  
  // P1 scoring (highest impact)
  if (p1Analysis.isBreaching) score += 100;
  else if (p1Analysis.isAtRisk) score += 60;
  else score += (p1Analysis.riskCount * 20);
  
  // P2 scoring  
  if (p2Analysis.isBreaching) score += 75;
  else if (p2Analysis.isAtRisk) score += 45;
  else score += (p2Analysis.riskCount * 15);
  
  // P3 scoring
  if (p3Analysis.isBreaching) score += 50;
  else if (p3Analysis.isAtRisk) score += 30;
  else score += (p3Analysis.riskCount * 10);
  
  return Math.min(score, 100);
}

function generateBreachingSummary(p1Analysis, p2Analysis, p3Analysis) {
  const summary = [];
  
  if (p1Analysis.isBreaching) {
    summary.push(`${p1Analysis.breachingCount} P1 PTs breaching (${p1Analysis.threshold} max allowed > ${p1Analysis.maxDays} days)`);
  }
  if (p2Analysis.isBreaching) {
    summary.push(`${p2Analysis.breachingCount} P2 PTs breaching (${p2Analysis.threshold} max allowed > ${p2Analysis.maxDays} days)`);
  }
  if (p3Analysis.isBreaching) {
    summary.push(`${p3Analysis.breachingCount} P3 PTs breaching (${p3Analysis.threshold} max allowed > ${p3Analysis.maxDays} days)`);
  }
  
  return summary;
}
