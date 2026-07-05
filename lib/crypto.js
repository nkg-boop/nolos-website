const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is the recommended size for GCM.

function getEncryptionKey() {
  const keyHex = process.env.ENQUIRY_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'ENQUIRY_ENCRYPTION_KEY is not set. Generate one with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ` +
        'and add it as an environment variable in your Vercel project settings. See .env.example.'
    );
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENQUIRY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return key;
}

// Encrypts a plaintext string, returning a JSON-serializable object rather
// than a JSON *string* this time — since this is going into Redis (which
// can store objects directly via its automatic JSON serialization) rather
// than a text file. Storing it as an object avoids double-encoding
// (stringify-then-Redis-stringifies-again) which would work but wastes
// space and makes the stored value harder to inspect if you ever need to.
function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

function decrypt(payload) {
  const key = getEncryptionKey();
  const { iv, authTag, ciphertext } = payload;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]);
  return decrypted.toString('utf-8');
}

module.exports = { encrypt, decrypt };
