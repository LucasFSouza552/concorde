
const ITERATIONS = 600_000;
const KEY_LENGTH = 256;

export async function hashPassword(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: ITERATIONS,
			hash: "SHA-256"
		},
		keyMaterial,
		KEY_LENGTH
	);

	const hash = new Uint8Array(hashBuffer);

	return {
		hash: bytesToBase64(hash),
		salt: bytesToBase64(salt)
	};
}

export async function verifyPassword(
	password: string,
	storedHash: string,
	storedSalt: string
) {
	const salt = base64ToBytes(storedSalt);

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: ITERATIONS,
			hash: "SHA-256"
		},
		keyMaterial,
		KEY_LENGTH
	);

	const hash = new Uint8Array(hashBuffer);

	const calculatedHash = bytesToBase64(hash);

	return calculatedHash === storedHash;
}

function bytesToBase64(bytes: Uint8Array) {
	return btoa(
		String.fromCharCode(...bytes)
	);
}

function base64ToBytes(base64: string) {
	const binary = atob(base64);

	return Uint8Array.from(
		binary,
		char => char.charCodeAt(0)
	);
}