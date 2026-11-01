import type { Env } from "../types/Env";

/**
 * Envio de email:
 * - Com RESEND_API_KEY: usa a Resend (exige domínio verificado em produção).
 * - Com BREVO_API_KEY: usa a Brevo (plano free 300/dia; remetente individual
 *   verificado por email — não exige domínio próprio).
 * Sem nada configurado, o email é apenas logado no console (dev local).
 */
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
	if (env.RESEND_API_KEY) {
		return sendViaResend(env, to, subject, html);
	}

	if (env.BREVO_API_KEY) {
		return sendViaBrevo(env, to, subject, html);
	}

	console.log(`[email] sem provedor configurado — email para ${to} logado: ${subject}`);
	return false;
}

async function sendViaResend(env: Env, to: string, subject: string, html: string): Promise<boolean> {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			from: env.EMAIL_FROM ?? "Concorde <onboarding@resend.dev>",
			to,
			subject,
			html
		})
	});

	if (!response.ok) {
		console.warn("[email] Resend falhou:", response.status, await response.text().catch(() => ""));
		return false;
	}

	return true;
}

async function sendViaBrevo(env: Env, to: string, subject: string, html: string): Promise<boolean> {
	const from = env.EMAIL_FROM?.replace(/^.*<(.+)>$/, "$1").trim() ?? "no-reply@concorde.local";

	const response = await fetch("https://api.brevo.com/v3/smtp/email", {
		method: "POST",
		headers: {
			"api-key": env.BREVO_API_KEY as string,
			"Content-Type": "application/json",
			accept: "application/json"
		},
		body: JSON.stringify({
			sender: { email: from, name: "Concorde" },
			to: [{ email: to }],
			subject,
			htmlContent: html
		})
	});

	if (!response.ok) {
		console.warn("[email] Brevo falhou:", response.status, await response.text().catch(() => ""));
		return false;
	}

	return true;
}
