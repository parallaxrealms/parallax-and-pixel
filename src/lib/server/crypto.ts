import { SOCIAL_ENCRYPTION_KEY } from '$env/static/private';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = 'pxp-social-v1'; // Static salt for deterministic key derivation

function deriveKey(): Buffer {
	return scryptSync(SOCIAL_ENCRYPTION_KEY, SALT, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
	const key = deriveKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plaintext, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const tag = cipher.getAuthTag();

	// Format: iv:tag:encrypted (all hex)
	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
	const key = deriveKey();
	const [ivHex, tagHex, encrypted] = ciphertext.split(':');

	const iv = Buffer.from(ivHex, 'hex');
	const tag = Buffer.from(tagHex, 'hex');

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);

	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	return decrypted;
}

export function encryptCredentials(credentials: Record<string, unknown>): string {
	return encrypt(JSON.stringify(credentials));
}

export function decryptCredentials<T = Record<string, unknown>>(encrypted: string): T {
	return JSON.parse(decrypt(encrypted)) as T;
}
