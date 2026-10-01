#!/usr/bin/env node
/**
 * UBS - Friends & Family Chegirma Tizimi
 * Admin shaxsiy kompyuteriga arizachilarning asl PDF hujjatlarini qabul qilish serveri (Node.js).
 * Hech qanday npm install talab qilmaydi (Faqat standart Node.js).
 *
 * Ishga tushirish:
 *    node ubs_local_receiver.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const SAVE_DIR = path.resolve(process.cwd(), 'UBS_Qabul_Qilingan_Hujjatlar');

if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Document-Id, X-Document-Name, X-Document-Size');
}

const server = http.createServer((req, res) => {
  sendCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'GET' && (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'UBS Local Server faol ishlab turibdi',
      save_dir: SAVE_DIR,
      time: new Date().toISOString()
    }));
    return;
  }

  if (req.method === 'POST' && (parsedUrl.pathname.includes('/upload') || parsedUrl.pathname.includes('/receive-document'))) {
    const rawName = parsedUrl.query.name || req.headers['x-document-name'] || 'hujjat.pdf';
    let filename = decodeURIComponent(rawName);
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const filePath = path.join(SAVE_DIR, filename);

      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(body.toString('utf8'));
          let dataUrl = json.dataUrl || '';
          if (dataUrl.includes(',')) {
            dataUrl = dataUrl.split(',')[1];
          }
          const buf = Buffer.from(dataUrl, 'base64');
          fs.writeFileSync(filePath, buf);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
          return;
        }
      } else {
        fs.writeFileSync(filePath, body);
      }

      const sizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
      console.log(`[${new Date().toLocaleTimeString()}] 📥 YANGI HUJJAT SAQLANDI: ${filename} (${sizeMb} MB)`);
      console.log(`    Manzil: ${filePath}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        filename,
        saved_to: filePath
      }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(65));
  console.log('  UBS - Shaxsiy Kompyuter Serveri Ishga Tushdi!');
  console.log(`  Port: ${PORT}`);
  console.log(`  Fayllar saqlanadigan papka: ${SAVE_DIR}`);
  console.log(`  Admin panelida ko'rsatiladigan URL: http://localhost:${PORT}`);
  console.log('='.repeat(65));
  console.log("Arizachilarning hujjatlari kutilmoqda...\n");
});
