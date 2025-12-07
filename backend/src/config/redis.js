
const Redis = require('ioredis');
require('dotenv').config();

let redis = null;

// Initialize Redis connection (optional for local dev)
const initRedis = () => {
  // Allow disabling via env flag
  if (process.env.REDIS_ENABLED === 'false') {
    console.log('⚡ Redis disabled by configuration');
    return null;
  }
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.warn('⚠️  Redis connection error (running without cache):', err.message);
      redis = null; // Disable redis if connection fails
    });

    return redis;
  } catch (error) {
    console.warn('⚠️  Redis not available (running without cache)');
    return null;
  }
};

// Cache helper functions
const getCache = async (key) => {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

const setCache = async (key, value, expiresIn = 300) => {
  if (!redis) return false;
  try {
    await redis.setex(key, expiresIn, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis set error:', error);
    return false;
  }
};

const deleteCache = async (key) => {
  if (!redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error);
    return false;
  }
};

const deleteCachePattern = async (pattern) => {
  if (!redis) return false;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Redis delete pattern error:', error);
    return false;
  }
};

module.exports = {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  redis: () => redis
};
