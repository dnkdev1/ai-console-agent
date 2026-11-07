// Tools the AI can decide to use. Each tool has:
//   name, description, parameters - tell the AI what the tool does
//   run(args)                     - does the work and returns a result

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_DIR = __dirname;

const gray = (s) => `\x1b[90m${s}\x1b[0m`;

// Turns a path from the AI into a full path, or throws if it isn't allowed.
function safePath(filePath) {
  const fullPath = path.resolve(PROJECT_DIR, filePath);
  const relative = path.relative(PROJECT_DIR, fullPath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path must be a file inside the project folder');
  }

  // Keep secrets and git internals away from the AI. Windows ignores letter
  // case and trailing dots or spaces, and ":" opens a hidden part of a file,
  // so ".ENV", ".env." and ".env:x" must count as ".env" too.
  for (const part of relative.split(path.sep)) {
    const name = part.toLowerCase().split(':')[0].replace(/[. ]+$/, '');
    if (name.startsWith('.env') || name === '.git') {
      throw new Error(`Access to "${filePath}" is not allowed`);
    }
  }

  return fullPath;
}

const tools = [
  {
    name: 'create_file',
    description:
      'Create a new text file in the project folder. Fails if the file already exists.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project folder' },
        content: { type: 'string', description: 'Text to write into the file' },
      },
      required: ['path', 'content'],
    },
    run({ path: filePath, content }) {
      console.log(gray(`  ⚙ create_file ${filePath}`));
      const fullPath = safePath(filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, { flag: 'wx' }); // 'wx' = never overwrite
      return { created: filePath };
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the project folder and return its content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project folder' },
      },
      required: ['path'],
    },
    run({ path: filePath }) {
      console.log(gray(`  ⚙ read_file ${filePath}`));
      return { content: fs.readFileSync(safePath(filePath), 'utf8') };
    },
  },
];

module.exports = { tools };
