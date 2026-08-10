import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  ROLE_OWNER,
  ROLE_CHIEF_NURSE,
  LEADERSHIP_ROLES,
  CLINICAL_ROLES,
  ASSIGNABLE_ROLES,
  MANAGER_TIER_ROLES
} from '../../public/js/config.js';
import { TRANSLATIONS, translateRole, setLanguage } from '../../public/js/i18n.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Pull the string-array literal returned by a named firestore.rules helper. */
function rulesRoleList(source, fnName) {
  const body = new RegExp(`function\\s+${fnName}\\s*\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\]`).exec(source);
  if (!body) throw new Error(`firestore.rules: ${fnName}() not found or not a list literal`);
  return body[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

describe('chief_nurse sits in the clinical tier but not the manager tier', () => {
  it('reaches patient PHI', () => {
    expect(CLINICAL_ROLES).toContain(ROLE_CHIEF_NURSE);
  });

  it('is assignable by the owner', () => {
    expect(ASSIGNABLE_ROLES).toContain(ROLE_CHIEF_NURSE);
  });

  it('does NOT carry the data controls', () => {
    // Purging and deleting records is a retention action reserved for
    // leadership; a chief nurse works the board without it.
    expect(MANAGER_TIER_ROLES).not.toContain(ROLE_CHIEF_NURSE);
    expect(LEADERSHIP_ROLES).not.toContain(ROLE_CHIEF_NURSE);
  });

  it('has a label in both languages', () => {
    expect(TRANSLATIONS.en.uCN).toBe('Chief Nurse');
    expect(TRANSLATIONS.ar.uCN).toBeTruthy();
    expect(TRANSLATIONS.ar.uCN).not.toBe('uCN');

    setLanguage('en');
    expect(translateRole(ROLE_CHIEF_NURSE)).toBe('Chief Nurse');
    setLanguage('ar');
    expect(translateRole(ROLE_CHIEF_NURSE)).toBe(TRANSLATIONS.ar.uCN);
    setLanguage('en');
  });

  it('has a colour token so its cards and tiles render', () => {
    // A missing token resolves to nothing and the accent silently disappears.
    expect(read('public/css/design-system-2026.css')).toContain('--role-nurse');
    expect(read('public/js/app.js')).toContain("chief_nurse: 'var(--role-nurse)'");
  });
});

/**
 * config.js and firestore.rules are two copies of one role model — the client
 * decides what it renders, the rules decide what the database allows. Drift
 * between them is silent and only shows up as a permission error in someone's
 * face, so it is asserted rather than left to review.
 */
describe('the role model is mirrored across every copy of it', () => {
  const rules = read('firestore.rules');

  it('firestore.rules clinicalRoles() matches CLINICAL_ROLES', () => {
    expect(rulesRoleList(rules, 'clinicalRoles').sort()).toEqual([...CLINICAL_ROLES].sort());
  });

  it('firestore.rules leadershipRoles() matches LEADERSHIP_ROLES', () => {
    expect(rulesRoleList(rules, 'leadershipRoles').sort()).toEqual([...LEADERSHIP_ROLES].sort());
  });

  it('firestore.rules assignableRoles() covers every assignable role plus the lifecycle states', () => {
    expect(rulesRoleList(rules, 'assignableRoles').sort())
      .toEqual([...ASSIGNABLE_ROLES, 'pending', 'blocked'].sort());
  });

  it('the delete rule on /patients admits leadership only, never the wider clinical tier', () => {
    const deleteRule = /allow delete: if isOwner\(\) \|\| \(isLeadership\(\) && isDischargedRecord\(\)\)/;
    expect(rules).toMatch(deleteRule);
    // isClinicalStaff() is the wider predicate; it must not gate deletion.
    expect(rules).not.toMatch(/allow delete:[^;]*isClinicalStaff\(\)/);
  });

  it('scripts/set-admin.js can grant every assignable role', () => {
    const script = read('scripts/set-admin.js');
    expect(script).toContain("const CLINICAL_ROLES = [...LEADERSHIP_ROLES, 'chief_nurse']");
    expect(script).toContain('const ASSIGNABLE_ROLES = [ROLE_OWNER, ...CLINICAL_ROLES]');
  });

  it('the owner UI offers every assignable role, not just leadership', () => {
    // Building the dropdown from LEADERSHIP_ROLES would leave chief_nurse
    // accepted by the rules but unassignable from the only screen that assigns.
    expect(read('public/js/app.js')).toContain('const roleOptions = CLINICAL_ROLES');
  });

  it('owner is the only role outside the clinical tier that is assignable', () => {
    expect(ASSIGNABLE_ROLES).toEqual([ROLE_OWNER, ...CLINICAL_ROLES]);
  });
});
