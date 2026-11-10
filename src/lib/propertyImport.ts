import type { Property } from '../types/index';
import { HOUSEHOLD_FLAGS } from './householdFlags.js';

const text = (value: unknown): value is string => typeof value === 'string';
const nonempty = (value: unknown): value is string => text(value) && value.trim().length > 0;
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const optionalText = (value: unknown) => value === undefined || text(value);
const roles = ['all', 'bishopric', 'relief_society', 'elders_quorum', 'ministering', 'ward_missionaries', 'youth_leadership'];
const calendarDate = (value: unknown) => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function isPropertyRecord(value: unknown): value is Property {
  if (!object(value)) return false;
  const p = value;
  return nonempty(p.id) && p.id.length <= 200 && nonempty(p.address) && optionalText(p.unit) &&
    ['Unassigned', 'North Ridge', 'Lakeside East', 'Timberline', 'Meadowview'].includes(p.zone) && text(p.parcelNumber) &&
    text(p.occupantSummary) && ['occupied', 'new_move_in', 'vacant', 'transient_rental'].includes(p.occupantState) &&
    optionalText(p.accessNotes) && optionalText(p.generalNotes) && strings(p.tags) &&
    (p.location === undefined || (object(p.location) && p.location.source === 'google_geocoding' &&
      nonempty(p.location.expiresAt) && Number.isFinite(Date.parse(p.location.expiresAt)) &&
      ['matched_building', 'confirmed', 'needs_contact'].includes(p.location.status) &&
      optionalText(p.location.placeId) && optionalText(p.location.reviewId))) &&
    ((p.coordinates === undefined && p.location?.source === 'google_geocoding') ||
      (object(p.coordinates) && ['x', 'y', 'lat', 'lng'].every(key => Number.isFinite(p.coordinates[key])) &&
      Math.abs(p.coordinates.lat) <= 90 && Math.abs(p.coordinates.lng) <= 180 &&
      p.coordinates.x >= 0 && p.coordinates.x <= 1000 && p.coordinates.y >= 0 && p.coordinates.y <= 800)) &&
    Array.isArray(p.followUps) && p.followUps.every((f: any) => object(f) && nonempty(f.id) && f.propertyId === p.id &&
      nonempty(f.title) && calendarDate(f.dueDate) && ['pending', 'completed'].includes(f.status) &&
      roles.includes(f.assignedRole) && ['urgent', 'normal', 'low'].includes(f.priority) && nonempty(f.createdAt) &&
      optionalText(f.description) && optionalText(f.assignedToName) && optionalText(f.completedAt) && optionalText(f.completedBy)) &&
    Array.isArray(p.visitLogs) && p.visitLogs.every((v: any) => object(v) && nonempty(v.id) && calendarDate(v.date) &&
      text(v.visitorName) && roles.includes(v.visitorRole) && text(v.summary) &&
      ['pastoral_visit', 'ministering', 'welcome_move_in', 'welfare_check', 'brief_doorstep'].includes(v.category)) &&
    nonempty(p.updatedAt) && Number.isFinite(Date.parse(p.updatedAt)) &&
    (p.householdFlags === undefined || (strings(p.householdFlags) && p.householdFlags.every(f => Object.hasOwn(HOUSEHOLD_FLAGS, f)))) &&
    (p.wardMembership === undefined || (object(p.wardMembership) &&
      ['unknown', 'our_ward', 'other_ward'].includes(p.wardMembership.status) && optionalText(p.wardMembership.wardName))) &&
    (p.importIdentity === undefined || (object(p.importIdentity) && nonempty(p.importIdentity.source) && nonempty(p.importIdentity.recordId)));
}

export function parsePropertyImport(content: string): Property[] {
  if (typeof content !== 'string') throw new Error('Expected an atlas JSON array of household records.');
  if (content.length > 2_000_000) throw new Error('Choose a JSON file smaller than 2 MB.');
  let data: unknown;
  try { data = JSON.parse(content); } catch { throw new Error('This file is not valid JSON.'); }
  if (!Array.isArray(data) || data.length > 2000) throw new Error('Expected an atlas JSON array with up to 2,000 household records.');
  const invalid = data.findIndex(p => !isPropertyRecord(p));
  if (invalid >= 0) throw new Error(`Record ${invalid + 1} is incomplete or invalid. Each record needs verified map coordinates and valid household fields.`);
  return data;
}

function identity(p: Property): string | undefined {
  return p.importIdentity && JSON.stringify([p.importIdentity.source, p.importIdentity.recordId]);
}
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const address = (p: Property) => JSON.stringify([normalize(p.address), normalize(p.unit ?? '')]);
const household = (p: Property) => JSON.stringify([address(p), normalize(p.occupantSummary)]);

export interface ImportPlan {
  additions: Property[];
  skipped: { id: string; address: string; reason: string }[];
  conflicts: { id: string; address: string; reason: string }[];
}

// Append only. Existing notes, flags, visit logs, and follow-ups are never replaced.
export function planPropertyImport(existing: Property[], incoming: Property[]): ImportPlan {
  const plan: ImportPlan = { additions: [], skipped: [], conflicts: [] };
  const seen = [...existing];
  for (const row of incoming) {
    const key = identity(row);
    const idMatch = seen.find(p => p.id === row.id);
    const sourceMatch = key && seen.find(p => identity(p) === key);
    const match = sourceMatch || idMatch;
    const entry = { id: row.id, address: row.address };
    if (idMatch && sourceMatch && idMatch !== sourceMatch) {
      plan.conflicts.push({ ...entry, reason: 'Record ID and source identity refer to different households.' });
    } else if (match) {
      if (household(match) !== household(row) || (identity(match) && key && identity(match) !== key)) {
        plan.conflicts.push({ ...entry, reason: 'An existing record has this identity but different household or address details. Review it manually.' });
      } else if (row.householdFlags?.some(flag => !match.householdFlags?.includes(flag)) ||
        (row.wardMembership?.status === 'other_ward' &&
          (match.wardMembership?.status !== 'other_ward' || match.wardMembership?.wardName !== row.wardMembership.wardName))) {
        plan.conflicts.push({ ...entry, reason: 'The import has additional flags or other-ward information for an existing household. Review and update that household before importing.' });
      } else plan.skipped.push({ ...entry, reason: 'Already present; existing information will be preserved.' });
    } else if (seen.some(p => household(p) === household(row))) {
      plan.conflicts.push({ ...entry, reason: 'This household and address already exist with another identity. Review it manually.' });
    } else if (!row.occupantSummary.trim() && seen.some(p => address(p) === address(row))) {
      plan.conflicts.push({ ...entry, reason: 'A shared address needs a household name to keep residents separate.' });
    } else {
      plan.additions.push(row);
      seen.push(row);
    }
  }
  return plan;
}
