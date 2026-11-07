// Small adapter around Google AI (Gemini API, free tier).
// Input: the whole conversation. Output: the AI's next answer as text.
// Usage:  const answer = await askAI([{ role: 'user', text: 'Hello!' }]);

const fs = require('node:fs');
const path = require('node:path');

// Load settings from the .env file next to this file, if there is one.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function askAI(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // fetch is built into Node 18+, so no extra packages are needed.
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      // Google calls the AI's role "model".
      contents: messages.map((message) => ({
        role: message.role === 'ai' ? 'model' : 'user',
        parts: [{ text: message.text }],
      })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google AI error (${response.status}): ${data.error?.message}`);
  }

  const candidate = data.candidates?.[0];
  const answer = (candidate?.content?.parts ?? [])
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

module.exports = { askAI };
