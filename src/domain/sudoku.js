import {
	cloneGrid,
	cloneSudokuJSON,
	findInvalidCellKeys,
	formatGrid,
	isSolvedGrid,
	validateMove,
} from './utils.js';

export function createSudoku(puzzleGrid, currentGrid = puzzleGrid) {
	const puzzle = cloneGrid(puzzleGrid);
	let grid = cloneGrid(currentGrid);

	return {
		getGrid() {
			return cloneGrid(grid);
		},

		getPuzzleGrid() {
			return cloneGrid(puzzle);
		},

		isFixedCell(row, col) {
			return puzzle[row][col] !== 0;
		},

		guess(move) {
			validateMove(move);

			const { row, col, value } = move;
			if (this.isFixedCell(row, col) || grid[row][col] === value) {
				return false;
			}

			grid = cloneGrid(grid);
			grid[row][col] = value;
			return true;
		},

		getInvalidCells() {
			return findInvalidCellKeys(grid);
		},

		isSolved() {
			return isSolvedGrid(grid);
		},

		clone() {
			return createSudokuFromJSON(this.toJSON());
		},

		toJSON() {
			return {
				puzzleGrid: cloneGrid(puzzle),
				currentGrid: cloneGrid(grid),
			};
		},

		toString() {
			return formatGrid(grid);
		},
	};
}

export function createSudokuFromJSON(json) {
	const { puzzleGrid, currentGrid } = cloneSudokuJSON(json);
	return createSudoku(puzzleGrid, currentGrid);
}
