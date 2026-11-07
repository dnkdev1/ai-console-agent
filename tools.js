// Tools the AI can decide to use. Each tool has:
//   name, description, parameters - tell the AI what the tool does
//   run(args)                     - does the work and returns a result

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_DIR = __dirname;

const gray = (s) => `\x1b[90m${s}\x1b[0m`;

// Throws if a path is outside the given folder, or points at secrets or git internals.
function checkInside(folder, fullPath, filePath) {
  const relative = path.relative(folder, fullPath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path must be a file inside the project folder');
  }

  // Windows ignores letter case and trailing dots or spaces, and ":" opens a
  // hidden part of a file, so ".ENV", ".env." and ".env:x" must count as ".env".
  for (const part of relative.split(path.sep)) {
    const name = part.toLowerCase().split(':')[0].replace(/[. ]+$/, '');
    if (name.startsWith('.env') || name === '.git') {
      throw new Error(`Access to "${filePath}" is not allowed`);
    }
  }
}

// Turns a path from the AI into a full path, or throws if it isn't allowed.
function safePath(filePath) {
  const fullPath = path.resolve(PROJECT_DIR, filePath);
  checkInside(PROJECT_DIR, fullPath, filePath);

  // A linked folder can lead somewhere else, so also check where the path
  // really goes. A new file doesn't exist yet, so check its nearest parent.
  let existing = fullPath;
  while (!fs.existsSync(existing)) {
    existing = path.dirname(existing);
  }
  const realProject = fs.realpathSync(PROJECT_DIR);
  const realPath = fs.realpathSync(existing);
  if (realPath !== realProject) {
    checkInside(realProject, realPath, filePath);
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
    name: 'append_file',
    description:
      'Add text to the very end of an existing file in the project folder. ' +
      'The existing content is kept. Fails if the file does not exist.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project folder' },
        content: { type: 'string', description: 'Text to add to the end of the file' },
      },
      required: ['path', 'content'],
    },
    run({ path: filePath, content }) {
      console.log(gray(`  ⚙ append_file ${filePath}`));
      const fullPath = safePath(filePath);
      const existing = fs.readFileSync(fullPath, 'utf8'); // throws if the file is missing

      // Start on a new line, so the text doesn't join the file's last line.
      const needsNewLine = existing.length > 0 && !existing.endsWith('\n');
      fs.appendFileSync(fullPath, (needsNewLine ? '\n' : '') + content);
      return { appended: filePath };
    },
  },
  {
    name: 'edit_file',
    description:
      'Change an existing file in the project folder by replacing old_text with new_text. ' +
      'old_text must appear exactly once in the file, so include enough surrounding text ' +
      'to make it unique. Use an empty new_text to delete old_text.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project folder' },
        old_text: { type: 'string', description: 'The exact text to replace' },
        new_text: { type: 'string', description: 'The text to put in its place' },
      },
      required: ['path', 'old_text', 'new_text'],
    },
    run({ path: filePath, old_text: oldText, new_text: newText }) {
      console.log(gray(`  ⚙ edit_file ${filePath}`));
      const fullPath = safePath(filePath);
      const existing = fs.readFileSync(fullPath, 'utf8'); // throws if the file is missing

      if (!oldText) {
        throw new Error('old_text must not be empty');
      }

      // Match the file's line endings, so multi-line text works on Windows files.
      const lineEnding = existing.includes('\r\n') ? '\r\n' : '\n';
      const withFileEndings = (text) => text.replace(/\r?\n/g, lineEnding);

      const pieces = existing.split(withFileEndings(oldText));
      if (pieces.length === 1) {
        throw new Error('old_text was not found in the file');
      }
      if (pieces.length > 2) {
        throw new Error(`old_text appears ${pieces.length - 1} times; it must appear exactly once`);
      }

      fs.writeFileSync(fullPath, pieces.join(withFileEndings(newText)));
      return { edited: filePath };
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
