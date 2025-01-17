import { isAbsolute, relative } from 'path';
import slash = require('slash');
import { createHash } from 'crypto';
import {
  DaysToDecay,
  GenericLintData,
  Location,
  TodoConfig,
  TodoData,
  TodoDataV1,
  TodoDataV2,
  TodoDates,
  TodoFileFormat,
} from './types';
import { getDatePart } from './date-utils';

/**
 * Adapts a {@link https://github.com/ember-template-lint/ember-template-lint-todo-utils/blob/master/src/types/lint.ts#L31|LintResult} to a {@link https://github.com/ember-template-lint/ember-template-lint-todo-utils/blob/master/src/types/todo.ts#L61|TodoDataV2}. FilePaths are absolute
 * when received from a lint result, so they're converted to relative paths for stability in
 * serializing the contents to disc.
 *
 * @param lintResult - The lint result object.
 * @param lintMessage - A lint message object representing a specific violation for a file.
 * @param todoConfig - An object containing the warn or error days, in integers.
 * @returns - A {@link https://github.com/ember-template-lint/ember-template-lint-todo-utils/blob/master/src/types/todo.ts#L61|TodoDataV2} object.
 */
export function buildTodoDatum(
  baseDir: string,
  genericLintData: GenericLintData,
  todoConfig?: TodoConfig
): TodoDataV2 {
  // Note: If https://github.com/nodejs/node/issues/13683 is fixed, remove slash() and use posix.relative
  // provided that the fix is landed on the supported node versions of this lib
  const filePath = isAbsolute(genericLintData.filePath)
    ? relative(baseDir, genericLintData.filePath)
    : genericLintData.filePath;
  const todoDatum: TodoDataV2 = Object.assign(
    genericLintData,
    {
      source: generateHash(genericLintData.source),
      filePath: slash(filePath),
      fileFormat: TodoFileFormat.Version2,
    },
    getTodoDates(genericLintData.ruleId, todoConfig)
  );

  return todoDatum;
}

export function normalizeToV2(todoDatum: TodoData): TodoDataV2 {
  // if we have a range property, we're already in V2 format
  if ('range' in todoDatum) {
    todoDatum.fileFormat = TodoFileFormat.Version2;

    return <TodoDataV2>todoDatum;
  }

  const todoDatumV1 = <TodoDataV1>todoDatum;

  const todoDatumV2: TodoDataV2 = {
    engine: todoDatumV1.engine,
    filePath: todoDatumV1.filePath,
    ruleId: todoDatumV1.ruleId,
    range: getRange(todoDatumV1),
    source: '',
    createdDate: todoDatumV1.createdDate,
    fileFormat: TodoFileFormat.Version1,
  };

  if (todoDatumV1.warnDate) {
    todoDatumV2.warnDate = todoDatumV1.warnDate;
  }

  if (todoDatumV1.errorDate) {
    todoDatumV2.errorDate = todoDatumV1.errorDate;
  }

  return todoDatumV2;
}

export function generateHash(input: string, algorithm = 'sha1'): string {
  return createHash(algorithm).update(input).digest('hex');
}

function getTodoDates(ruleId: string, todoConfig?: TodoConfig): TodoDates {
  const createdDate = getCreatedDate();
  const todoDates: TodoDates = {
    createdDate: createdDate.getTime(),
  };
  const daysToDecay: DaysToDecay | undefined = getDaysToDecay(ruleId, todoConfig);

  if (daysToDecay?.warn) {
    todoDates.warnDate = addDays(createdDate, daysToDecay.warn).getTime();
  }

  if (daysToDecay?.error) {
    todoDates.errorDate = addDays(createdDate, daysToDecay.error).getTime();
  }

  return todoDates;
}

function getRange(loc: Location) {
  return {
    start: {
      line: loc.line,
      column: loc.column,
    },
    end: {
      // eslint-disable-next-line unicorn/no-null
      line: loc.endLine ?? loc.line,
      // eslint-disable-next-line unicorn/no-null
      column: loc.endColumn ?? loc.column,
    },
  };
}

function getDaysToDecay(ruleId: string, todoConfig?: TodoConfig) {
  if (!todoConfig) {
    return;
  }

  if (todoConfig?.daysToDecayByRule && todoConfig.daysToDecayByRule[ruleId]) {
    return todoConfig.daysToDecayByRule[ruleId];
  } else if (todoConfig?.daysToDecay) {
    return todoConfig.daysToDecay;
  }
}

function getCreatedDate(): Date {
  const date = process.env.TODO_CREATED_DATE ? new Date(process.env.TODO_CREATED_DATE) : new Date();

  return getDatePart(date);
}

function addDays(createdDate: Date, days: number): Date {
  const datePlusDays = new Date(createdDate.valueOf());

  datePlusDays.setDate(datePlusDays.getDate() + days);

  return datePlusDays;
}
