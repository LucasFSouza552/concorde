
export interface Env {
	CALL_SESSIONS: DurableObjectNamespace;
	USER_SESSIONS: DurableObjectNamespace;
	concorde_users: D1Database;
	JWT_SECRET: string;
}