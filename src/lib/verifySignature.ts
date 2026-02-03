import crypto from 'crypto';

/**
 * Verifies the X-Hub-Signature-256 header sent by WhatsApp/Meta.
 * @param payload The raw body of the request as a string.
 * @param signature The signature header value (sha256=...).
 * @param appSecret The App Secret from Meta App Dashboard.
 * @returns true if valid, false otherwise.
 */
export function verifySignature(payload: string, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;

    // Signature format: "sha256=HASH_VALUE"
    const [algo, hash] = signature.split('=');
    if (algo !== 'sha256') return false;

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(payload);
    const expectedHash = hmac.digest('hex');

    // Constant time comparison to prevent timing attacks
    // But crypto.timingSafeEqual requires Buffers of equal length
    try {
        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        const providedBuffer = Buffer.from(hash, 'hex');

        if (expectedBuffer.length !== providedBuffer.length) return false;

        return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch (e) {
        console.error("Signature verification error:", e);
        return false;
    }
}
