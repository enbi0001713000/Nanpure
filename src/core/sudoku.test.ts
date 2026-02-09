import { describe, expect, it } from 'vitest';
import { getConflicts, isCompleteAndValid, toGrid } from './sudoku';

describe('sudoku helpers', () => {
  it('detects conflicts', () => {
    const grid = toGrid('550070000600195000098000060800060003400803001700020006060000280000419005000080079');
    const conflicts = getConflicts(grid);
    expect(conflicts[0][0]).toBe(true);
    expect(conflicts[0][1]).toBe(true);
  });

  it('validates solved puzzle', () => {
    const solved = toGrid('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
    expect(isCompleteAndValid(solved)).toBe(true);
  });
});
