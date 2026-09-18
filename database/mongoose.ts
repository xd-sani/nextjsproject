import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("please define MONGODB_URI enviroment variable");
}

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cached =
  global.mongooseCache ||
  (global.mongooseCache = { conn: null, promise: null });

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
};

async function connectWithRetry(
  retries = MAX_RETRIES,
  delayMs = INITIAL_DELAY_MS,
): Promise<typeof mongoose> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    attempt++;
    try {
      if (
        mongoose.connection.readyState !== 0 &&
        mongoose.connection.readyState !== 1
      ) {
        try {
          await mongoose.disconnect();
        } catch {
          // ignore disconnect error prior to reconnecting
        }
      }

      // Re-apply DNS servers before each attempt. On Windows, the c-ares
      // channel (Node's DNS backend) can fail to initialize its UDP sockets
      // with custom servers on a cold process start. Re-calling setServers()
      // forces c-ares to reinitialize the channel, which resolves the issue
      // once the network stack is ready (typically by the 2nd or 3rd attempt).
      dns.setServers(["1.1.1.1", "8.8.8.8"]);

      const conn = await mongoose.connect(MONGODB_URI!, {
        bufferCommands: false,
      });
      return conn;
    } catch (error) {
      lastError = error;
      console.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${sanitizeError(error)}`,
      );

      if (attempt < retries) {
        await delay(delayMs);
        delayMs *= 2;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to connect to MongoDB after ${retries} attempts`);
}

export const connectToDataBase = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
  }

  if (cached.promise) {
    return await cached.promise;
  }

  cached.promise = (async () => {
    try {
      const conn = await connectWithRetry();
      cached.conn = conn;
      console.info("Connected to db");
      return conn;
    } catch (e) {
      cached.conn = null;
      console.error(
        "Mongodb connection error please make sure MongoDb is Running: " +
          sanitizeError(e),
      );
      throw e;
    } finally {
      cached.promise = null;
    }
  })();

  return await cached.promise;
};
