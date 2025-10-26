/**
 * Intent types supported by the SRE assistant
 */
export const INTENT_TYPES = {
  DEPLOYMENT_READINESS: 'deployment_readiness',
  CLUSTER_HEALTH: 'cluster_health',
  INCIDENTS: 'incidents',
  PERFORMANCE_METRICS: 'performance_metrics',
  TROUBLESHOOTING: 'troubleshooting',
  BEST_PRACTICES: 'best_practices',
  LOGS_ANALYSIS: 'logs_analysis',
  ALERTS: 'alerts',
  CAPACITY_PLANNING: 'capacity_planning',
  GENERAL: 'general'
};

/**
 * Parse user query to detect intent
 * @param {string} query - User query string
 * @returns {string} - Detected intent type
 */
export function parseIntent(query) {
  if (!query) return INTENT_TYPES.GENERAL;

  const q = query.toLowerCase().trim();

  // Deployment readiness patterns
  if (
    q.includes('can i deploy') ||
    (q.includes('deploy') && (q.includes('cmr') || q.includes('ready'))) ||
    q.includes('deployment readiness') ||
    q.includes('safe to deploy') ||
    (q.includes('is cmr') && q.includes('ready'))
  ) {
    return INTENT_TYPES.DEPLOYMENT_READINESS;
  }

  // Cluster health patterns
  if (
    q.includes('health of') ||
    (q.includes('status of') && !q.includes('incident')) ||
    (q.includes('how is') && (q.includes('cluster') || q.includes('upi') || q.includes('netbank'))) ||
    (q.includes('show me') && q.includes('cluster')) ||
    q.includes('cluster summary') ||
    q.includes('overall status')
  ) {
    return INTENT_TYPES.CLUSTER_HEALTH;
  }

  // Incidents patterns
  if (
    (q.includes('incident') && (q.includes('on') || q.includes('in') || q.includes('list'))) ||
    q.includes('what incidents') ||
    q.includes('any incidents') ||
    q.includes('show incidents') ||
    q.includes('incident report')
  ) {
    return INTENT_TYPES.INCIDENTS;
  }

  // Performance metrics patterns
  if (
    q.includes('performance') ||
    q.includes('metrics') ||
    q.includes('cpu') || q.includes('memory') || q.includes('disk') ||
    q.includes('latency') ||
    q.includes('throughput') ||
    q.includes('response time')
  ) {
    return INTENT_TYPES.PERFORMANCE_METRICS;
  }

  // Troubleshooting patterns
  if (
    q.includes('troubleshoot') ||
    q.includes('debug') ||
    (q.includes('why is') && (q.includes('slow') || q.includes('down') || q.includes('failing'))) ||
    q.includes('how to fix') ||
    q.includes('error') || q.includes('problem') ||
    q.includes('not working') ||
    q.includes('issue with')
  ) {
    return INTENT_TYPES.TROUBLESHOOTING;
  }

  // Best practices patterns
  if (
    q.includes('best practice') ||
    q.includes('should i') ||
    q.includes('recommended') ||
    q.includes('how to handle') ||
    q.includes('what is the right way') ||
    q.includes('guideline')
  ) {
    return INTENT_TYPES.BEST_PRACTICES;
  }

  // Logs analysis patterns
  if (
    q.includes('log') || q.includes('logs') ||
    q.includes('trace') ||
    q.includes('check logs') ||
    q.includes('log analysis')
  ) {
    return INTENT_TYPES.LOGS_ANALYSIS;
  }

  // Alerts patterns
  if (
    q.includes('alert') ||
    q.includes('notification') ||
    q.includes('alarm') ||
    q.includes('monitoring')
  ) {
    return INTENT_TYPES.ALERTS;
  }

  // Capacity planning patterns
  if (
    q.includes('capacity') ||
    q.includes('scaling') ||
    (q.includes('resource') && (q.includes('planning') || q.includes('allocation'))) ||
    q.includes('scale up') || q.includes('scale down')
  ) {
    return INTENT_TYPES.CAPACITY_PLANNING;
  }

  // Default to general for all other questions
  return INTENT_TYPES.GENERAL;
}

/**
 * Get confidence score for intent detection
 * @param {string} query - User query
 * @param {string} intent - Detected intent
 * @returns {number} - Confidence score (0-1)
 */
