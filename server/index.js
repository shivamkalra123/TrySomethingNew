const express = require('express');
const http = require('http');
const { connectRedis } = require('./redisClient');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

(async () => {
  await connectRedis(); // Ensure Redis is connected before starting the server

  initSocket(server);

  app.get('/', (req, res) => {
    res.send('Server running');
  });

  const PORT = 4000;
  server.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
  });
})();
