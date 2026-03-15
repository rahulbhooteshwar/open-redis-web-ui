'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/connections', require('./routes/connections'));
app.use('/api/redis', require('./routes/redis'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/server', require('./routes/server'));
app.use('/api/formatter', require('./routes/formatter'));
app.use('/api/system', require('./routes/system'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Static frontend — no-cache so browsers always fetch the latest build
app.use(express.static(path.join(__dirname, '../dist'), {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

require('./ws/wsHandler')(wss);

const PORT = process.env.PORT || 9988;

server.listen(PORT, () => {
  console.log(`Open Redis Web UI Backend server listening on :${PORT}`);
});

/*
Track sockets so we can force close them if needed
*/
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

/*
Graceful shutdown
*/
function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);

  // Close websocket connections
  wss.clients.forEach((client) => {
    try {
      client.terminate();
    } catch (e) {}
  });

  wss.close(() => {
    console.log('WebSocket server closed');

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close any hanging sockets
    setTimeout(() => {
      sockets.forEach((socket) => socket.destroy());
    }, 500);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
