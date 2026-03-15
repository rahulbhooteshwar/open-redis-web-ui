'use strict';

const redisService = require('../services/redisService');

function send(ws, data) {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws, message, id) {
  send(ws, { type: 'error', id, message });
}

module.exports = function wsHandler(wss) {
  wss.on('connection', (ws) => {
    let monitorClient = null;
    let pubsubClient = null;

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return sendError(ws, 'Invalid JSON');
      }

      const { type, connectionKey, id } = msg;

      if (!connectionKey && type !== 'ping') {
        return sendError(ws, 'connectionKey required', id);
      }

      try {
        switch (type) {
          case 'ping':
            send(ws, { type: 'pong', id });
            break;

          case 'cli': {
            const { command, args = [] } = msg;
            const client = redisService.getClient(connectionKey);
            const result = await client.callBuffer(command, args);
            send(ws, { type: 'cli', id, result: result === null ? null : result.toString() });
            break;
          }

          case 'monitor': {
            const client = redisService.getClient(connectionKey);

            // Each call to client.monitor() returns a dedicated monitor client
            if (monitorClient) {
              try { monitorClient.disconnect(); } catch (_) {}
            }

            monitorClient = await client.monitor();
            monitorClient.on('monitor', (time, args, source, database) => {
              send(ws, { type: 'monitor', time, args, source, database });
            });

            send(ws, { type: 'monitor_started', id });
            break;
          }

          case 'monitor_stop': {
            if (monitorClient) {
              try { monitorClient.disconnect(); } catch (_) {}
              monitorClient = null;
            }
            send(ws, { type: 'monitor_stopped', id });
            break;
          }

          case 'subscribe':
          case 'psubscribe': {
            const { channels = [] } = msg;
            const client = redisService.getClient(connectionKey);

            if (!pubsubClient) {
              pubsubClient = client.duplicate();

              pubsubClient.on('message', (channel, message) => {
                send(ws, { type: 'message', channel, message });
              });

              pubsubClient.on('pmessage', (pattern, channel, message) => {
                send(ws, { type: 'pmessage', pattern, channel, message });
              });
            }

            await pubsubClient[type](channels);
            send(ws, { type: `${type}_ok`, id, channels });
            break;
          }

          case 'unsubscribe':
          case 'punsubscribe': {
            if (pubsubClient) {
              const { channels = [] } = msg;
              await pubsubClient[type](channels.length ? channels : undefined);
            }
            send(ws, { type: `${type}_ok`, id });
            break;
          }

          default:
            sendError(ws, `Unknown message type: ${type}`, id);
        }
      } catch (e) {
        sendError(ws, e.message, id);
      }
    });

    ws.on('close', () => {
      if (monitorClient) {
        try { monitorClient.disconnect(); } catch (_) {}
        monitorClient = null;
      }
      if (pubsubClient) {
        try { pubsubClient.disconnect(); } catch (_) {}
        pubsubClient = null;
      }
    });
  });
};
