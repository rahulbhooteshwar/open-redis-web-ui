'use strict';

const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');

// POST /api/redis/connect
router.post('/connect', async (req, res) => {
  try {
    const key = await redisService.connect(req.body);
    res.json({ key });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/redis/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { key } = req.body;
    await redisService.disconnect(key);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/redis/disconnect-all — called via sendBeacon on page unload
// to ensure all server-side Redis connections are closed when the browser
// tab closes or the page is refreshed.
router.post('/disconnect-all', async (req, res) => {
  try {
    await redisService.disconnectAll();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/redis/test — connect, ping, disconnect
router.post('/test', async (req, res) => {
  let key;
  try {
    key = await redisService.connect(req.body);
    const client = redisService.getClient(key);
    await client.ping();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: true, success: false, message: e.message });
  } finally {
    if (key) await redisService.disconnect(key).catch(() => {});
  }
});

// GET /api/redis/:key/info
router.get('/:key/info', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const info = await client.info();
    res.json({ info });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/redis/:key/config?pattern=*
router.get('/:key/config', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const pattern = req.query.pattern || '*';
    const config = await client.config('get', pattern);
    res.json({ config });
  } catch (e) {
    // CONFIG may be disabled/renamed on managed Redis — return null so the
    // client-side .catch() fallback (default 16 DBs) can handle it cleanly.
    if (e.message && e.message.includes('unknown command')) {
      return res.json({ config: null, disabled: true });
    }
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/redis/:key/dbs
router.get('/:key/dbs', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const [dbconfig, keyspace] = await Promise.all([
      client.config('get', 'databases'),
      client.info('keyspace'),
    ]);
    res.json({ dbconfig, keyspace });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /api/redis/:key/select
router.post('/:key/select', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { db } = req.body;
    await client.select(db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Decode args from the proxy: { __buf: '<base64>' } → Buffer, everything else unchanged
function decodeArgs(args) {
  return (Array.isArray(args) ? args : []).map(a => {
    if (a && typeof a === 'object' && a.__buf !== undefined) {
      return Buffer.from(a.__buf, 'base64');
    }
    return a;
  });
}

// POST /api/redis/:key/call — generic command execution
// Body: { command: 'GET', args: ['mykey'], buffer: false }
router.post('/:key/call', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { command, args = [], buffer = false } = req.body;

    if (!command) return res.status(400).json({ error: true, message: 'command required' });

    // Decode tagged Buffer args, then spread for ioredis
    const cmdArgs = decodeArgs(args);

    let result;
    if (buffer) {
      result = await client.callBuffer(command, ...cmdArgs);
      // Serialize Buffer as base64 so it survives JSON transport
      function encodeVal(v) {
        return Buffer.isBuffer(v) ? v.toString('base64') : v;
      }
      const encoded = Array.isArray(result) ? result.map(encodeVal) : encodeVal(result);
      return res.json({ result: encoded, encoding: 'base64' });
    } else {
      result = await client.call(command, ...cmdArgs);
    }

    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// GET /api/redis/:key/scan — paginated SCAN used by the proxy scanBufferStream
// Query: cursor, match, count, type (hscan/sscan/zscan), scanKey
router.get('/:key/scan', async (req, res) => {
  try {
    const client = redisService.getClient(req.params.key);
    const { cursor = '0', match = '*', count = '200', scanType, scanKey, scanKeyEncoding } = req.query;

    let nextCursor, items;

    if (scanType && scanKey) {
      // scanKey may have been latin1-encoded by the proxy if it was a Buffer
      const resolvedKey = scanKeyEncoding === 'latin1'
        ? Buffer.from(scanKey, 'latin1')
        : scanKey;

      // e.g. HSCAN / SSCAN / ZSCAN
      [nextCursor, items] = await client[scanType](
        resolvedKey, cursor, 'MATCH', match, 'COUNT', parseInt(count),
      );
    } else {
      // top-level SCAN
      [nextCursor, items] = await client.scan(cursor, 'MATCH', match, 'COUNT', parseInt(count));
    }

    // Encode items as base64 so Buffer keys survive JSON
    const encoded = items.map(i => Buffer.isBuffer(i) ? i.toString('base64') : Buffer.from(String(i)).toString('base64'));
    // nextCursor may be a Buffer for *Buffer scan variants — always stringify it
    const cursorStr = Buffer.isBuffer(nextCursor) ? nextCursor.toString() : String(nextCursor);
    res.json({ cursor: cursorStr, items: encoded });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

module.exports = router;
