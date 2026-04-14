import { createSudokuFromJSON } from './sudoku.js';
import { cloneHistory } from './utils.js';

function createGameState({ sudoku, undoStack = [], redoStack = [] }) {
	if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.toJSON !== 'function') {
		throw new Error('Game requires a sudoku domain object');
	}

	let currentSudoku = sudoku.clone();
	let previousStates = cloneHistory(undoStack);
	let nextStates = cloneHistory(redoStack);

	const snapshot = () => currentSudoku.toJSON();

	return {
		getSudoku() {
			return currentSudoku;
		},

		guess(move) {
			const beforeMove = snapshot();
			const changed = currentSudoku.guess(move);

			if (!changed) {
				return false;
			}

			previousStates = [...previousStates, beforeMove];
			nextStates = [];
			return true;
		},

		undo() {
			if (previousStates.length === 0) {
				return false;
			}

			const previous = previousStates[previousStates.length - 1];
			previousStates = previousStates.slice(0, -1);
			nextStates = [...nextStates, snapshot()];
			currentSudoku = createSudokuFromJSON(previous);
			return true;
		},

		redo() {
			if (nextStates.length === 0) {
				return false;
			}

			const next = nextStates[nextStates.length - 1];
			nextStates = nextStates.slice(0, -1);
			previousStates = [...previousStates, snapshot()];
			currentSudoku = createSudokuFromJSON(next);
			return true;
		},

		canUndo() {
			return previousStates.length > 0;
		},

		canRedo() {
			return nextStates.length > 0;
		},

		toJSON() {
			return {
				sudoku: snapshot(),
				undoStack: cloneHistory(previousStates),
				redoStack: cloneHistory(nextStates),
			};
		},
	};
}

export function createGame({ sudoku }) {
	return createGameState({ sudoku });
}

export function createGameFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new Error('Game JSON must be an object');
	}

	return createGameState({
		sudoku: createSudokuFromJSON(json.sudoku),
		undoStack: json.undoStack ?? [],
		redoStack: json.redoStack ?? [],
	});
}
