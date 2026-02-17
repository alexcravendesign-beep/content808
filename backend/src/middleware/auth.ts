import { Request, Response, NextFunction } from 'express';
import { UserRole, RequestUser } from '../types';

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string || 'system';
  const userName = req.headers['x-user-name'] as string || 'System User';
  const userRole = (req.headers['x-user-role'] as UserRole) || 'staff';

  const validRoles: UserRole[] = ['staff', 'manager', 'admin'];
  const role = validRoles.includes(userRole) ? userRole : 'staff';

  req.user = { id: userId, name: userName, role } as RequestUser;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}
