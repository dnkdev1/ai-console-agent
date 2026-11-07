// Keeps the messages of one chat session and saves them to disk.
// Each session gets its own file: memory/<date-and-time>.json
//
// Usage:  const memory = createMemory();
//         memory.add('user', 'Hello!');
//         memory.all();  // [{ role: 'user', text: 'Hello!' }]

const fs = require('node:fs');
const path = require('node:path');

const MEMORY_DIR = path.join(__dirname, 'memory');

function createMemory() {
  // Windows does not allow ":" in file names, so replace it.
  const fileName = new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  const filePath = path.join(MEMORY_DIR, fileName);
  const messages = [];

  return {
    all() {
      return [...messages];
    },

    // Saves after every message, so nothing is lost if the app is closed.
    // role is 'user' or 'ai'.
    add(role, text) {
      messages.push({ role, text });
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    },
  };
}

module.exports = { createMemory };
