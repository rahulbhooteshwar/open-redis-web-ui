'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// POST /api/formatter/exec
// body: { command: string, content: string }
router.post('/exec', (req, res) => {
  const { command, content } = req.body;

  if (!command) {
    return res.status(400).json({ error: true, message: 'command is required' });
  }

  const tmpFile = path.join(os.tmpdir(), `ardm_fmt_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);

  try {
    fs.writeFileSync(tmpFile, content || '');
  } catch (e) {
    return res.status(500).json({ error: true, message: `Failed to write temp file: ${e.message}` });
  }

  // Replace {file} placeholder with actual path, or append path if no placeholder
  const cmd = command.includes('{file}')
    ? command.replace('{file}', tmpFile)
    : `${command} ${tmpFile}`;

  exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
    fs.unlink(tmpFile, () => {}); // cleanup regardless

    if (err) {
      return res.status(500).json({ error: true, message: stderr || err.message });
    }

    res.json({ output: stdout });
  });
});

module.exports = router;
