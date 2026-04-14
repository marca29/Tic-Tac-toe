/*
  GAME BOARD COMPONENT - Interactive Tic-Tac-Toe Grid
  ====================================================
  Renders 3x3 board with hover effects, win states, and click handling
 */
import styles from "./Board.module.css";

interface BoardProps {
  board: (string | null)[]; // Current board state [null, "X", "O", ...]
  onClick: (index: number) => void; // Move handler
}

export default function Board({ board, onClick }: BoardProps) {
  /*
    CHECK IF GAME IS FINISHED
    All 9 cells filled = draw or game over
   */
  const isFinished = board.every((cell) => cell !== null);

  return (
    <div className={styles.wrapper}>
      {/* 9 CELLS - 3x3 GRID */}
      {board.map((cell, i) => (
        <div
          key={i}
          className={`
            ${styles.cell}
            ${cell ? (cell === "X" ? styles.x : styles.o) : ""}
            ${isFinished ? styles.disabled : ""}
          `}
          onClick={() => !isFinished && onClick(i)} // Only clickable if not finished
        >
          {cell} {/* X, O, or empty */}
        </div>
      ))}
    </div>
  );
}
