const BOX_SIZE = 3;
const SUDOKU_SIZE = 9;

export function createEmptyGrid() {
	return Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0));
}

export function validateGrid(grid) {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new Error('Sudoku grid must be a 9x9 array');
	}

	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
			throw new Error('Sudoku grid must be a 9x9 array');
		}

		for (const cell of row) {
			if (!Number.isInteger(cell) || cell < 0 || cell > SUDOKU_SIZE) {
				throw new Error('Sudoku cells must be integers between 0 and 9');
			}
		}
	}
}

export function cloneGrid(grid) {
	validateGrid(grid);
	return grid.map((row) => row.slice());
}

export function validateMove(move) {
	if (!move || typeof move !== 'object') {
		throw new Error('Move must be an object');
	}

	const { row, col, value } = move;

	if (!Number.isInteger(row) || row < 0 || row >= SUDOKU_SIZE) {
		throw new Error('Move row must be an integer between 0 and 8');
	}

	if (!Number.isInteger(col) || col < 0 || col >= SUDOKU_SIZE) {
		throw new Error('Move col must be an integer between 0 and 8');
	}

	if (!Number.isInteger(value) || value < 0 || value > SUDOKU_SIZE) {
		throw new Error('Move value must be an integer between 0 and 9');
	}
}

export function cloneSudokuJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new Error('Sudoku JSON must be an object');
	}

	const puzzleGrid = cloneGrid(json.puzzleGrid ?? json.initialGrid ?? json.grid);
	const currentGrid = cloneGrid(json.currentGrid ?? json.grid ?? puzzleGrid);

	return {
		puzzleGrid,
		currentGrid,
	};
}

export function cloneHistory(history = []) {
	return history.map((snapshot) => cloneSudokuJSON(snapshot));
}

export function findInvalidCellKeys(grid) {
	validateGrid(grid);

	const invalidCells = new Set();

	const addInvalid = (row, col) => {
		invalidCells.add(`${col},${row}`);
	};

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const value = grid[row][col];
			if (value === 0) continue;

			for (let index = 0; index < SUDOKU_SIZE; index++) {
				if (index !== col && grid[row][index] === value) {
					addInvalid(row, col);
					addInvalid(row, index);
				}

				if (index !== row && grid[index][col] === value) {
					addInvalid(row, col);
					addInvalid(index, col);
				}
			}

			const startRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
			const startCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

			for (let boxRow = startRow; boxRow < startRow + BOX_SIZE; boxRow++) {
				for (let boxCol = startCol; boxCol < startCol + BOX_SIZE; boxCol++) {
					if (boxRow === row && boxCol === col) continue;

					if (grid[boxRow][boxCol] === value) {
						addInvalid(row, col);
						addInvalid(boxRow, boxCol);
					}
				}
			}
		}
	}

	return Array.from(invalidCells);
}

export function isSolvedGrid(grid) {
	validateGrid(grid);

	for (const row of grid) {
		for (const cell of row) {
			if (cell === 0) {
				return false;
			}
		}
	}

	return findInvalidCellKeys(grid).length === 0;
}

export function formatGrid(grid) {
	validateGrid(grid);

	const divider = '+-------+-------+-------+';
	const lines = [divider];

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		const cells = grid[row].map((value) => (value === 0 ? '.' : String(value)));
		lines.push(`| ${cells.slice(0, 3).join(' ')} | ${cells.slice(3, 6).join(' ')} | ${cells.slice(6, 9).join(' ')} |`);

		if ((row + 1) % BOX_SIZE === 0) {
			lines.push(divider);
		}
	}

	return lines.join('\n');
}
