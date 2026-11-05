import { UserAccount, WardRole, WardRoleDefinition } from '../types';

export const WARD_ROLES: WardRoleDefinition[] = [
  { id: 'all', label: 'All Organizations', shortLabel: 'All', color: '#64748b' },
  { id: 'bishopric', label: 'Bishopric', shortLabel: 'Bishopric', color: '#3b82f6' },
  { id: 'relief_society', label: 'Relief Society', shortLabel: 'Relief Society', color: '#ec4899' },
  { id: 'elders_quorum', label: 'Elders Quorum', shortLabel: 'Elders Quorum', color: '#0ea5e9' },
  { id: 'ministering', label: 'Ministering Companionship', shortLabel: 'Ministering', color: '#8b5cf6' },
  { id: 'ward_missionaries', label: 'Ward Missionaries', shortLabel: 'Missionaries', color: '#f59e0b' },
  { id: 'youth_leadership', label: 'Youth Leadership', shortLabel: 'Youth', color: '#10b981' },
];

export const MOCK_USERS: UserAccount[] = [
  {
    id: 'user-bishop',
    name: 'Bishop Marcus Vance',
    role: 'bishopric',
    roleTitle: 'Bishop',
    avatarInitials: 'MV',
  },
  {
    id: 'user-rs-pres',
    name: 'President Elena Rostova',
    role: 'relief_society',
    roleTitle: 'Relief Society President',
    avatarInitials: 'ER',
  },
  {
    id: 'user-eq-pres',
    name: 'President David Kim',
    role: 'elders_quorum',
    roleTitle: 'Elders Quorum President',
    avatarInitials: 'DK',
  },
  {
    id: 'user-ministering-coord',
    name: 'Sister Sarah Jenkins',
    role: 'ministering',
    roleTitle: 'Ministering Coordinator',
    avatarInitials: 'SJ',
  },
  {
    id: 'user-missionaries',
    name: 'Elder Miller & Elder Davis',
    role: 'ward_missionaries',
    roleTitle: 'Full-time Missionaries',
    avatarInitials: 'MD',
  },
  {
    id: 'user-youth',
    name: 'Brother Luke Patterson',
    role: 'youth_leadership',
    roleTitle: 'Young Men Advisor',
    avatarInitials: 'LP',
  },
];

export function getRoleLabel(roleId: WardRole): string {
  const match = WARD_ROLES.find(r => r.id === roleId);
  return match ? match.label : roleId;
}

export function getRoleColor(roleId: WardRole): string {
  const match = WARD_ROLES.find(r => r.id === roleId);
  return match ? match.color : '#64748b';
}
