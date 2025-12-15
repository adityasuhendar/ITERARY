const Redis = require('ioredis');

let redisClient = null;

const initRedis = () => {
  // Check if Redis is explicitly disabled
  if (process.env.REDIS_ENABLED === 'false') {
    console.log('Redis: Disabled via REDIS_ENABLED=false');
    return null;
  }

  // Check if Redis host is configured
  if (!process.env.REDIS_HOST) {
    console.log('Redis: No REDIS_HOST configured, caching disabled');
    return null;
  }

  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log('Redis: Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
    };

    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      console.log('Redis: Connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('Redis Error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('Redis: Connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('Redis initialization error:', error.message);
    return null;
  }
};

const getRedisClient = () => redisClient;

const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
};

const setCache = async (key, data, ttlSeconds = 300) => {
  if (!redisClient) return false;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
};

const deleteCache = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error.message);
    return false;
  }
};

const clearCachePattern = async (pattern) => {
  if (!redisClient) return false;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Redis clear pattern error:', error.message);
    return false;
  }
};

module.exports = {
  initRedis,
  getRedisClient,
  getCache,
  setCache,
  deleteCache,
  clearCachePattern
};
