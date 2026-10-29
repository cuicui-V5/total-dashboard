import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAggregatedFleetData, getNodeFullDetail, startBackgroundPoller } from './aggregator.js';
import { queryLatencyHistory } from './kuma-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3344;

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Main dashboard data endpoint
app.get('/api/fleet', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const data = await getAggregatedFleetData(force);
    res.json(data);
  } catch (error) {
    console.error('Fleet API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// On-demand full detail endpoint for a single node (fetched ONLY on user request)
app.get('/api/fleet/node/:nodeId/full', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const force = req.query.force === 'true';
    const detail = await getNodeFullDetail(nodeId, force);
    if (!detail) {
      return res.status(404).json({ error: `未找到节点配置: ${nodeId}` });
    }
    res.json(detail);
  } catch (error) {
    console.error(`Full detail API error for ${req.params.nodeId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Uptime Kuma multi-range history endpoint (1h, 24h, 7d, 30d) powered by local SQLite
app.get('/api/kuma/history', (req, res) => {
  try {
    const range = req.query.range || '24h';
    const data = queryLatencyHistory(range);
    if (data && data.timeline?.length > 0) {
      return res.json(data);
    }
    res.json(data || {
      range,
      source: 'local-sqlite',
      monitors: [],
      timeline: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Kuma history API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend static build in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to SPA index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TotalDashboard server listening on http://0.0.0.0:${PORT}`);
  startBackgroundPoller();
});
