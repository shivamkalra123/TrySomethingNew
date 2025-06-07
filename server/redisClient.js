
const redis = require('redis');

const client = redis.createClient();

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
