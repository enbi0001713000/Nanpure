import test from 'node:test';
import assert from 'node:assert/strict';
import { getConflicts, isCompleteAndValid, toGrid } from './sudoku.js';

test('detects row conflicts', () => {
  const grid = toGrid('550070000600195000098000060800060003400803001700020006060000280000419005000080079');
  const conflicts = getConflicts(grid);
  assert.equal(conflicts[0][0], true);
  assert.equal(conflicts[0][1], true);
});

test('validates solved puzzle', () => {
  const solved = toGrid('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  assert.equal(isCompleteAndValid(solved), true);
});
