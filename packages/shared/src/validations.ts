
export function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: unknown): username is string {
    return typeof username === "string" && username.trim().length > 0;
}