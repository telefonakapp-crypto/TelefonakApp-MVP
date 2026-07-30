/**
 * Resolve the public origin used when building absolute upload/image URLs.
 * Prefer BASE_URL so physical devices and staging never receive localhost links.
 */
function resolveBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

module.exports = { resolveBaseUrl };
