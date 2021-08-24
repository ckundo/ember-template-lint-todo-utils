// Inspired by https://github.com/hjylewis/esplint/blob/master/lib/gitConflict.js

const PARENT_RE = /\|{7,}/g;
const OURS_RE = /<{7,}/g;
const THEIRS_RE = /={7,}/g;
const END_RE = />{7,}/g;
const LINE_RE = /[\n\r]+/g;

enum States {
  common = 'common',
  parent = 'parent',
  ours = 'ours',
  theirs = 'theirs',
}

export function resolveConflict(content: string): string {
  let state = States.common;
  const ours: string[] = [];
  const theirs: string[] = [];

  content.split(LINE_RE).forEach((line) => {
    if (line.match(PARENT_RE)) {
      state = States.parent;
    } else if (line.match(OURS_RE)) {
      state = States.ours;
    } else if (line.match(THEIRS_RE)) {
      state = States.theirs;
    } else if (line.match(END_RE)) {
      state = States.common;
    } else {
      if (state === 'common' || state === 'ours') {
        ours.push(line);
      }

      if (state === 'common' || state === 'theirs') {
        theirs.push(line);
      }
    }
  });

  console.log(ours, theirs);
  return [...ours, ...theirs].join('\n\r');
}
