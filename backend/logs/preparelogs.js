import fs from 'fs';
import path from 'path';

// Read logs from your existing location
const filePath = path.resolve("dummy-logs.json");
const logs = JSON.parse(fs.readFileSync(filePath, "utf-8"));

// Set the index name
const indexName = 'dummy-logs';

// Transform logs for OpenSearch Bulk API
const lines = logs.map(entry =>
  `{ "index": { "_index": "${indexName}" } }\n${JSON.stringify(entry)}`
);

// Write NDJSON bulk file
fs.writeFileSync('bulk_logs.json', lines.join('\n') + '\n');

