import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Call OpenAI model via AWS Bedrock
 * @param {string} prompt - The prompt to send
 * @param {object} options - Options like maxTokens, temperature, systemPrompt
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function callBedrock(prompt, options = {}) {
  try {
    const {
      maxTokens = 800,
      temperature = 0.3,
      systemPrompt = null
    } = options;

    console.log("🤖 Calling Bedrock OpenAI model...");
    
    // Build messages array
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    
    messages.push({ role: "user", content: prompt });

    const command = new InvokeModelCommand({
      modelId: "openai.gpt-oss-120b-1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        model: "openai.gpt-oss-120b-1:0",
        messages,
        max_completion_tokens: maxTokens,
        temperature,
      }),
    });

    const response = await bedrockClient.send(command);
    const rawText = new TextDecoder().decode(response.body);
    
    console.log("📥 Raw AI Response received");

    // Parse the response - OpenAI format
    const parsedResponse = JSON.parse(rawText);
    
    // Extract the content from OpenAI response structure
    const content = parsedResponse.choices?.[0]?.message?.content || rawText;
    
    console.log("📝 Extracted content:", content.substring(0, 200) + "...");
    
    // Try to extract JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonResult = JSON.parse(jsonMatch[0]);
      console.log("✅ Successfully parsed JSON response");
      return jsonResult;
    }

    throw new Error("No valid JSON found in AI response");
  } catch (err) {
    console.error("❌ AI call failed:", err.message);
    return null;
  }
}

/**
 * Call Bedrock with explicit system and user messages
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User query
 * @param {number} maxTokens - Max tokens
 * @returns {Promise<object>} - AI response
 */
export async function callBedrockWithSystem(systemPrompt, userPrompt, maxTokens = 800) {
  return callBedrock(userPrompt, {
    maxTokens,
    systemPrompt,
    temperature: 0.3
  });
}
