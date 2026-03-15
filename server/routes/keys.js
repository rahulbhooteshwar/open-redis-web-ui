'use strict';

const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');

// GET /api/keys/:key/scan?cursor=0&match=*&count=200&db=0
router.get('/:key/scan', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const cursor = req.query.cursor || '0';
    const match = req.query.match || '*';
    const count = parseInt(req.query.count) || 200;

    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', count);
    res.json({ cursor: nextCursor, keys });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/keys/:key/get?keyName=foo&type=string
router.get('/:key/get', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName, type } = req.query;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    let value;
    const resolvedType = type || await client.type(keyName);

    switch (resolvedType) {
      case 'string':
        value = await client.get(keyName);
        break;
      case 'list':
        value = await client.lrange(keyName, 0, -1);
        break;
      case 'set':
        value = await client.smembers(keyName);
        break;
      case 'zset':
        value = await client.zrange(keyName, 0, -1, 'WITHSCORES');
        break;
      case 'hash':
        value = await client.hgetall(keyName);
        break;
      case 'stream':
        value = await client.xrange(keyName, '-', '+');
        break;
      default:
        return res.status(400).json({ error: true, message: `Unsupported type: ${resolvedType}` });
    }

    res.json({ type: resolvedType, value });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/keys/:key/set — type-aware set
router.post('/:key/set', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName, type, value, ttl } = req.body;

    if (!keyName || !type) return res.status(400).json({ error: true, message: 'keyName and type required' });

    switch (type) {
      case 'string':
        await client.set(keyName, value);
        break;
      case 'list':
        await client.del(keyName);
        if (Array.isArray(value) && value.length) await client.rpush(keyName, ...value);
        break;
      case 'set':
        await client.del(keyName);
        if (Array.isArray(value) && value.length) await client.sadd(keyName, ...value);
        break;
      case 'zset': {
        await client.del(keyName);
        if (Array.isArray(value) && value.length) {
          const args = [];
          for (const item of value) {
            args.push(item.score, item.member);
          }
          await client.zadd(keyName, ...args);
        }
        break;
      }
      case 'hash':
        await client.del(keyName);
        if (Array.isArray(value) && value.length) {
          const args = [];
          for (const [field, val] of value) {
            args.push(field, val);
          }
          await client.hset(keyName, ...args);
        }
        break;
      default:
        return res.status(400).json({ error: true, message: `Unsupported type: ${type}` });
    }

    if (ttl && ttl > 0) await client.expire(keyName, ttl);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// DELETE /api/keys/:key/delete?keyName=foo
router.delete('/:key/delete', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName } = req.query;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    await client.del(keyName);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/keys/:key/rename
router.post('/:key/rename', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName, newKeyName } = req.body;

    if (!keyName || !newKeyName) return res.status(400).json({ error: true, message: 'keyName and newKeyName required' });

    await client.rename(keyName, newKeyName);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/keys/:key/ttl?keyName=foo
router.get('/:key/ttl', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName } = req.query;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    const [ttl, pttl] = await Promise.all([client.ttl(keyName), client.pttl(keyName)]);
    res.json({ ttl, pttl });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/keys/:key/expire
router.post('/:key/expire', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName, ttl } = req.body;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    if (ttl === -1 || ttl === null || ttl === undefined) {
      await client.persist(keyName);
    } else {
      await client.expire(keyName, ttl);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/keys/:key/type?keyName=foo
router.get('/:key/type', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName } = req.query;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    const type = await client.type(keyName);
    res.json({ type });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/keys/:key/memory?keyName=foo
router.get('/:key/memory', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { keyName } = req.query;

    if (!keyName) return res.status(400).json({ error: true, message: 'keyName required' });

    const usage = await client.memory('usage', keyName);
    res.json({ usage });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

module.exports = router;
