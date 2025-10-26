export const clusterData = [
  {
    cluster: "UPI",
    status: "healthy",
    services: [
      { name: "upi-gateway", status: "running", replicas: 5, version: "v3.2.1" },
      { name: "payment-processor", status: "running", replicas: 8, version: "v2.8.0" },
      { name: "transaction-db", status: "running", replicas: 3, version: "v5.7.0" },
      { name: "notification-service", status: "running", replicas: 4, version: "v1.5.2" },
    ],
    incidents: [
      {
        id: "INC-101",
        title: "High latency in payment processing",
        severity: "medium",
        status: "resolved",
        createdAt: "2025-10-20T10:30:00Z",
        resolvedAt: "2025-10-20T14:45:00Z",
      },
      {
        id: "INC-102",
        title: "Database connection pool exhaustion",
        severity: "high",
        status: "resolved",
        createdAt: "2025-10-22T08:15:00Z",
        resolvedAt: "2025-10-22T11:20:00Z",
      },
    ],
    cmrs: [
      {
        id: "CMR-220",
        description: "Deploy new payment gateway optimization",
        status: "approved",
        linkedIncidents: [],
        linkedPTs: ["PT-501"],
      },
      {
        id: "CMR-221",
        description: "Update transaction database schema",
        status: "pending",
        linkedIncidents: ["INC-102"],
        linkedPTs: [],
      },
    ],
    pts: [
      {
        id: "PT-501",
        title: "Optimize payment processing queries",
        status: "resolved",
        severity: "low",
        resolvedAt: "2025-10-23T16:00:00Z",
      },
    ],
    metrics: {
      cpu: 45,
      memory: 62,
      disk: 58,
      latency: 120,
    },
    lastUpdated: "2025-10-25T12:00:00Z",
  },
  {
    cluster: "NETBANK",
    status: "degraded",
    services: [
      { name: "web-frontend", status: "running", replicas: 10, version: "v4.1.0" },
      { name: "api-gateway", status: "degraded", replicas: 6, version: "v3.5.2" },
      { name: "auth-service", status: "running", replicas: 4, version: "v2.9.1" },
      { name: "account-service", status: "running", replicas: 5, version: "v3.2.0" },
    ],
    incidents: [
      {
        id: "INC-201",
        title: "API gateway intermittent 503 errors",
        severity: "critical",
        status: "open",
        createdAt: "2025-10-25T09:00:00Z",
        resolvedAt: null,
      },
      {
        id: "INC-202",
        title: "Authentication service slow response",
        severity: "medium",
        status: "investigating",
        createdAt: "2025-10-25T10:30:00Z",
        resolvedAt: null,
      },
    ],
    cmrs: [
      {
        id: "CMR-310",
        description: "Deploy new API rate limiting",
        status: "blocked",
        linkedIncidents: ["INC-201"],
        linkedPTs: ["PT-601"],
      },
      {
        id: "CMR-311",
        description: "Update authentication flow",
        status: "approved",
        linkedIncidents: [],
        linkedPTs: [],
      },
    ],
    pts: [
      {
        id: "PT-601",
        title: "Investigate API gateway memory leak",
        status: "open",
        severity: "high",
        resolvedAt: null,
      },
    ],
    metrics: {
      cpu: 82,
      memory: 88,
      disk: 71,
      latency: 450,
    },
    lastUpdated: "2025-10-25T11:45:00Z",
  },
];
