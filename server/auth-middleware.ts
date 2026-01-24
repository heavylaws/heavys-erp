
import { Request, Response, NextFunction } from 'express';
import { AuthPolicy, Permission } from './services/auth.policy';

// Deprecated: prefer checkPermission('user:manage')
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
};

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  if (req.session?.user) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

/**
 * Middleware factory to enforce RBAC permissions
 * Usage: router.post('/', checkPermission('product:create'), ...)
 */
export const checkPermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!AuthPolicy.can(user, permission)) {
      return res.status(403).json({ message: `Insufficient permissions. Required: ${permission}` });
    }

    next();
  };
};
