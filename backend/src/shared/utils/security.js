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
    if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
    
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Return as-is if not in iv:encrypted format
    
    try {
        const [ivHex, encrypted] = parts;
        if (ivHex.length !== 32) return encryptedText; // IV should be 16 bytes = 32 hex chars

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // Fallback to original text if decryption fails (e.g. invalid hex or key mismatch)
        return encryptedText;
    }
}

/**
 * Encrypt JSON object
 */
function encryptJson(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt string back to JSON object
 */
function decryptJson(str) {
    if (!str || typeof str !== 'string') return str;
    try {
        const decrypted = decrypt(str);
        return decrypted ? JSON.parse(decrypted) : str;
    } catch (e) {
        return str; 
    }
}

module.exports = {
    encrypt,
    decrypt,
    encryptJson,
    decryptJson
};
