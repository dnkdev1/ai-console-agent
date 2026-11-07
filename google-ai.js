// Small adapter around Google AI (Gemini API, free tier).
// Input: the whole conversation, and optionally tools the AI may use.
// Output: the AI's next answer as text.
// Usage:  const answer = await askAI([{ role: 'user', text: 'Hello!' }], tools);

const fs = require('node:fs');
const path = require('node:path');

// Load settings from the .env file next to this file, if there is one.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Stops the AI from calling tools forever on one message.
const MAX_TOOL_ROUNDS = 10;

async function sendToGoogle(contents, tools) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const functionDeclarations = tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));

  // fetch is built into Node 18+, so no extra packages are needed.
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents,
      ...(tools.length > 0 && { tools: [{ functionDeclarations }] }),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google AI error (${response.status}): ${data.error?.message}`);
  }

  return data;
}

// Runs one tool. A failure goes back to the AI as a result, so it can react.
function runTool(call, tools) {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { error: `Unknown tool: ${call.name}` };
  }

  try {
    return tool.run(call.args ?? {});
  } catch (error) {
    return { error: error.message };
  }
}

async function askAI(messages, tools = []) {
  // Google calls the AI's role "model".
  const contents = messages.map((message) => ({
    role: message.role === 'ai' ? 'model' : 'user',
    parts: [{ text: message.text }],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await sendToGoogle(contents, tools);
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls = parts.filter((part) => part.functionCall);

    // No tool calls means this is the final answer.
    if (calls.length === 0) {
      const answer = parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join('');

      // No text usually means the prompt or the answer was blocked.
      if (!answer) {
        const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'unknown reason';
        throw new Error(`Google AI returned no text (${reason})`);
      }

      return answer;
    }

    // Send the AI's own message back unchanged, followed by the tool results.
    contents.push(candidate.content);
    contents.push({
      role: 'user',
      parts: calls.map(({ functionCall }) => ({
        functionResponse: {
          ...(functionCall.id && { id: functionCall.id }),
          name: functionCall.name,
          response: runTool(functionCall, tools),
        },
      })),
    });
  }

  throw new Error(`AI used tools more than ${MAX_TOOL_ROUNDS} times without answering`);
}

module.exports = { askAI };
