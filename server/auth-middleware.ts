import { Request, Response, NextFunction } from 'express';

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
