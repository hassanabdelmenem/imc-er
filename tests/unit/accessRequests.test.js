import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression cover for the two defects that let a new sign-up be simultaneously
 * unable to log in and invisible to the owner:
 *
 *  1. `ensureUserRecord` swallowed every write failure, so an access request
 *     that never reached Firestore was reported to the user as "pending owner
 *     approval" — a queue the owner could never see them in.
 *  2. The Owner tab rendered one flat, document-id-ordered grid with no
 *     approval queue, so a pending card was indistinguishable from staff and
 *     sat at an arbitrary position in the list.
 */

const firestoreMocks = {
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn((_db, _col, id) => ({ id })),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(async () => undefined),
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
};

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({})),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn()
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => firestoreMocks);

const { ensureUserRecord, getUserRole } = await import('../../public/js/firebase-service.js');
const { partitionAccounts } = await import('../../public/js/app.js');

const snapshot = (data) => ({ exists: () => data !== null, data: () => data });

beforeEach(() => {
  firestoreMocks.setDoc.mockClear();
  firestoreMocks.getDoc.mockReset();
});

describe('Access requests: filing a new sign-up', () => {
  it('writes a pending record for an account with no document yet', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot(null));

    const result = await ensureUserRecord('uid-1', 'new.doctor@imc.com');

    expect(result).toMatchObject({ ok: true, created: true });
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    const written = firestoreMocks.setDoc.mock.calls[0][1];
    expect(written.role).toBe('pending');
    expect(written.email).toBe('new.doctor@imc.com');
    expect(written.createdAt).toBeTruthy();
  });

  it('reports failure instead of swallowing it when the write is rejected', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot(null));
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    const result = await ensureUserRecord('uid-2', 'blocked-by-rules@imc.com');

    // The caller has to be able to tell "request filed" from "request lost";
    // returning ok:true here is what produced a false pending-approval screen.
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('reports failure when the record cannot even be read', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('unavailable'));

    const result = await ensureUserRecord('uid-3', 'offline@imc.com');

    expect(result.ok).toBe(false);
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it('backfills role and email on a half-written record instead of skipping it', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot({ createdAt: '2026-08-01T00:00:00.000Z' }));

    const result = await ensureUserRecord('uid-4', 'half.written@imc.com');

    expect(result).toMatchObject({ ok: true, created: false, repaired: true });
    const patch = firestoreMocks.setDoc.mock.calls[0][1];
    expect(patch.role).toBe('pending');
    expect(patch.email).toBe('half.written@imc.com');
    // An owner-assigned createdAt must survive.
    expect(patch.createdAt).toBeUndefined();
  });

  it('never overwrites a role the owner already assigned', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot({
      role: 'medical_director',
      createdAt: '2026-08-01T00:00:00.000Z'
    }));

    await ensureUserRecord('uid-5', 'director@imc.com', 'pending');

    const patch = firestoreMocks.setDoc.mock.calls[0][1];
    expect(patch.role).toBeUndefined();
    expect(patch.email).toBe('director@imc.com');
  });

  it('writes nothing when the record is already complete', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot({
      role: 'pending',
      email: 'already@imc.com',
      createdAt: '2026-08-01T00:00:00.000Z'
    }));

    const result = await ensureUserRecord('uid-6', 'already@imc.com');

    expect(result).toMatchObject({ ok: true, created: false, repaired: false });
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });
});

describe('Access requests: reading a role', () => {
  it('returns null for an account with no record', async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot(null));
    await expect(getUserRole('uid-7')).resolves.toBeNull();
  });

  it('throws on a failed read rather than passing it off as a new sign-up', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    await expect(getUserRole('uid-8')).rejects.toThrow('PERMISSION_DENIED');
  });
});

describe('Owner view: the approval queue', () => {
  const roster = [
    { id: 'a', email: 'director@imc.com', role: 'medical_director' },
    { id: 'b', email: 'old.request@imc.com', role: 'pending', createdAt: '2026-08-01T09:00:00.000Z' },
    { id: 'c', email: 'hassan.abdelmenem@gmail.com', role: 'owner' },
    { id: 'd', email: 'new.request@imc.com', role: 'pending', createdAt: '2026-08-10T09:00:00.000Z' },
    { id: 'e', email: 'revoked@imc.com', role: 'blocked' }
  ];

  it('separates access requests from the staff roster', () => {
    const { owners, pending, staff } = partitionAccounts(roster);

    expect(pending.map(u => u.email)).toEqual(['new.request@imc.com', 'old.request@imc.com']);
    expect(owners.map(u => u.id)).toEqual(['c']);
    expect(staff.map(u => u.email)).toEqual(['revoked@imc.com', 'director@imc.com']);
  });

  it('queues a record whose role never got written', () => {
    const { pending } = partitionAccounts([{ id: 'x', email: 'roleless@imc.com' }]);
    expect(pending.map(u => u.id)).toEqual(['x']);
  });

  it('keeps the owner out of the approval queue even if their record says pending', () => {
    const { owners, pending } = partitionAccounts([
      { id: 'o', email: 'hassan.abdelmenem@gmail.com', role: 'pending' }
    ]);
    expect(pending).toHaveLength(0);
    expect(owners).toHaveLength(1);
  });
});
