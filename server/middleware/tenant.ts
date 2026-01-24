
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to ensure the request is associated with a valid organization.
 * Used for multi-tenant isolation.
 */
export function requireOrganization(req: any, res: Response, next: NextFunction) {
    if (!req.session?.user?.organizationId) {
        // If user is logged in but has no org (e.g. system admin or pre-migration), 
        // we might want to handle it differently. For now, block.
        console.warn(`[TenantGuard] User ${req.session?.user?.id} attempted access without organizationId`);
        return res.status(403).json({ message: "Organization context missing. Please contact support." });
    }
    next();
}
