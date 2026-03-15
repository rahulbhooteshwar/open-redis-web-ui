'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');

/*
  System utilities that replace Electron internal APIs
*/

// GET /api/system/main-args
// Returns argv from CLI (mirrors Electron's 'getMainArgs')
router.get('/main-args', (req, res) => {
  // Optional query param to inject argv from env for debugging
  let argv = process.env.CLI_ARGS_ARRAY && JSON.parse(process.env.CLI_ARGS_ARRAY);
  if (!argv) {
    argv = process.argv.slice(2);
  }
  res.json({ argv });
});

// GET /api/system/temp-path
router.get('/temp-path', (req, res) => {
  res.json({ path: os.tmpdir() });
});

// GET /api/system/fonts
// List all system fonts on Linux/Mac/Windows
router.get('/fonts', (req, res) => {
  try {
    // Use font-list lib if available in deps
    if (require.resolve('font-list')) {
      const fontList = require('font-list');
      fontList.getFonts({ disableQuoting: true }).then(fonts => {
        // filter duplicates and sort
        const uniq = [...new Set(fonts)].sort();
        res.json(uniq);
      }).catch(() => {
        res.json([]);
      });
      return;
    }
  } catch (e) {
    // font-list not installed --> return empty list for now
  }
  res.json([]);
});

module.exports = router;