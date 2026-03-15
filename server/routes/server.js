'use strict';

const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');

// GET /api/server/:key/slowlog?count=128
router.get('/:key/slowlog', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const count = parseInt(req.query.count) || 128;
    const log = await client.call('slowlog', 'get', count);
    res.json({ log });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/server/:key/clients
router.get('/:key/clients', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const list = await client.call('client', 'list');
    res.json({ list });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

module.exports = router;
