import type { HouseholdFlag, Property } from '../types/index';

export const HOUSEHOLD_FLAGS: Record<HouseholdFlag, string> = {
  do_not_contact: 'Do not contact',
  outside_ward: 'Outside ward boundaries',
  verify_residency: 'Residency verification needed',
  apartment_needed: 'Apartment number needed',
  verify_address: 'Address verification needed',
  shared_address: 'Verify current occupants at shared address',
  reported_moved: 'Reported moved — verify occupancy',
};

export function householdLabels(property: Property): string[] {
  const labels = Object.entries(HOUSEHOLD_FLAGS)
    .filter(([flag]) => property.householdFlags?.includes(flag as HouseholdFlag)).map(([, label]) => label);
  if (property.location && (!property.coordinates || Date.parse(property.location.expiresAt) <= Date.now())) labels.push('Map location needs refresh');
  if (property.wardMembership?.status === 'other_ward') {
    labels.push(`Member of another ward${property.wardMembership.wardName ? `: ${property.wardMembership.wardName}` : ''}`);
  }
  return labels;
}
