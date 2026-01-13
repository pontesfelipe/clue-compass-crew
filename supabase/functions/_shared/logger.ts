// Structured logging for edge functions
// Provides consistent log format for observability

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogContext {
  function: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  function: string;
  requestId?: string;
  userId?: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
  duration_ms?: number;
}

class Logger {
  private startTime: number;

  constructor(private context: LogContext) {
    this.startTime = Date.now();
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      ...this.context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : { message: String(error), name: 'Unknown' },
    };
    console.log(JSON.stringify(logEntry));
  }

  withContext(additionalContext: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  // Log with timing information
  timed(message: string, data?: any): void {
    const duration = Date.now() - this.startTime;
    this.log(LogLevel.INFO, message, { ...data, duration_ms: duration });
  }

  // Create a child logger for a sub-operation
  child(operation: string): Logger {
    return new Logger({
      ...this.context,
      parentOperation: this.context.function,
      function: operation,
    });
  }
}

export function createLogger(functionName: string, requestId?: string): Logger {
  return new Logger({
    function: functionName,
    requestId: requestId || crypto.randomUUID(),
  });
}

// Performance timing helper
export class Timer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  sinceMark(name: string): number | null {
    const markTime = this.marks.get(name);
    if (!markTime) return null;
    return Date.now() - markTime;
  }

  getMarks(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.marks) {
      result[name] = time - this.startTime;
    }
    return result;
  }
}
