import crypto from 'crypto';

export class AuthManager {
    private pinHash: string;
    private activeSessions = new Set<string>();

    constructor(pin: string) {
        this.pinHash = this.hash(pin);
    }

    validate(pin: string): boolean {
        return this.hash(pin) === this.pinHash;
    }

    createToken(): string {
        const token = crypto.randomUUID();
        this.activeSessions.add(token);
        return token;
    }

    isValidToken(token: string): boolean {
        return this.activeSessions.has(token);
    }

    revokeToken(token: string): void {
        this.activeSessions.delete(token);
    }

    private hash(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex');
    }
}
