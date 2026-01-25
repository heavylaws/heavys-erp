
import { User } from "@shared/schema";

// --- Permission Definitions ---
export const PERMISSIONS = [
    // User Management
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:manage',

    // Product Management
    'product:read', 'product:create', 'product:update', 'product:delete', 'product:manage',

    // Order Management
    'order:read', 'order:create', 'order:update', 'order:delete', 'order:void', 'order:manage',

    // Inventory/Stock
    'inventory:read', 'inventory:update', 'inventory:manage',

    // Settings & System
    'settings:read', 'settings:manage',
    'erp:read', 'erp:manage',
    'report:view',
    'activity:read',

    // Wildcard
    '*'
] as const;

export type Permission = typeof PERMISSIONS[number];

// --- Role Definitions ---
export const ROLES: Record<string, Permission[]> = {
    admin: ['*'],
    manager: [
        'product:*' as any, // Wildcard handling needs logic or explicit list.
        // Explicit list for safety if wildcards aren't implemented deeply yet
        'product:create', 'product:update', 'product:delete', 'product:manage',
        'inventory:update', 'inventory:manage',
        'order:*' as any,
        'user:read', 'user:create', 'user:update', // Allow user management
        'report:view',
        'settings:manage',
        'erp:manage',
        // Expanded permissions as requested
        'supplier:read', 'supplier:create', 'supplier:update', 'supplier:delete',
        'customer:read', 'customer:create', 'customer:update', 'customer:delete',
        'purchase_order:read', 'purchase_order:create', 'purchase_order:update', 'purchase_order:delete'
    ],
    cashier: [
        'order:create', 'order:read', 'order:update',
        'product:read',
        'inventory:read'
    ],
    barista: [
        'order:read',
        'order:update', // Status updates
        'inventory:read'
    ],
    warehouse: [
        'inventory:read', 'inventory:update', 'inventory:manage',
        'product:read',
        'erp:read'
    ],
    courier: [
        'order:read',
        'order:update' // Delivery status
    ]
};

// Expand wildcards for easier checking (Helper)
const EXPANDED_ROLES: Record<string, Set<Permission>> = {};

function expandPermissions(role: string): Set<Permission> {
    if (EXPANDED_ROLES[role]) return EXPANDED_ROLES[role];

    const rawPerms = ROLES[role] || [];
    const expanded = new Set<Permission>();

    for (const p of rawPerms) {
        if (p === '*') {
            // Grant all
            for (const allP of PERMISSIONS) expanded.add(allP);
        } else if (p.endsWith(':*')) {
            const prefix = p.split(':')[0];
            for (const allP of PERMISSIONS) {
                if (allP.startsWith(prefix + ':')) expanded.add(allP);
            }
        } else {
            expanded.add(p as Permission);
        }
    }

    EXPANDED_ROLES[role] = expanded;
    return expanded;
}

// --- Policy Logic ---

export class AuthPolicy {
    /**
     * Check if a user has a specific permission
     */
    static can(user: { role: string } | undefined | null, permission: Permission): boolean {
        if (!user || !user.role) return false;

        const rolePerms = expandPermissions(user.role);
        return rolePerms.has(permission) || rolePerms.has('*');
    }

    /**
     * Check if user has ANY of the provided permissions
     */
    static canAny(user: User | undefined, permissions: Permission[]): boolean {
        if (!user) return false;
        return permissions.some(p => this.can(user, p));
    }

    /**
     * Check if user has ALL provided permissions
     */
    static canAll(user: User | undefined, permissions: Permission[]): boolean {
        if (!user) return false;
        return permissions.every(p => this.can(user, p));
    }
}
