'use strict';

const Redis = require('ioredis');
const fs = require('fs');
const sshService = require('./sshService');

// Detect whether we're running inside a Docker container.
// /.dockerenv is present on all Docker containers (including Alpine/cgroups v2).
const IS_DOCKER = (() => {
  if (process.env.DOCKER_CONTAINER === '1') return true;
  try { fs.accessSync('/.dockerenv'); return true; } catch (_) { return false; }
})();

// When running in Docker, localhost/127.0.0.1 resolves to the container itself.
// Rewrite to host.docker.internal so ioredis reaches the host machine.
function resolveHost(host) {
  if (IS_DOCKER && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    return 'host.docker.internal';
  }
  return host;
}

// Fix ioredis hgetall: return [[key, val], ...] instead of flat array
Redis.Command.setReplyTransformer('hgetall', (result) => {
  const arr = [];
  for (let i = 0; i < result.length; i += 2) {
    arr.push([result[i], result[i + 1]]);
  }
  return arr;
});

// Connection pool: Map<connectionKey, ioredisClient>
const pool = new Map();

const redisService = {
  getFileContent(file) {
    if (!file) return undefined;
    return file;
  },

  retryStrategy(times) {
    const maxRetryTimes = 3;
    if (times >= maxRetryTimes) {
      console.error('Too many reconnect attempts. Check server status.');
      return false;
    }
    return Math.min(times * 200, 1000);
  },

  getTLSOptions(options) {
    return {
      ca: this.getFileContent(options.ca),
      key: this.getFileContent(options.key),
      cert: this.getFileContent(options.cert),
      servername: options.servername || undefined,
      checkServerIdentity: () => undefined,
      rejectUnauthorized: false,
    };
  },

  getRedisOptions(host, port, auth, config) {
    return {
      host,
      port,
      family: 0,
      connectTimeout: 30000,
      retryStrategy: (times) => this.retryStrategy(times),
      enableReadyCheck: false,
      connectionName: config.connectionName ? config.connectionName : null,
      password: auth,
      db: config.db ? config.db : undefined,
      username: config.username ? config.username : undefined,
      tls: config.sslOptions ? this.getTLSOptions(config.sslOptions) : undefined,
      connectionReadOnly: config.connectionReadOnly ? true : undefined,
      stringNumbers: true,
    };
  },

  getSentinelOptions(host, port, auth, config) {
    return {
      sentinels: [{ host, port }],
      sentinelPassword: auth,
      password: config.sentinelOptions.nodePassword,
      name: config.sentinelOptions.masterName,
      connectTimeout: 30000,
      retryStrategy: (times) => this.retryStrategy(times),
      enableReadyCheck: false,
      connectionName: config.connectionName ? config.connectionName : null,
      db: config.db ? config.db : undefined,
      username: config.username ? config.username : undefined,
      tls: config.sslOptions ? this.getTLSOptions(config.sslOptions) : undefined,
    };
  },

  getClusterOptions(redisOptions, natMap = {}) {
    return {
      connectionName: redisOptions.connectionName,
      enableReadyCheck: false,
      slotsRefreshTimeout: 30000,
      redisOptions,
      natMap,
    };
  },

  createConnection(host, port, auth, config, promise = true, forceStandalone = false, removeDb = false) {
    const options = this.getRedisOptions(host, port, auth, config);
    let client = null;

    if (removeDb) delete options.db;

    if (forceStandalone) {
      client = new Redis(options);
    } else if (config.sentinelOptions) {
      const sentinelOptions = this.getSentinelOptions(host, port, auth, config);
      client = new Redis(sentinelOptions);
    } else if (config.cluster) {
      const clusterOptions = this.getClusterOptions(options, config.natMap || {});
      client = new Redis.Cluster([{ port, host }], clusterOptions);
    } else {
      client = new Redis(options);
    }

    if (promise) {
      // Wait for the client to be fully connected before resolving.
      // Without this, the caller (connect) returns the key while ioredis is
      // still doing TCP handshake/AUTH/SELECT — causing the first SCAN
      // request from the proxy to hang until the connection is established,
      // which manifests as the key list staying in loading state on first open.
      return new Promise((resolve, reject) => {
        client.once('ready', () => resolve(client));
        client.once('error', (err) => {
          client.disconnect();
          reject(err);
        });
      });
    }
    return client;
  },

  // Build a stable, deterministic key from the connection config so that
  // reconnecting the same logical connection reuses the same pool slot.
  buildKey(connectionConfig) {
    const host = connectionConfig.host || '127.0.0.1';
    const port = connectionConfig.port || 6379;
    const db   = connectionConfig.db   || 0;
    const name = connectionConfig.connectionName || connectionConfig.name || '';
    return `${host}:${port}:${db}:${name}`;
  },

  async connect(connectionConfig) {
    const {
      host: rawHost = '127.0.0.1',
      port = 6379,
      auth,
      sshOptions,
      ...config
    } = connectionConfig;

    const host = resolveHost(rawHost);
    const key = this.buildKey(connectionConfig);

    // If a connection with this key already exists, close it first so we
    // never accumulate zombie connections from page refreshes or re-opens.
    if (pool.has(key)) {
      await this.disconnect(key);
    }

    let client;

    if (sshOptions && sshOptions.host) {
      // Pass rawHost as dstAddr — it's relative to the SSH server, not this container.
      // resolveHost() must not apply here: "localhost" means the SSH jumphost's localhost.
      client = await sshService.createSSHConnection(sshOptions, rawHost, port, auth, config, this);
    } else {
      client = await this.createConnection(host, port, auth, config);
    }

    pool.set(key, client);
    return key;
  },

  async disconnect(key) {
    const client = pool.get(key);
    if (!client) return;
    pool.delete(key);
    try { await client.quit(); } catch (_) { /* ignore */ }
  },

  async disconnectAll() {
    const keys = [...pool.keys()];
    await Promise.allSettled(keys.map(k => this.disconnect(k)));
  },

  getClient(key) {
    const client = pool.get(key);
    if (!client) throw new Error(`No active connection for key: ${key}`);
    return client;
  },

  hasConnection(key) {
    return pool.has(key);
  },
};

module.exports = redisService;
