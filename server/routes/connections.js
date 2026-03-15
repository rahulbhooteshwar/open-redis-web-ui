'use strict';

const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');

function randomString(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function buildKey() {
  return `${Date.now()}_${randomString(5)}`;
}

// GET /api/connections — return array sorted by order
router.get('/', (req, res) => {
  try {
    const connections = storage.getConnections();
    const list = Object.values(connections).sort((a, b) => {
      if (!isNaN(a.order) && !isNaN(b.order)) {
        return parseInt(a.order) - parseInt(b.order);
      }
      if (a.key && b.key) return a.key < b.key ? -1 : 1;
      return a.key ? 1 : (b.key ? -1 : 0);
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/connections — add new connection
router.post('/', (req, res) => {
  try {
    const connection = req.body;
    if (!connection || !connection.host) {
      return res.status(400).json({ error: true, message: 'host is required' });
    }

    const connections = storage.getConnections();
    const key = buildKey();
    connection.key = key;

    if (isNaN(connection.order)) {
      const maxOrder = Math.max(0, ...Object.values(connections).map(c => (!isNaN(c.order) ? c.order : 0)));
      connection.order = maxOrder + 1;
    }

    connections[key] = connection;
    storage.setConnections(connections);
    res.status(201).json(connection);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// PUT /api/connections/:key — update connection
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const connections = storage.getConnections();

    if (!connections[key]) {
      return res.status(404).json({ error: true, message: 'Connection not found' });
    }

    Object.assign(connections[key], req.body);
    storage.setConnections(connections);
    res.json(connections[key]);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// DELETE /api/connections/:key — delete connection
router.delete('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const connections = storage.getConnections();

    if (!connections[key]) {
      return res.status(404).json({ error: true, message: 'Connection not found' });
    }

    delete connections[key];
    storage.setConnections(connections);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/connections/reorder — reorder connections
router.post('/reorder', (req, res) => {
  try {
    const list = req.body; // array of connection objects in new order
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: true, message: 'body must be an array' });
    }

    const newConnections = {};
    list.forEach((connection, index) => {
      connection.order = index;
      const key = connection.key || buildKey();
      connection.key = key;
      newConnections[key] = connection;
    });

    storage.setConnections(newConnections);
    res.json(newConnections);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

module.exports = router;
