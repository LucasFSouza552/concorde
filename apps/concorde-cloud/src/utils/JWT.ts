import { jwtVerify, SignJWT } from "jose";

export async function createToken(userId: string, secret: string) {
	const secretKey = new TextEncoder().encode(secret);

	return await new SignJWT({ sub: userId })
		.setProtectedHeader({
			alg: "HS256",
			typ: "JWT"
		})
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(secretKey);
}

export async function verifyToken(token: string, secret: string) {
	const secretKey = new TextEncoder().encode(secret);

	const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });

	if (!payload.sub) {
		throw new Error("Token sem subject.");
	}

	return payload.sub;
}
