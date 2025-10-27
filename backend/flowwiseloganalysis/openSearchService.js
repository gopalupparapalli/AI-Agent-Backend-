import { logEvent } from "./logger.js";
import { env, OPENSEARCH_ENDPOINT } from "./encConfig.js";

export const fetchLogsFromOpenSearch = async (flow, range) => {
  if (!OPENSEARCH_ENDPOINT) throw new Error("OpenSearch endpoint missing in environment");

  const url = `${OPENSEARCH_ENDPOINT}/${env.logIndex}/_search`;
  logEvent("info", "Preparing OpenSearch query", { flow, range, url });

  const body = {
    query: {
      bool: {
        must: [
          { match: { server: flow } },
          { range: { "@timestamp": { gte: `now-${range}h/h`, lte: "now/h" } } },
        ],
      },
    },
  };

  logEvent("info", "Using Basic Auth for OpenSearch", { user: env.opensearchUser });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${env.opensearchUser}:${env.opensearchPass}`).toString("base64"),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    logEvent("error", "OpenSearch request failed", { status: response.status, text });
    throw new Error(`OpenSearch error ${response.status}: ${text}`);
  }

  const json = JSON.parse(text);
  const hits = json.hits?.hits?.map((h) => h._source) || [];
  logEvent("info", "Fetched logs from OpenSearch", { total: hits.length });
  return hits;
};
