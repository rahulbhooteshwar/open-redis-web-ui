'use strict';

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DATA_PATH = path.join(dataDir, 'connections.json');

// Ensure data directory exists at startup
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getConnections() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function setConnections(obj) {
  writeFileAtomic.sync(DATA_PATH, JSON.stringify(obj, null, 2));
}

module.exports = { getConnections, setConnections };
