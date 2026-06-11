import { createLogger, format, transports } from 'winston';
import type { transport as Transport } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

const isProduction = process.env.NODE_ENV === 'production';

const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// File logging is OPT-IN and OFF by default.
// On ECS/EKS, stdout is the single source of truth — the awslogs driver
// and the container filesystem is ephemeral/often read-only. Only enable
// LOG_TO_FILE=true for local development or when a writable volume is mounted.
const logToFile = process.env.LOG_TO_FILE === 'true';
const logDir = process.env.LOG_DIR || './logs';

// Console is ALWAYS on: JSON in production (parseable by CloudWatch Logs
// Insights), colorized single-line in development.
const consoleTransport = new transports.Console({
  level: logLevel,
  format: isProduction
    ? format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
      )
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.printf((info) => {
          const { timestamp, level, message, stack } = info as typeof info & {
            timestamp?: string;
            stack?: string;
          };
          return `${timestamp} ${level}: ${stack || message}`;
        }),
      ),
});

function createFileTransport(): DailyRotateFile {
  const fileTransport = new DailyRotateFile({
    filename: 'app-%DATE%.log',
    dirname: logDir,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: logLevel,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    ),
  });

  // Surface write failures instead of swallowing them, but never crash.
  fileTransport.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[logger] file transport error:', err?.message || err);
  });

  return fileTransport;
}

const transportArray: Transport[] = [consoleTransport];
if (logToFile) {
  transportArray.push(createFileTransport());
}

export const logger = createLogger({
  level: logLevel,
  transports: transportArray,
});
