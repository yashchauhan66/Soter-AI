const http = require('node:http');
http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok', example: 'approved-public-node-project' }));
}).listen(8081, '127.0.0.1');