export function getIntentConfidence(query, intent) {
  const q = query.toLowerCase();
  
  const keywordCounts = {
    [INTENT_TYPES.DEPLOYMENT_READINESS]: ['deploy', 'cmr', 'ready', 'safe'].filter(k => q.includes(k)).length,
    [INTENT_TYPES.CLUSTER_HEALTH]: ['health', 'status', 'cluster', 'summary'].filter(k => q.includes(k)).length,
    [INTENT_TYPES.INCIDENTS]: ['incident', 'issue', 'problem', 'open'].filter(k => q.includes(k)).length,
    [INTENT_TYPES.PERFORMANCE_METRICS]: ['performance', 'metrics', 'cpu', 'memory'].filter(k => q.includes(k)).length,
    [INTENT_TYPES.TROUBLESHOOTING]: ['troubleshoot', 'debug', 'fix', 'error'].filter(k => q.includes(k)).length,
    [INTENT_TYPES.BEST_PRACTICES]: ['best', 'practice', 'recommended', 'should'].filter(k => q.includes(k)).length,
  };

  const matchCount = keywordCounts[intent] || 0;
  
  if (matchCount >= 2) return 0.9;
  if (matchCount === 1) return 0.7;
  return 0.5;
}

/**
 * Extract cluster name from query
 * @param {string} query - User query
 * @returns {string|null} - Cluster name or null
 */
export function extractClusterName(query) {
  if (!query) return null;
  
  const q = query.toLowerCase();
  
  // Match common cluster names
  const clusterMatch = q.match(/\b(upi|netbank|payments|core|banking|retail)\b/i);
  
  if (clusterMatch) {
    return clusterMatch[1].toUpperCase();
  }
  
  // Try to extract from patterns like "cluster X" or "X cluster"
  const patternMatch = q.match(/(?:cluster\s+)?([a-z]+)(?:\s+cluster)?/i);
  if (patternMatch) {
    const potential = patternMatch[1].toUpperCase();
    // Only return if it looks like a cluster name (3+ chars)
    if (potential.length >= 3) {
      return potential;
    }
  }
  
  return null;
}

/**
 * Extract CMR ID from query
 * @param {string} query - User query
 * @returns {string|null} - CMR ID in format "CMR-XXX" or null
 */
export function extractCMRId(query) {
  if (!query) return null;
  
  // Match patterns like: CMR-220, CMR220, cmr-220, cmr 220
  const cmrMatch = query.match(/cmr[- ]?(\d+)/i);
  
  if (cmrMatch) {
    return `CMR-${cmrMatch[1]}`;
  }
  
  return null;
}

/**
 * Extract incident ID from query
 * @param {string} query - User query
 * @returns {string|null} - Incident ID in format "INC-XXX" or null
 */
export function extractIncidentId(query) {
  if (!query) return null;
  
  // Match patterns like: INC-101, INC101, inc-101, inc 101
  const incMatch = query.match(/inc[- ]?(\d+)/i);
  
  if (incMatch) {
    return `INC-${incMatch[1]}`;
  }
  
  return null;
}

/**
 * Extract all entities from query (comprehensive)
 * @param {string} query - User query
 * @returns {object} - Object with all extracted entities
 */
export function extractEntities(query) {
  return {
    clusterName: extractClusterName(query),
    cmrId: extractCMRId(query),
    incidentId: extractIncidentId(query),
    metric: extractMetric(query),
    timeRange: extractTimeRange(query)
  };
}

/**
 * Extract metric type from query
 * @param {string} query - User query
 * @returns {string|null} - Metric type or null
 */
export function extractMetric(query) {
  if (!query) return null;
  
  const q = query.toLowerCase();
  const metrics = ['cpu', 'memory', 'disk', 'latency', 'throughput', 'response time'];
  
  for (const metric of metrics) {
    if (q.includes(metric)) {
      return metric;
    }
  }
  
  return null;
}

/**
 * Extract time range from query
 * @param {string} query - User query
 * @returns {string|null} - Time range or null
 */
export function extractTimeRange(query) {
  if (!query) return null;
  
  // Match patterns like "last 2 hours", "yesterday", "this week"
  const timePatterns = [
    /last\s+(\d+)\s+(hour|day|week|month)s?/i,
    /(today|yesterday|this\s+week|this\s+month|last\s+week|last\s+month)/i
  ];
  
  for (const pattern of timePatterns) {
    const match = query.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}
