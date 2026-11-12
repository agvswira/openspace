import crypto from 'node:crypto';

// Token sekali pakai: yang dikirim ke email adalah token asli,
// yang disimpan di database hanya hash SHA-256-nya.
export function createOneTimeToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
