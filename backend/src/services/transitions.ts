import { ContentStatus, UserRole } from '../types';

interface TransitionRule {
  from: ContentStatus;
  to: ContentStatus;
  allowedRoles: UserRole[];
}

const TRANSITION_RULES: TransitionRule[] = [
  { from: 'idea', to: 'draft', allowedRoles: ['staff', 'manager', 'admin'] },
  { from: 'draft', to: 'review', allowedRoles: ['staff', 'manager', 'admin'] },
  { from: 'review', to: 'approved', allowedRoles: ['manager', 'admin'] },
  { from: 'review', to: 'blocked', allowedRoles: ['manager', 'admin'] },
  { from: 'blocked', to: 'draft', allowedRoles: ['staff', 'manager', 'admin'] },
  { from: 'blocked', to: 'review', allowedRoles: ['staff', 'manager', 'admin'] },
  { from: 'approved', to: 'scheduled', allowedRoles: ['manager', 'admin'] },
  { from: 'scheduled', to: 'published', allowedRoles: ['manager', 'admin'] },
  { from: 'approved', to: 'blocked', allowedRoles: ['manager', 'admin'] },
  { from: 'scheduled', to: 'blocked', allowedRoles: ['manager', 'admin'] },
];

export function getValidTransitions(currentStatus: ContentStatus, role: UserRole): ContentStatus[] {
  return TRANSITION_RULES
    .filter((r) => r.from === currentStatus && r.allowedRoles.includes(role))
    .map((r) => r.to);
}

export function canTransition(from: ContentStatus, to: ContentStatus, role: UserRole): boolean {
  return TRANSITION_RULES.some(
    (r) => r.from === from && r.to === to && r.allowedRoles.includes(role)
  );
}

export function getAllStatuses(): ContentStatus[] {
  return ['idea', 'draft', 'review', 'approved', 'blocked', 'scheduled', 'published'];
}
