export type FollowUpStatus = 'overdue' | 'due_soon' | 'scheduled' | 'completed' | 'no_action';

export type FollowUpPriority = 'urgent' | 'normal' | 'low';

export type WardRole =
  | 'all'
  | 'bishopric'
  | 'relief_society'
  | 'elders_quorum'
  | 'ministering'
  | 'ward_missionaries'
  | 'youth_leadership';

export interface WardRoleDefinition {
  id: WardRole;
  label: string;
  shortLabel: string;
  color: string; // Tailwind color class or hex
}

export interface UserAccount {
  id: string;
  name: string;
  role: WardRole;
  roleTitle: string;
  avatarInitials: string;
}

export type VisitCategory =
  | 'pastoral_visit'
  | 'ministering'
  | 'welcome_move_in'
  | 'welfare_check'
  | 'brief_doorstep';

export interface VisitLog {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  visitorName: string;
  visitorRole: WardRole;
  category: VisitCategory;
  summary: string;
}

export interface FollowUpItem {
  id: string;
  propertyId: string;
  title: string;
  description?: string;
  assignedRole: WardRole;
  assignedToName?: string;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'completed';
  completedAt?: string;
  completedBy?: string;
  priority: FollowUpPriority;
  createdAt: string;
}

export type OccupantState = 'occupied' | 'new_move_in' | 'vacant' | 'transient_rental';

export type HouseholdFlag = 'verify_residency' | 'apartment_needed' | 'verify_address' | 'shared_address' | 'reported_moved' | 'do_not_contact' | 'outside_ward';
export interface WardMembership {
  status: 'unknown' | 'our_ward' | 'other_ward';
  wardName?: string;
}

export interface PropertyCoordinates {
  x: number; // 0 - 1000 map svg coordinates
  y: number; // 0 - 800 map svg coordinates
  lat: number;
  lng: number;
}

export interface Property {
  id: string;
  address: string;
  unit?: string;
  zone: 'Unassigned' | 'North Ridge' | 'Lakeside East' | 'Timberline' | 'Meadowview';
  parcelNumber: string;
  coordinates?: PropertyCoordinates;
  location?: { source: 'google_geocoding'; expiresAt: string; status: 'matched_building' | 'confirmed' | 'needs_contact'; placeId?: string; reviewId?: string; refreshedAt?: string; pendingReviewId?: string };
  occupantSummary: string;
  occupantState: OccupantState;
  accessNotes?: string;
  generalNotes?: string;
  tags: string[];
  householdFlags?: HouseholdFlag[];
  wardMembership?: WardMembership;
  importIdentity?: { source: string; recordId: string };
  followUps: FollowUpItem[];
  visitLogs: VisitLog[];
  updatedAt: string;
}

export interface FilterState {
  searchQuery: string;
  status: 'all' | FollowUpStatus;
  role: WardRole;
  zone: 'all' | Property['zone'];
}
