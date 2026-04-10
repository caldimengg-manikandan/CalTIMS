const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.CALENDAR_ENCRYPTION_SECRET || process.env.JWT_ACCESS_SECRET || 'fallback-secret-caltims-2026';
const KEY = crypto.scryptSync(SECRET, 'salt', 32);
const IV_LENGTH = 16;

/**
 * Encrypt text
 * @param {string} text 
 * @returns {string} iv:encrypted
 */
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt text
 * @param {string} encryptedText 
 * @returns {string}
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = {
    encrypt,
    decrypt
};
