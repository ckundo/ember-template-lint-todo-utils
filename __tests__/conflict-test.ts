import { resolveConflict } from '../src/git-utils';
import { readFileSync } from 'fs';

describe('merge conflict resolution', () => {
  describe('given a branch that a 2 todos', () => {
    describe('merging a branch with empty todos', () => {
      it('results in a file with 2 todos', () => {
        const conflict = readFileSync(
          '__tests__/__fixtures__/lockfiles/.lint-todo.additions-removals.conflict.lock',
          'utf-8'
        );
        const expected = readFileSync(
          '__tests__/__fixtures__/lockfiles/.lint-todo.additions-removals.resolved.lock',
          'utf-8'
        );

        const resolved = resolveConflict(conflict);
        expect(resolved).toEqual(expected);
      });
    });
  });

  describe('given a branch that 1 todo', () => {
    describe('merging a branch that updates that same todo', () => {
      it('resolved the conflict with the current changes (HEAD)', () => {
        const conflict = readFileSync(
          '__tests__/__fixtures__/lockfiles/.lint-todo.multiple-additions.conflict.lock',
          'utf-8'
        );
        const expected = readFileSync(
          '__tests__/__fixtures__/lockfiles/.lint-todo.multiple-additions.resolved.lock',
          'utf-8'
        );

        const resolved = resolveConflict(conflict);

        expect(resolved).toEqual(expected);
      });
    });
  });
});
