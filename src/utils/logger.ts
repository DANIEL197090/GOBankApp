type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

const colors: Record<LogLevel, string> = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m',  // Yellow
  info: '\x1b[36m',  // Cyan
  http: '\x1b[35m',  // Magenta
  debug: '\x1b[37m', // White
};

const reset = '\x1b[0m';

const formatMessage = (level: LogLevel, message: string, ...args: any[]): string => {
  const timestamp = new Date().toISOString();
  const color = colors[level] || '';
  const levelLabel = level.toUpperCase().padEnd(5);
  const extra = args.length > 0 ? ' ' + args.map(a => 
    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
  ).join(' ') : '';
  return `${color}[${timestamp}] [${levelLabel}] ${message}${extra}${reset}`;
};

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  error: (message: string, ...args: any[]) => {
    console.error(formatMessage('error', message, ...args));
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(formatMessage('warn', message, ...args));
  },
  info: (message: string, ...args: any[]) => {
    console.info(formatMessage('info', message, ...args));
  },
  http: (message: string, ...args: any[]) => {
    if (isDev) console.log(formatMessage('http', message, ...args));
  },
  debug: (message: string, ...args: any[]) => {
    if (isDev) console.log(formatMessage('debug', message, ...args));
  },
};

export default logger;
