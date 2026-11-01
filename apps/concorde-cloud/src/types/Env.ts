
export interface Env {
	CALL_SESSIONS: DurableObjectNamespace;
	USER_SESSIONS: DurableObjectNamespace;
	concorde_users: D1Database;
	JWT_SECRET: string;
	/** "1" desativa o rate limiting (usado em testes). */
	RATE_LIMIT_DISABLED?: string;
	/** Chave da Resend para envio de email (exige domínio verificado). */
	RESEND_API_KEY?: string;
	/** Chave da Brevo (plano free; remetente individual — sem domínio). */
	BREVO_API_KEY?: string;
	/** Remetente dos emails. Ex.:
	 *  Resend: "Concorde <no-reply@dominio.com>" | Brevo: "no-reply@seuemail.com" */
	EMAIL_FROM?: string;
	/** "1" devolve o código de reset na resposta (testes). */
	PASSWORD_RESET_DEBUG?: string;
}