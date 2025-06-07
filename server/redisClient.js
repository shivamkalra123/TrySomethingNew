// redisClient.js
require('dotenv').config();
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
  },
});

client.on('error', (err) => console.error('❌ Redis Client Error:', err));

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log('✅ Redis connected');
  }
}

module.exports = {
  client,
  connectRedis,
};
