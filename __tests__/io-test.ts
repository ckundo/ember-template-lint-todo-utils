import { existsSync, readdir, readdirSync, statSync } from 'fs-extra';
import { join, posix } from 'path';
import { subDays } from 'date-fns';
import {
  ensureTodoStorageDir,
  todoDirFor,
  todoFileNameFor,
  todoFilePathFor,
  todoStorageDirExists,
  writeTodos,
  getDatePart,
  getTodoStorageDirPath,
} from '../src';
import { LintResult, TodoDataV2, TodoFilePathHash } from '../src/types';
import { createTmpDir } from './__utils__/tmp-dir';
import { getFixture } from './__utils__/get-fixture';
import { getTodoBatches, readTodos } from '../src/io';
import TodoMatcher from '../src/todo-matcher';
import {
  buildMaybeTodos,
  buildExistingTodos,
  buildMaybeTodosFromFixture,
  buildExistingTodosFromFixture,
} from './__utils__/build-todo-data';

const TODO_DATA: TodoDataV2 = {
  engine: 'eslint',
  filePath: 'app/controllers/settings.js',
  ruleId: 'no-prototype-builtins',
  range: {
    start: {
      line: 25,
      column: 21,
    },
    end: {
      line: 25,
      column: 21,
    },
  },
  source: '',
  createdDate: getDatePart(new Date('12/11/2020')).getTime(),
  fileFormat: 2,
};

function readFiles(todoStorageDir: string) {
  const fileNames: string[] = [];
  const todoFileDirs = readdirSync(todoStorageDir);

  for (const todoFileDir of todoFileDirs) {
    const files = readdirSync(posix.join(todoStorageDir, todoFileDir)).map((file) =>
      posix.join(todoFileDir, file)
    );

    fileNames.push(...files);
  }

  return fileNames;
}

function chunk<T>(initial: Set<T>, firstChunk = 1): [Set<T>, Set<T>] {
  const fixtureArr = [...initial];
  const firstHalf = fixtureArr.slice(0, firstChunk);
  const secondHalf = fixtureArr.slice(firstChunk, fixtureArr.length);

  return [new Set(firstHalf), new Set(secondHalf)];
}

jest.setTimeout(100000);

