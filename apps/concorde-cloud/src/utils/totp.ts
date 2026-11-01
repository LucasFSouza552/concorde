/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226) com HMAC-SHA1 — implementado
 * manualmente porque o runtime de Workers não traz biblioteca pronta.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_MS = 30_000;
const TOTP_DIGITS = 6;
/** Janela de tolerância: aceita códigos do passo anterior e do próximo. */
const TOTP_WINDOW_STEPS = 1;

export function generateTotpSecret(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);

	return base32Encode(bytes);
}

export function buildTotpUrl(secret: string, username: string): string {
	const label = encodeURIComponent(`Concorde:${username}`);
	return `otpauth://totp/${label}?issuer=Concorde&secret=${secret}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_MS / 1000}`;
}

export function base32Encode(bytes: Uint8Array): string {
	let output = "";
	let bits = 0;
	let value = 0;

	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;

		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
			bits -= 5;
		}
	}

	if (bits > 0) {
		output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
	}

	return output;
}

export function base32Decode(input: string): Uint8Array | null {
	const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");

	let bits = 0;
	let value = 0;
	const bytes: number[] = [];

	for (const char of clean) {
		const index = BASE32_ALPHABET.indexOf(char);
		if (index < 0) return null;

		value = (value << 5) | index;
		bits += 5;

		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	return new Uint8Array(bytes);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string | null> {
	const key = await crypto.subtle.importKey(
		"raw",
		secret as BufferSource,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"]
	);

	const counterBytes = new Uint8Array(8);
	new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter));

	const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));

	// Truncamento dinâmico (RFC 4226 §5.3).
	const offset = signature[signature.length - 1] & 0x0f;
	const binary =
		(((signature[offset] & 0x7f) << 24) |
			(signature[offset + 1] & 0xff) << 16 |
			(signature[offset + 2] & 0xff) << 8 |
			(signature[offset + 3] & 0xff)) >>> 0;

	const code = binary % 10 ** TOTP_DIGITS;
	return code.toString().padStart(TOTP_DIGITS, "0");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let diff = 0;

	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return diff === 0;
}

/**
 * Verifica o código TOTP da janela atual (± 1 passo) contra o segredo.
 * Não expos: usos logo depois de validar também mantêm a janela aceita.
 */
export async function verifyTotpCode(secret: string, code: string, now = Date.now()): Promise<boolean> {
	const normalized = code.replace(/\D/g, "");

	if (normalized.length !== TOTP_DIGITS) return false;

	const key = base32Decode(secret);

	if (!key || key.length === 0) return false;

	const baseCounter = Math.floor(now / TOTP_STEP_MS);

	for (let offset = -TOTP_WINDOW_STEPS; offset <= TOTP_WINDOW_STEPS; offset++) {
		const expected = await hotp(key, baseCounter + offset);

		if (expected && timingSafeEqual(expected, normalized)) {
			return true;
		}
	}

	return false;
}
