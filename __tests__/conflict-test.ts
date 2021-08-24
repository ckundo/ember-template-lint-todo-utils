import { resolveConflict } from '../src/git-utils';
import { readFileSync } from 'fs';

describe('merge conflict resolution', () => {
  describe('with an addition and a deletion', () => {
    it('resolves the conflict', () => {
      const conflict = readFileSync('__tests__/__fixtures__/lockfiles/.lint-todo.additions-removals.conflict.lock', 'utf-8');
      const expected = readFileSync('__tests__/__fixtures__/lockfiles/.lint-todo.additions-removals.resolved.lock', 'utf-8');

      const resolved = resolveConflict(conflict);

      expect(resolved).toEqual(expected);
    });
  });

  describe('with multiple additions and deletions', () => {
    it('resolves the conflict', () => {
      const conflict = readFileSync('__tests__/__fixtures__/lockfiles/.lint-todo.multiple-additions.conflict.lock', 'utf-8');
      const expected = readFileSync('__tests__/__fixtures__/lockfiles/.lint-todo.multiple-additions.resolved.lock', 'utf-8');

      const resolved = resolveConflict(conflict);

      expect(resolved).toEqual(expected);
    });
  });
});
