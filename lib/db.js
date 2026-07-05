const { getRedis } = require('./redis');
const { encrypt, decrypt } = require('./crypto');

const INDEX_KEY = 'enquiries:index'; // Redis set of all enquiry IDs.
const ENQUIRY_KEY_PREFIX = 'enquiry:';

// Each enquiry is stored as its own key (enquiry:<uuid>) rather than all
// enquiries living inside one growing array under a single key. This
// matters for two reasons: (1) it avoids a read-modify-write race where
// two enquiries submitted at nearly the same moment could overwrite each
// other if both read the array before either wrote back, and (2) it keeps
// each individual value small, which matters because Upstash's free tier
// is priced and limited per-command and per-value-size, not just total
// storage.
async function saveEnquiry(enquiry) {
  const redis = getRedis();
  const key = `${ENQUIRY_KEY_PREFIX}${enquiry.id}`;
  const encrypted = encrypt(JSON.stringify(enquiry));

  // sadd (add to the index set) and set (store the actual encrypted
  // enquiry) both need to succeed for this to be fully consistent. If the
  // second call failed after the first succeeded, the index would
  // reference a key that doesn't exist yet. Doing the data write first
  // and the index write second means a partial failure instead leaves an
  // orphaned enquiry (recoverable by scanning Redis directly) rather than
  // a broken index reference (which would throw when read).
  await redis.set(key, encrypted);
  await redis.sadd(INDEX_KEY, enquiry.id);

  return enquiry;
}

async function getAllEnquiries() {
  const redis = getRedis();
  const ids = await redis.smembers(INDEX_KEY);

  if (!ids || ids.length === 0) {
    return [];
  }

  const enquiries = [];
  for (const id of ids) {
    try {
      const encrypted = await redis.get(`${ENQUIRY_KEY_PREFIX}${id}`);
      if (!encrypted) {
        // Index references an ID with no corresponding value — this is
        // the "orphaned index entry" case noted above. Skip it rather
        // than throw, so one bad entry doesn't take down the whole list.
        console.error(`Enquiry index references missing key for id ${id}. Skipping.`);
        continue;
      }
      const decrypted = decrypt(encrypted);
      enquiries.push(JSON.parse(decrypted));
    } catch (err) {
      // Decryption failure for one enquiry (e.g. the encryption key
      // changed) shouldn't hide every other enquiry from the admin view.
      console.error(`Failed to decrypt enquiry ${id}:`, err.message);
      continue;
    }
  }

  return enquiries;
}

module.exports = { saveEnquiry, getAllEnquiries };
