const readline = require('node:readline');
const { askAI } = require('./google-ai');

// ANSI escape codes: special text the terminal understands as "change color".
const orange = (s) => `\x1b[38;2;215;119;87m${s}\x1b[0m`;
const gray = (s) => `\x1b[90m${s}\x1b[0m`;

// readline reads what the user types, one line at a time.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
});

// Welcome banner
console.log(orange('╭──────────────────────────────╮'));
console.log(orange('│ ✻ Welcome to AI Chat!        │'));
console.log(orange('╰──────────────────────────────╯'));
console.log(gray('  Type a message, or /exit to quit\n'));

rl.prompt(); // shows "> " and waits for input

// This runs every time the user presses Enter.
rl.on('line', async (line) => {
  const text = line.trim();

  if (text === '/exit') {
    rl.close();
    return;
  }

  if (text) {
    // Move the cursor one line up (\x1b[1A), clear that line (\x1b[2K),
    // and print the user's message again in gray, like Claude Code does.
    process.stdout.write('\x1b[1A\x1b[2K');
    console.log(gray('> ' + text) + '\n');

    // Send the message to the AI and wait for the answer.
    try {
      const answer = await askAI(text);
      console.log('● ' + answer + '\n');
    } catch (error) {
      console.log(orange('● Error: ' + error.message) + '\n');
    }
  }

  rl.prompt(); // ask for the next message
});

// Runs on /exit or Ctrl+C.
rl.on('close', () => {
  console.log(gray('Bye!'));
  process.exit(0);
});
