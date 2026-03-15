'use strict';

/**
 * redisClientProxy.js
 *
 * Creates a fake ioredis-compatible client that delegates all operations
 * to the ARDM server REST API. This allows all existing Vue components
 * (which were written for the Electron/ioredis model) to work without
 * modification against the web server.
 */

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:9988'
  : window.location.origin;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.message || 'Server error');
  return json;
}

function post(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

function get(path, params = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(q ? `${path}?${q}` : path);
}

/**
 * Build an EventEmitter-like shim (subset used by ConnectionWrapper).
 */
function makeEmitter() {
  const listeners = {};
  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
      return this;
    },
    emit(event, ...args) {
      (listeners[event] || []).forEach(fn => fn(...args));
    },
    off(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    },
  };
}

/**
 * Minimal readable-stream shim used by *scanBufferStream methods.
 * Polls the server SCAN endpoint and emits data/end/error events.
 */
function makeScanStream(connectionKey, scanParams) {
  const { match = '*', count = 200, scanType, scanKey } = scanParams;

  const emitter = makeEmitter();
  let cursor = '0';
  let paused = false;
  let running = false;
  let done = false;

  async function scanPage() {
    if (done || paused) return;
    running = true;

    try {
      const params = { cursor, match, count: String(count) };
      if (scanType) params.scanType = scanType;
      // scanKey may be a Buffer — encode as latin1 string that survives the query param round-trip
      if (scanKey) params.scanKey = Buffer.isBuffer(scanKey) ? scanKey.toString('latin1') : scanKey;
      if (scanKey && Buffer.isBuffer(scanKey)) params.scanKeyEncoding = 'latin1';

      const data = await get(`/api/redis/${connectionKey}/scan`, params);
      cursor = data.cursor;

      if (data.items && data.items.length) {
        // Decode base64 → Buffer
        const buffers = data.items.map(b64 => Buffer.from(b64, 'base64'));
        emitter.emit('data', buffers);
      }

      if (cursor === '0') {
        done = true;
        running = false;
        emitter.emit('end');
        return;
      }

      running = false;
      if (!paused) scanPage();
    } catch (e) {
      running = false;
      emitter.emit('error', e);
    }
  }

  // Start scanning on next tick
  setTimeout(() => scanPage(), 0);

  return {
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
    pause() {
      paused = true;
    },
    resume() {
      if (paused) {
        paused = false;
        if (!running && !done) scanPage();
      }
    },
  };
}

/**
 * Create a server-backed Redis client proxy.
 *
 * @param {string} connectionKey  - The key returned by POST /api/redis/connect
 * @param {object} config         - The original connection config (for options.connectionName etc.)
 * @returns {object}              - ioredis-like client proxy
 */
