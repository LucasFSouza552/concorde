
export function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: unknown): username is string {
    return typeof username === "string" && username.trim().length > 0;
}

export function sanitizeUsername(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_.]/g, "");
}
const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

export function isValidUsernameFormat(username: string): boolean {
    return USERNAME_PATTERN.test(username);
}