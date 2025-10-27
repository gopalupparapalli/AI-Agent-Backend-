import dotenv from "dotenv";
dotenv.config();

export const env = {
  region: process.env.AWS_REGION || "us-east-1",
  opensearchEndpoint: process.env.MY_OPENSEARCH_ENDPOINT || process.env.OPENSEARCH_ENDPOINT,
  opensearchUser: process.env.MY_OPENSEARCH_USER || process.env.OPENSEARCH_USER,
  opensearchPass: process.env.MY_OPENSEARCH_PASS || process.env.OPENSEARCH_PASS,
  logIndex: process.env.MY_OPENSEARCH_LOG_INDEX || "dummy-logs",
  awsKey: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  awsSecret: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  bedrockModel: process.env.BEDROCK_MODEL_ID || "openai.gpt-oss-120b-1:0",
};

export const OPENSEARCH_ENDPOINT = env.opensearchEndpoint
  ? env.opensearchEndpoint.startsWith("http")
    ? env.opensearchEndpoint.replace(/\/+$/, "")
    : `https://${env.opensearchEndpoint.replace(/\/+$/, "")}`
  : null;
