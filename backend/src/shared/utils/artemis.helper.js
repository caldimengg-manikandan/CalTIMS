'use strict';

const crypto = require('crypto');

/**
 * Artemis Helper
 * Handles HMAC-SHA256 signature calculation for HikCentral Artemis API.
 */
const artemisHelper = {
  /**
   * Calculate HMAC-SHA256 signature
   * @param {string} method - HTTP method (POST, GET, etc.)
   * @param {string} url - API URL (e.g., /artemis/api/acs/v1/event/event-log-search)
   * @param {Object} headers - HTTP headers
   * @param {string} appSecret - Artemis App Secret
   */
  computeSignature(method, url, headers, appSecret) {
    const strToSign = this.buildStringToSign(method, url, headers);
    return crypto
      .createHmac('sha256', appSecret)
      .update(strToSign, 'utf8')
      .digest('base64');
  },

  /**
   * Build the string to sign as per Artemis documentation
   */
  buildStringToSign(method, url, headers) {
    const signHeader = [];
    signHeader.push(method.toUpperCase());
    signHeader.push(headers['Accept'] || '*/*');
    signHeader.push(headers['Content-Type'] || 'application/json');
    
    // Artemis expects specific headers if present, else empty lines
    // Sequence: Method, Accept, Content-Type, Date, CustomHeaders, URL
    
    // We don't use X-Ca-Signature-Headers for simplicity unless needed
    // But we need the placeholders for Date if not provided
    signHeader.push(''); // Date placeholder
    
    // URL should include query parameters if any
    signHeader.push(url);

    return signHeader.join('\n');
  },

  /**
   * Prepare headers for Artemis request
   */
  getHeaders(appKey, appSecret, method, url) {
    const now = Date.now().toString();
    const headers = {
      'Accept': '*/*',
      'Content-Type': 'application/json',
      'x-ca-key': appKey,
      'x-ca-timestamp': now,
    };

    const strToSign = `${method}\n*/*\napplication/json\nx-ca-key:${appKey}\nx-ca-timestamp:${now}\n${url}`;
    
    const signature = crypto
      .createHmac('sha256', appSecret)
      .update(strToSign, 'utf8')
      .digest('base64');

    headers['x-ca-signature'] = signature;
    headers['x-ca-signature-headers'] = 'x-ca-key,x-ca-timestamp';

    return headers;
  }
};

module.exports = artemisHelper;
