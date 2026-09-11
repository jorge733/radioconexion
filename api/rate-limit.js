const attempts = new Map();

function allow(key, intervalMs) {
  const now = Date.now();
  const previous = attempts.get(key) || 0;
  if (now - previous < intervalMs) return false;
  attempts.set(key, now);
  return true;
}

module.exports = { allow };
