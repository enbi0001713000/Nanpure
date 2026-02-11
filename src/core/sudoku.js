export function toGrid(serialized) {
    const values = serialized.split('').map((v) => Number(v));
    const grid = [];
    for (let r = 0; r < 9; r++) {
        grid.push(values.slice(r * 9, r * 9 + 9));
    }
    return grid;
}
export function isValidPlacement(grid, row, col, value) {
    if (value === 0)
        return true;
    for (let c = 0; c < 9; c++) {
        if (c !== col && grid[row][c] === value)
            return false;
    }
    for (let r = 0; r < 9; r++) {
        if (r !== row && grid[r][col] === value)
            return false;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
            if ((r !== row || c !== col) && grid[r][c] === value)
                return false;
        }
    }
    return true;
}
export function getCandidates(grid, row, col) {
    if (grid[row][col] !== 0)
        return [];
    const candidates = [];
    for (let value = 1; value <= 9; value++) {
        if (isValidPlacement(grid, row, col, value))
            candidates.push(value);
    }
    return candidates;
}
export function getConflicts(grid) {
    const conflicts = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => false));
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const value = grid[r][c];
            if (value !== 0 && !isValidPlacement(grid, r, c, value)) {
                conflicts[r][c] = true;
            }
        }
    }
    return conflicts;
}
export function isCompleteAndValid(grid) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const value = grid[r][c];
            if (value === 0 || !isValidPlacement(grid, r, c, value)) {
                return false;
            }
        }
    }
    return true;
}
export function isPeer(a, b) {
    if (a.r === b.r || a.c === b.c)
        return true;
    return Math.floor(a.r / 3) === Math.floor(b.r / 3) && Math.floor(a.c / 3) === Math.floor(b.c / 3);
}
