const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const root = __dirname;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(root, url === '/' ? 'index.html' : url);
  const ext = path.extname(filePath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found: ' + url);
    return;
  }
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, () => {
  console.log(`Landing page: http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop');
});
