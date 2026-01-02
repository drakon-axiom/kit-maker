/**
 * Production-safe logger utility
 * Logs are only output in development mode
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(message, ...args);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.error(message, ...args);
    }
    // In production, errors could be sent to an error tracking service
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(message, ...args);
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.debug(message, ...args);
    }
  },
};

export default logger;