describe('io', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTmpDir();
  });

  describe('todoStorageDirExists', () => {
    it('returns false when directory does not exist', async () => {
      expect(todoStorageDirExists(tmp)).toEqual(false);
    });

    it('returns true when directory exists sync', async () => {
      ensureTodoStorageDir(tmp);

      expect(todoStorageDirExists(tmp)).toEqual(true);
    });
  });

  describe('todoFileNameFor', () => {
    it('can generate a unique hash for todo', () => {
      const fileName = todoFileNameFor(TODO_DATA);

      expect(fileName).toEqual('6e3be839');
    });

    it('generates idempotent file names', () => {
      const fileName = todoFileNameFor(TODO_DATA);
      const secondFileName = todoFileNameFor(TODO_DATA);

      expect(fileName).toEqual('6e3be839');
      expect(secondFileName).toEqual('6e3be839');
    });
  });

  describe('todoDirFor', () => {
    it('can generate a unique dir hash for todo', () => {
      const dir = todoDirFor(TODO_DATA.filePath);

      expect(dir).toEqual('0a1e71cf4d0931e81f494d5a73a550016814e15a');
    });

    it('generates idempotent dir names', () => {
      const dir1 = todoDirFor(TODO_DATA.filePath);
      const dir2 = todoDirFor(TODO_DATA.filePath);

      expect(dir1).toEqual(dir2);
    });
  });

  describe('todoFilePathFor', () => {
    it('can generate a unique file path for todo', () => {
      const dir = todoFilePathFor(TODO_DATA);

      expect(dir).toEqual('0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839');
    });

    it('generates idempotent file paths', () => {
      const dir1 = todoFilePathFor(TODO_DATA);
      const dir2 = todoFilePathFor(TODO_DATA);

      expect(dir1).toEqual(dir2);
    });
  });

  describe('writeTodos', () => {
    it("creates .lint-todo directory if one doesn't exist", async () => {
      const todoDir = getTodoStorageDirPath(tmp);

      writeTodos(tmp, new Set());

      expect(existsSync(todoDir)).toEqual(true);
    });

    it("doesn't write files when no todos provided", async () => {
      const todoDir = getTodoStorageDirPath(tmp);

      writeTodos(tmp, new Set());

      expect(readFiles(todoDir)).toHaveLength(0);
    });

    it('generates todos when todos provided', async () => {
      const todoDir = getTodoStorageDirPath(tmp);
      const { addedCount } = writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'eslint-with-errors'));

      expect(addedCount).toEqual(18);
      expect(readFiles(todoDir)).toHaveLength(18);
    });

    it("generates todos only if previous todo doesn't exist", async () => {
      const initialTodos: LintResult[] = [
        {
          filePath: '{{path}}/app/controllers/settings.js',
          messages: [
            {
              ruleId: 'no-prototype-builtins',
              severity: 2,
              message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
              line: 25,
              column: 21,
              nodeType: 'CallExpression',
              messageId: 'prototypeBuildIn',
              endLine: 25,
              endColumn: 35,
            },
            {
              ruleId: 'no-prototype-builtins',
              severity: 2,
              message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
              line: 26,
              column: 19,
              nodeType: 'CallExpression',
              messageId: 'prototypeBuildIn',
              endLine: 26,
              endColumn: 33,
            },
          ],
          errorCount: 2,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: '',
          usedDeprecatedRules: [],
        },
      ];

      const todoDir = getTodoStorageDirPath(tmp);
      const { addedCount } = writeTodos(tmp, buildMaybeTodos(tmp, initialTodos));
      const initialFiles = readFiles(todoDir);

      expect(addedCount).toEqual(2);
      expect(initialFiles).toHaveLength(2);

      const initialFileStats = initialFiles.map((file) => {
        return {
          fileName: file,
          ctime: statSync(posix.join(todoDir, file)).ctime,
        };
      });

      writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'eslint-with-errors'));

      const subsequentFiles = readFiles(todoDir);

      expect(subsequentFiles).toHaveLength(18);

      initialFileStats.forEach((initialFileStat) => {
        const subsequentFile = statSync(posix.join(todoDir, initialFileStat.fileName));

        expect(subsequentFile.ctime).toEqual(initialFileStat.ctime);
      });
    });

    it('removes old todos if todos no longer contains violations', async () => {
      const fixture = buildMaybeTodosFromFixture(tmp, 'eslint-with-errors');
      const todoDir = getTodoStorageDirPath(tmp);

      const { addedCount } = writeTodos(tmp, fixture);

      const initialFiles = readFiles(todoDir);

      expect(addedCount).toEqual(18);
      expect(initialFiles).toHaveLength(18);

      const [firstHalf, secondHalf] = chunk(fixture, 3);

      const { removedCount } = writeTodos(tmp, new Set(firstHalf));

      const subsequentFiles = readFiles(todoDir);

      expect(removedCount).toEqual(15);
      expect(subsequentFiles).toHaveLength(3);

      secondHalf.forEach((todoDatum) => {
        expect(!existsSync(posix.join(todoDir, `${todoFilePathFor(todoDatum)}.json`))).toEqual(
          true
        );
      });
    });

    it('does not remove old todos if todos no longer contains violations if shouldRemove returns false', async () => {
      const fixture = buildMaybeTodosFromFixture(tmp, 'eslint-with-errors');
      const todoDir = getTodoStorageDirPath(tmp);

      const { addedCount } = writeTodos(tmp, fixture);

      const initialFiles = readFiles(todoDir);

      expect(addedCount).toEqual(18);
      expect(initialFiles).toHaveLength(18);

      const [firstHalf] = chunk(fixture, 3);

      const { removedCount } = writeTodos(tmp, firstHalf, { shouldRemove: () => false });

      const subsequentFiles = readFiles(todoDir);

      expect(removedCount).toEqual(0);
      expect(subsequentFiles).toHaveLength(18);
    });
  });

  describe('writeTodos for single file', () => {
    it('generates todos for a specific filePath', async () => {
      const todoDir = getTodoStorageDirPath(tmp);
      const { addedCount } = writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'single-file-todo'), {
        filePath: 'app/controllers/settings.js',
      });

      expect(addedCount).toEqual(3);
      expect(readFiles(todoDir)).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25.json",
        ]
      `);
    });

    it('updates todos for a specific filePath', async () => {
      const todoDir = getTodoStorageDirPath(tmp);
      const { addedCount } = writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'single-file-todo'), {
        filePath: 'app/controllers/settings.js',
      });

      expect(addedCount).toEqual(3);
      expect(readFiles(todoDir)).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25.json",
        ]
      `);

      const counts = writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'single-file-todo-updated'), {
        filePath: 'app/controllers/settings.js',
      });

      expect(counts).toStrictEqual({
        addedCount: 1,
        expiredCount: 0,
        removedCount: 1,
        stableCount: 2,
      });
      expect(readFiles(todoDir)).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/d1917978.json",
        ]
      `);
    });

    it('deletes todos for a specific filePath', async () => {
      const todoDir = getTodoStorageDirPath(tmp);
      const { addedCount } = writeTodos(tmp, buildMaybeTodosFromFixture(tmp, 'single-file-todo'), {
        filePath: 'app/controllers/settings.js',
      });

      expect(addedCount).toEqual(3);
      expect(readFiles(todoDir)).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839.json",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25.json",
        ]
      `);

      const { addedCount: addedCount2, removedCount } = writeTodos(
        tmp,
        buildMaybeTodosFromFixture(tmp, 'single-file-no-errors'),
        {
          filePath: 'app/controllers/settings.js',
        }
      );

      expect(addedCount2).toEqual(0);
      expect(removedCount).toEqual(3);
      expect(readFiles(todoDir)).toHaveLength(0);
      expect(await readdir(todoDir)).toHaveLength(0);
    });
  });

  describe('getTodoBatches', () => {
    it('generates no batches when lint results are empty', () => {
      const counts = getTodoBatches(new Set(), new Map(), {
        shouldRemove: () => true,
      });

      expect(counts).toMatchInlineSnapshot(`
        Object {
          "add": Map {},
          "expired": Map {},
          "remove": Map {},
          "stable": Map {},
        }
      `);
    });

    it('creates items to add', async () => {
      const { add } = getTodoBatches(buildMaybeTodosFromFixture(tmp, 'new-batches'), new Map(), {
        shouldRemove: () => true,
      });

      expect([...add.keys()]).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/b9046d34",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/092271fa",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/cc71e5f9",
        ]
      `);
    });

    it('creates items to remove', async () => {
      const { remove } = getTodoBatches(
        new Set(),
        buildExistingTodos(tmp, getFixture('new-batches', tmp, false)),
        {
          shouldRemove: () => true,
        }
      );

      expect([...remove.keys()]).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/b9046d34",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/092271fa",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/cc71e5f9",
        ]
      `);
    });

    it('creates items to expire', async () => {
      const expiredBatches: Map<TodoFilePathHash, TodoMatcher> = buildExistingTodos(
        tmp,
        getFixture('new-batches', tmp, false)
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const expiredTodo: TodoDataV2 = expiredBatches
        .get('60a67ad5c653f5b1a6537d9a6aee56c0662c0e35')!
        .find('cc71e5f9')!;

      expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

      // eslint-disable-next-line unicorn/no-unreadable-array-destructuring
      const { expired } = getTodoBatches(
        buildMaybeTodosFromFixture(tmp, 'new-batches'),
        expiredBatches,
        {
          shouldRemove: () => true,
        }
      );

      expect([...expired.keys()]).toMatchInlineSnapshot(`
        Array [
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/cc71e5f9",
        ]
      `);
    });

    it('creates all batches', async () => {
      const existingBatches: Map<TodoFilePathHash, TodoMatcher> = buildExistingTodosFromFixture(
        tmp,
        'existing-batches'
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const expiredTodo: TodoDataV2 = existingBatches
        .get('60a67ad5c653f5b1a6537d9a6aee56c0662c0e35')!
        .find('cc71e5f9')!;

      expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

      const { add, remove, stable, expired } = getTodoBatches(
        buildMaybeTodosFromFixture(tmp, 'new-batches'),
        existingBatches,
        { shouldRemove: () => true }
      );

      expect([...add.keys()]).toMatchInlineSnapshot(`
        Array [
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/6e3be839",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/aad8bc25",
          "0a1e71cf4d0931e81f494d5a73a550016814e15a/53e7a9a0",
        ]
      `);
      expect([...remove.keys()]).toMatchInlineSnapshot(`
        Array [
          "07d3818b8afefcdd7db6d52743309fdbb85313f0/66256fb7",
          "07d3818b8afefcdd7db6d52743309fdbb85313f0/8fd35486",
        ]
      `);
      expect([...stable.keys()]).toMatchInlineSnapshot(`
        Array [
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/b9046d34",
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/092271fa",
        ]
      `);
      expect([...expired.keys()]).toMatchInlineSnapshot(`
        Array [
          "60a67ad5c653f5b1a6537d9a6aee56c0662c0e35/cc71e5f9",
        ]
      `);
    });

    it('creates stable batches for fuzzy matches', () => {
      process.env.TODO_CREATED_DATE = new Date(2015, 1, 23).toJSON();

      const lintResults = getFixture('eslint-exact-matches', tmp, false);
      let existingTodos: Map<TodoFilePathHash, TodoMatcher> = buildExistingTodos(tmp, lintResults);

      let counts = getTodoBatches(buildMaybeTodos(tmp, lintResults), existingTodos, {
        shouldRemove: () => true,
      });

      expect(counts.add.size).toEqual(0);
      expect(counts.remove.size).toEqual(0);
      expect(counts.stable.size).toEqual(4);
      expect(counts.expired.size).toEqual(0);

      const lintResultsWithChangedLineCol = getFixture('eslint-fuzzy-matches', tmp, false);
      existingTodos = buildExistingTodos(tmp, lintResults);
      counts = getTodoBatches(buildMaybeTodos(tmp, lintResultsWithChangedLineCol), existingTodos, {
        shouldRemove: () => true,
      });

      expect(counts.add.size).toEqual(0);
      expect(counts.remove.size).toEqual(0);
      expect(counts.stable.size).toEqual(4);
      expect(counts.expired.size).toEqual(0);
    });

    it('creates add batch for matches when source changes', () => {
      process.env.TODO_CREATED_DATE = new Date(2015, 1, 23).toJSON();

      const lintResults = getFixture('eslint-no-fuzzy-source-prechange', tmp, false);
      let existingTodos: Map<TodoFilePathHash, TodoMatcher> = buildExistingTodos(tmp, lintResults);

      let counts = getTodoBatches(buildMaybeTodos(tmp, lintResults), existingTodos, {
        shouldRemove: () => true,
      });

      expect(counts.add.size).toEqual(0);
      expect(counts.remove.size).toEqual(0);
      expect(counts.stable.size).toEqual(4);
      expect(counts.expired.size).toEqual(0);

      const lintResultsWithSourceChanged = getFixture('eslint-no-fuzzy-source-changed', tmp, false);
      existingTodos = buildExistingTodos(tmp, lintResults);
      counts = getTodoBatches(buildMaybeTodos(tmp, lintResultsWithSourceChanged), existingTodos, {
        shouldRemove: () => true,
      });

      expect(counts.add.size).toEqual(1);
      expect(counts.remove.size).toEqual(1);
      expect(counts.stable.size).toEqual(3);
      expect(counts.expired.size).toEqual(0);
    });

    describe('v1 file format', () => {
      it(`creates only stable and expired batches for exact match`, async () => {
        const fixtureDir = join(__dirname, '__fixtures__', 'v1');
        const existingBatches: Map<TodoFilePathHash, TodoMatcher> = readTodos(fixtureDir);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expiredTodo: TodoDataV2 = existingBatches
          .get('d47704143ff2aa8b05d66fc59e790e126b7b3603')!
          .find('0c1a00af')!;

        expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

        const { add, remove, stable, expired } = getTodoBatches(
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-exact-match'),
          existingBatches,
          { shouldRemove: () => true }
        );

        expect([...add.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...remove.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...stable.keys()]).toMatchInlineSnapshot(`
          Array [
            "68e22b32dc9da5964fc73d75680c1cfad9532912/da773fcf",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/fb219dc1",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/ce6ecd57",
            "b6f600233b5a01e7165bcaf27ea6730b6213f331/fb17ee16",
          ]
        `);
        expect([...expired.keys()]).toMatchInlineSnapshot(`
          Array [
            "d47704143ff2aa8b05d66fc59e790e126b7b3603/0c1a00af",
          ]
        `);
      });

      it(`creates add and remove batches when fuzzy match doesn't match`, async () => {
        const fixtureDir = join(__dirname, '__fixtures__', 'v1');
        const existingBatches: Map<TodoFilePathHash, TodoMatcher> = readTodos(fixtureDir);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expiredTodo: TodoDataV2 = existingBatches
          .get('d47704143ff2aa8b05d66fc59e790e126b7b3603')!
          .find('0c1a00af')!;

        expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

        const { add, remove, stable, expired } = getTodoBatches(
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-fuzzy-match'),
          existingBatches,
          { shouldRemove: () => true }
        );

        expect([...add.keys()]).toMatchInlineSnapshot(`
          Array [
            "68e22b32dc9da5964fc73d75680c1cfad9532912/fdb13165",
          ]
        `);
        expect([...remove.keys()]).toMatchInlineSnapshot(`
          Array [
            "68e22b32dc9da5964fc73d75680c1cfad9532912/da773fcf",
          ]
        `);
        expect([...stable.keys()]).toMatchInlineSnapshot(`
          Array [
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/fb219dc1",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/ce6ecd57",
            "b6f600233b5a01e7165bcaf27ea6730b6213f331/fb17ee16",
          ]
        `);
        expect([...expired.keys()]).toMatchInlineSnapshot(`
          Array [
            "d47704143ff2aa8b05d66fc59e790e126b7b3603/0c1a00af",
          ]
        `);
      });
    });

    describe('v2 file format', () => {
      it(`creates only stable and expired batches for exact match`, async () => {
        const { addedCount } = writeTodos(
          tmp,
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-exact-match')
        );

        expect(addedCount).toEqual(5);

        const existing: Map<TodoFilePathHash, TodoMatcher> = readTodos(tmp);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expiredTodo: TodoDataV2 = existing
          .get('d47704143ff2aa8b05d66fc59e790e126b7b3603')!
          .find('0c1a00af')!;

        expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

        const { add, remove, stable, expired } = getTodoBatches(
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-exact-match'),
          existing,
          { shouldRemove: () => true }
        );

        expect([...add.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...remove.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...stable.keys()]).toMatchInlineSnapshot(`
          Array [
            "68e22b32dc9da5964fc73d75680c1cfad9532912/da773fcf",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/fb219dc1",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/ce6ecd57",
            "b6f600233b5a01e7165bcaf27ea6730b6213f331/fb17ee16",
          ]
        `);
        expect([...expired.keys()]).toMatchInlineSnapshot(`
          Array [
            "d47704143ff2aa8b05d66fc59e790e126b7b3603/0c1a00af",
          ]
        `);
      });

      it(`creates only stable and expired batches for fuzzy match`, async () => {
        const { addedCount } = writeTodos(
          tmp,
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-exact-match')
        );

        expect(addedCount).toEqual(5);

        const existing: Map<TodoFilePathHash, TodoMatcher> = readTodos(tmp);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expiredTodo: TodoDataV2 = existing
          .get('d47704143ff2aa8b05d66fc59e790e126b7b3603')!
          .find('0c1a00af')!;

        expiredTodo.errorDate = subDays(getDatePart(), 1).getTime();

        const { add, remove, stable, expired } = getTodoBatches(
          buildMaybeTodosFromFixture(tmp, 'eslint-with-errors-fuzzy-match'),
          existing,
          { shouldRemove: () => true }
        );

        expect([...add.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...remove.keys()]).toMatchInlineSnapshot(`Array []`);
        expect([...stable.keys()]).toMatchInlineSnapshot(`
          Array [
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/fb219dc1",
            "a0b23a0fa099c0ae674ec53a04fc6a6278526141/ce6ecd57",
            "b6f600233b5a01e7165bcaf27ea6730b6213f331/fb17ee16",
            "68e22b32dc9da5964fc73d75680c1cfad9532912/da773fcf",
          ]
        `);
        expect([...expired.keys()]).toMatchInlineSnapshot(`
          Array [
            "d47704143ff2aa8b05d66fc59e790e126b7b3603/0c1a00af",
          ]
        `);
      });
    });
  });
});
