import { describe, it, expect, beforeEach } from 'vitest';
import { buildBackup, validateBackup, applyBackup, BACKUP_VERSION } from './backup';
import { SK, save, load } from './storage';

beforeEach(() => localStorage.clear());

describe('buildBackup', () => {
  it('collects only this app\'s keys, parsed to real JSON', () => {
    save('settings', { name: 'Hop Haus' });
    save('selR', 3);
    localStorage.setItem('unrelated_key', 'ignore me');

    const backup = buildBackup(new Date('2026-06-16T00:00:00Z'));

    expect(backup.app).toBe('slackers-brew');
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe('2026-06-16T00:00:00.000Z');
    expect(backup.data).toEqual({ settings: { name: 'Hop Haus' }, selR: 3 });
    expect(backup.data).not.toHaveProperty('unrelated_key');
  });

  it('produces empty data when nothing is stored', () => {
    expect(buildBackup().data).toEqual({});
  });
});

describe('validateBackup', () => {
  it('accepts a well-formed backup', () => {
    expect(validateBackup({ app: 'slackers-brew', version: 1, data: {} })).toBe(true);
  });

  it('rejects non-objects and foreign files', () => {
    expect(() => validateBackup(null)).toThrow(/valid JSON/i);
    expect(() => validateBackup({ app: 'something-else', data: {} })).toThrow(/Slackers Brew backup/i);
    expect(() => validateBackup({ app: 'slackers-brew' })).toThrow(/missing its data/i);
  });

  it('rejects a backup from a newer app version', () => {
    expect(() => validateBackup({ app: 'slackers-brew', version: BACKUP_VERSION + 1, data: {} }))
      .toThrow(/newer version/i);
  });
});

describe('applyBackup', () => {
  it('replaces existing app data with the backup contents', () => {
    save('settings', { name: 'Old Name' });
    save('selR', 9);

    applyBackup({ app: 'slackers-brew', version: 1, data: { settings: { name: 'New Name' } } });

    // restored key is written back in the app's storage format
    expect(load('settings', null)).toEqual({ name: 'New Name' });
    // keys not present in the backup are cleared
    expect(localStorage.getItem(SK + 'selR')).toBeNull();
  });

  it('round-trips build -> apply with no data loss', () => {
    save('malts', [{ n: '2-Row', q: 100 }]);
    save('settings', { name: 'Hop Haus', emoji: '🏭', logo: null });
    const backup = buildBackup();

    localStorage.clear();
    applyBackup(backup);

    expect(load('malts', null)).toEqual([{ n: '2-Row', q: 100 }]);
    expect(load('settings', null)).toEqual({ name: 'Hop Haus', emoji: '🏭', logo: null });
  });

  it('throws (and writes nothing) for an invalid backup', () => {
    save('selR', 1);
    expect(() => applyBackup({ app: 'nope' })).toThrow();
    expect(load('selR', null)).toBe(1); // untouched
  });
});
