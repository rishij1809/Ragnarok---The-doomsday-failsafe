/**
 * Ragnarok Server Main Entrypoint
 * Express HTTP + WebSocket Server for Disaster Recovery Orchestration
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const config = require('./config');
const apiRoutes = require('./routes/api');
const healthMonitor = require('./services/healthMonitor');
const replicationManager = require('./services/replicationManager');
const failoverOrchestrator = require('./services/failoverOrchestrator');
const backupManager = require('./services/backupManager');
const simulationEngine = require('./services/simulationEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// REST API routes
app.use('/api/v1', apiRoutes);

// Global WebSocket Broadcast to dashboard UI
function broadcastTelemetry() {
  const healthData = healthMonitor.checkHealth();
  const replicationData = replicationManager.getStatus();
  const failoverData = failoverOrchestrator.getStatus();
  const activeSimulations = simulationEngine.getActiveSimulations();

  const payload = JSON.stringify({
    type: 'TELEMETRY_UPDATE',
    timestamp: new Date().toISOString(),
    health: healthData,
    replication: replicationData,
    orchestrator: failoverData,
    simulations: activeSimulations
  });

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Telemetry Broadcast Loop (every 2 seconds)
const broadcastTimer = setInterval(broadcastTelemetry, 2000);
if (broadcastTimer.unref) broadcastTimer.unref();

// WebSocket Client Connection Handler
wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] Operator Dashboard client connected');
  // Send immediate telemetry update
  broadcastTelemetry();
});

// Start Server
const PORT = config.port;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` RAGNAROK - Multi-Cloud Disaster Recovery System v${config.version}`);
    console.log(` Server running on http://localhost:${PORT}`);
    console.log(` Operator Dashboard: http://localhost:${PORT}`);
    console.log(` API Base URL: http://localhost:${PORT}/api/v1`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server };