export function createClientProxy(connectionKey, config) {
  const emitter = makeEmitter();
  let currentDb = config.db || 0;

  // Emit 'ready' asynchronously (server already connected successfully)
  setTimeout(() => emitter.emit('ready'), 0);

  function callServer(command, args = [], buffer = false) {
    return post(`/api/redis/${connectionKey}/call`, {
      command,
      // Tag Buffer args with { __buf: '<base64>' } so the server can reconstruct them
      args: args.map(a => {
        if (Buffer.isBuffer(a)) return { __buf: a.toString('base64') };
        return a;
      }),
      buffer,
    });
  }

  function decodeResult(json) {
    if (json.encoding === 'base64') {
      if (Array.isArray(json.result)) {
        return json.result.map(r => (typeof r === 'string') ? Buffer.from(r, 'base64') : r);
      }
      return Buffer.from(json.result, 'base64');
    }
    return json.result;
  }

  // Generic helper: call a command and return the result value
  function cmd(command, args = []) {
    return callServer(command, args).then(json => json.result);
  }

  // Generic buffer helper
  function cmdBuffer(command, args = []) {
    return callServer(command, args, true).then(decodeResult);
  }

  const proxy = {
    // ── Connection identity ──────────────────────────────────────────────────
    status: 'ready',
    connectionKey,
    options: {
      connectionName: config.connectionName,
      db: currentDb,
      natMap: config.natMap || undefined,
    },
    condition: {
      get select() { return currentDb; },
    },
    ardmRedisVersion: null,

    // ── EventEmitter ─────────────────────────────────────────────────────────
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),

    // ── Lifecycle ────────────────────────────────────────────────────────────
    async ping() {
      return cmd('PING');
    },
    async quit() {
      await post(`/api/redis/disconnect`, { key: connectionKey });
    },

    // ── DB selection ─────────────────────────────────────────────────────────
    async select(db) {
      const res = await post(`/api/redis/${connectionKey}/select`, { db });
      currentDb = db;
      proxy.options.db = db;
      return res;
    },

    // ── Info / Config ────────────────────────────────────────────────────────
    async info(section) {
      const data = await get(`/api/redis/${connectionKey}/info`);
      return data.info;
    },
    async config(op, ...args) {
      if (op === 'get' || op === 'GET') {
        const pattern = args[0] || '*';
        const data = await get(`/api/redis/${connectionKey}/config`, { pattern });
        if (data.disabled || data.config === null) {
          throw new Error('CONFIG command disabled on this server');
        }
        return data.config;
      }
      // CONFIG SET
      return cmd('CONFIG', [op, ...args]);
    },

    // ── Generic command passthrough ──────────────────────────────────────────
    // ioredis allows: call(cmd, arg1, arg2) or call(cmd, [arg1, arg2])
    call(command, ...rest) {
      const args = (rest.length === 1 && Array.isArray(rest[0])) ? rest[0] : rest;
      return cmd(command, args);
    },
    callBuffer(command, ...rest) {
      const args = (rest.length === 1 && Array.isArray(rest[0])) ? rest[0] : rest;
      return cmdBuffer(command, args);
    },

    // ── String ───────────────────────────────────────────────────────────────
    get(key)         { return cmd('GET', [key]); },
    getBuffer(key)   { return cmdBuffer('GET', [key]); },
    set(key, val, ...rest) { return cmd('SET', [key, val, ...rest]); },

    // ── Hash ─────────────────────────────────────────────────────────────────
    hset(key, ...args)      { return cmd('HSET', [key, ...args]); },
    hget(key, field)        { return cmd('HGET', [key, field]); },
    hgetall(key)            { return cmd('HGETALL', [key]); },
    hdel(key, ...fields)    { return cmd('HDEL', [key, ...fields]); },
    hlen(key)               { return cmd('HLEN', [key]); },
    hscanBufferStream(key, opts = {}) {
      return makeScanStream(connectionKey, {
        match: opts.match || '*',
        count: opts.count || 200,
        scanType: 'hscanBuffer',
        scanKey: key,
      });
    },

    // ── List ──────────────────────────────────────────────────────────────────
    lrange(key, start, end)      { return cmd('LRANGE', [key, start, end]); },
    lrangeBuffer(args)           { return cmdBuffer('LRANGE', args); },
    llen(key)                    { return cmd('LLEN', [key]); },
    lpush(key, ...vals)          { return cmd('LPUSH', [key, ...vals]); },
    rpush(key, ...vals)          { return cmd('RPUSH', [key, ...vals]); },
    lrem(key, count, val)        { return cmd('LREM', [key, count, val]); },

    // ── Set ───────────────────────────────────────────────────────────────────
    sadd(key, ...members)  { return cmd('SADD', [key, ...members]); },
    srem(key, ...members)  { return cmd('SREM', [key, ...members]); },
    smembers(key)          { return cmd('SMEMBERS', [key]); },
    scard(key)             { return cmd('SCARD', [key]); },
    sscanBufferStream(key, opts = {}) {
      return makeScanStream(connectionKey, {
        match: opts.match || '*',
        count: opts.count || 200,
        scanType: 'sscanBuffer',
        scanKey: key,
      });
    },

    // ── ZSet ──────────────────────────────────────────────────────────────────
    zadd(key, ...args)           { return cmd('ZADD', [key, ...args]); },
    zrem(key, ...members)        { return cmd('ZREM', [key, ...members]); },
    zrange(key, start, stop, ...rest) { return cmd('ZRANGE', [key, start, stop, ...rest]); },
    zrangeBuffer(args)           { return cmdBuffer('ZRANGE', args); },
    zrevrangeBuffer(args)        { return cmdBuffer('ZREVRANGE', args); },
    zcard(key)                   { return cmd('ZCARD', [key]); },
    zscanBufferStream(key, opts = {}) {
      return makeScanStream(connectionKey, {
        match: opts.match || '*',
        count: opts.count || 200,
        scanType: 'zscanBuffer',
        scanKey: key,
      });
    },

    // ── Stream ────────────────────────────────────────────────────────────────
    xadd(key, id, ...args)           { return cmd('XADD', [key, id, ...args]); },
    xlen(key)                        { return cmd('XLEN', [key]); },
    xrange(key, start, end, ...rest) { return cmd('XRANGE', [key, start, end, ...rest]); },
    xrevrangeBuffer(args)            { return cmdBuffer('XREVRANGE', args); },
    xdel(key, ...ids)                { return cmd('XDEL', [key, ...ids]); },

    // ── Generic key ops ───────────────────────────────────────────────────────
    del(...keys)         { return cmd('DEL', keys.flat()); },
    exists(...keys)      { return cmd('EXISTS', keys.flat()); },
    type(key)            { return cmd('TYPE', [key]); },
    rename(key, newKey)  { return cmd('RENAME', [key, newKey]); },
    expire(key, secs)    { return cmd('EXPIRE', [key, secs]); },
    persist(key)         { return cmd('PERSIST', [key]); },
    pttl(key)            { return cmd('PTTL', [key]); },
    ttl(key)             { return cmd('TTL', [key]); },
    memory(op, key)      { return cmd('MEMORY', [op, key]); },
    flushdb()            { return cmd('FLUSHDB'); },

    // ── Scan (top-level key scan) ─────────────────────────────────────────────
    scan(cursor, ...args) { return cmd('SCAN', [cursor, ...args]); },
    scanBufferStream(opts = {}) {
      return makeScanStream(connectionKey, {
        match: opts.match || '*',
        count: opts.count || 200,
      });
    },

    // ── Cluster shim ─────────────────────────────────────────────────────────
    // Non-cluster: nodes() returns [this] so cluster-aware code works as-is
    nodes(role) {
      return [proxy];
    },

    // ── Duplicate (used by CliTab for monitor/pubsub) ─────────────────────────
    duplicate() {
      return createClientProxy(connectionKey, config);
    },
  };

  return proxy;
}

/**
 * If a value looks like a blob: URL (stored by older FileInput versions),
 * fetch and return its text content. Otherwise return as-is.
 */
async function resolveBlobUrl(value) {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    const res = await fetch(value);
    return res.text();
  }
  return value;
}

/**
 * Connect to Redis via the server and return a client proxy.
 * Drop-in for the old redisClient.createConnection / createSSHConnection.
 */
export async function connectViaServer(config) {
  // Resolve any blob: URLs in sshOptions before sending to server —
  // blob URLs are browser-local and the Node server cannot fetch them.
  if (config.sshOptions) {
    const ssh = config.sshOptions;
    if (ssh.privatekey) ssh.privatekey = await resolveBlobUrl(ssh.privatekey);
  }
  // Same for SSL key/cert/ca fields
  if (config.sslOptions) {
    const ssl = config.sslOptions;
    if (ssl.key)  ssl.key  = await resolveBlobUrl(ssl.key);
    if (ssl.cert) ssl.cert = await resolveBlobUrl(ssl.cert);
    if (ssl.ca)   ssl.ca   = await resolveBlobUrl(ssl.ca);
  }

  const data = await post('/api/redis/connect', config);
  return createClientProxy(data.key, config);
}
