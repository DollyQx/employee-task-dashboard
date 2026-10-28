const crypto = require('node:crypto');

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    if (!password || typeof password !== 'string') {
      return reject(new Error('Password must be a non-empty string.'));
    }
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    if (!password || !storedHash || typeof storedHash !== 'string') {
      return resolve(false);
    }
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return resolve(false);
    }
    const salt = parts[1];
    const originalDerived = Buffer.from(parts[2], 'hex');

    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) return resolve(false);
      if (derivedKey.length !== originalDerived.length) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(derivedKey, originalDerived));
      } catch {
        resolve(false);
      }
    });
  });
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
};
