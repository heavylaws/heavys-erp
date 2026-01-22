/**
 * Password Utility Module
 * Secure password hashing using bcryptjs with best-practice settings
 * 
 * Security Notes:
 * - Cost factor 12 provides ~250ms hash time, resistant to brute force
 * - Uses bcryptjs (pure JS) for cross-platform compatibility
 * - Never store or log plaintext passwords
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password for secure storage
 * @param plainPassword - The user's plaintext password
 * @returns The hashed password (includes salt)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || plainPassword.length < 1) {
        throw new Error('Password cannot be empty');
    }
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored hash
 * @param plainPassword - The user's plaintext password attempt
 * @param hashedPassword - The stored bcrypt hash
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
    plainPassword: string,
    hashedPassword: string
): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
        return false;
    }

    // Bcrypt comparison is timing-safe
    return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Check if a password string is already a bcrypt hash
 * Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars
 */
export function isPasswordHashed(password: string): boolean {
    if (!password || password.length !== 60) {
        return false;
    }
    return /^\$2[aby]\$\d{2}\$/.test(password);
}

/**
 * Validate password strength
 * Returns an object with validation result and any error messages
 */
export function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
        errors.push('Password must not exceed 128 characters');
    }

    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    // At least one number
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
