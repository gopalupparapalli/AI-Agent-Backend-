import incidents from "../data/incidents.js";
import tickets from "../data/tickets.js";

export function isWithinLast7Days(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export function getFilteredIncidents(cluster) {
  return incidents
    .filter(
      (i) =>
        ["Sev-1", "Sev-2"].includes(i.severity) &&
        isWithinLast7Days(i.createdAt) &&
        (!cluster || i.cluster === cluster)
    )
    .map((i) => ({
      ticketId: i.ticketId,
      severity: i.severity,
      description: i.description,
      impact: i.impact,
      cluster: i.cluster,
      mitigation: i.mitigation,
      createdAt: i.createdAt,
      rootCause: i.rootCause,
      resolvedAt: i.resolvedAt || undefined,
    }));
}

export function getFilteredTickets(cluster) {
  return tickets
    .filter(
      (t) =>
        t.priority === "P1" &&
        (isWithinLast7Days(t.createdAt) || (t.status === "Open" && t.ageInDays > 7)) &&
        (!cluster || t.cluster === cluster)
    )
    .map((t) => ({
      cluster: t.cluster,
      priority: t.priority,
      requestType: t.requestType,
      description: t.description,
      rootCause: t.rootCause,
      dueDate: t.dueDate,
      mitigation: t.mitigation,
      createdAt: t.createdAt,
      status: t.status,
      ageInDays: t.ageInDays,
    }));
}
