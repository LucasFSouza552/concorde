const OAUTH_STATE_BYTES = 32;
const PKCE_VERIFIER_BYTES = 32;

function base64Url(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateOauthState(): string {
	const bytes = new Uint8Array(OAUTH_STATE_BYTES);
	crypto.getRandomValues(bytes);

	return base64Url(bytes);
}

export function generatePkceVerifier(): string {
	const bytes = new Uint8Array(PKCE_VERIFIER_BYTES);
	crypto.getRandomValues(bytes);

	return base64Url(bytes);
}

export async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

	return base64Url(new Uint8Array(digest));
}
