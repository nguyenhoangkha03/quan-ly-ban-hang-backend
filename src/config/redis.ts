import { createClient, RedisClientType } from 'redis';

class RedisConfig {
  private static instance: RedisConfig;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisConfig {
    if (!RedisConfig.instance) {
      RedisConfig.instance = new RedisConfig();
    }

    return RedisConfig.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      console.log('Redis already connected');

      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DATABASE || '0'),
      });

      // Error handler
      this.client.on('error', (err) => {
        console.error('Redis Client Error: ', err);
        this.isConnected = false;
      });

      // Connect event
      this.client.on('connect', () => {
        console.log('Redis connecting...');
      });

      // Ready event
      this.client.on('ready', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      // End event
      this.client.on('end', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
    } catch (error) {
      console.error('Error connecting to Redis:', error);
    }
  }

  // Get Redis Client
  public getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  // Check if Redis is connected
  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Disconnect from Redis
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('Redis disconnected');
    }
  }

  // Ping Redis to check connection
  public async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    return await this.client.ping();
  }
}

export default RedisConfig;
