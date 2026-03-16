function safeJson(payload) {
  try {
    return JSON.stringify(payload);
  } catch (_) {
    return JSON.stringify({ message: 'Unserializable payload' });
  }
}

function base(level, message, context = {}) {
  const log = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context
  };

  const line = safeJson(log);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info: (message, context) => base('info', message, context),
  warn: (message, context) => base('warn', message, context),
  error: (message, context) => base('error', message, context)
};
