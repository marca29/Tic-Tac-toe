/*
  MAIN APP COMPONENT - Orchestrates entire game flow
  ===================================================
  Manages: Auth -> Lobby -> Game -> Results
 */
import { useEffect, useState } from "react";
import AuthPage from "./AuthPage";
import Board from "./Board";
import Lobby from "./Lobby";
import { socket } from "./socket";
import styles from "./App.module.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function App() {
  // GLOBAL GAME STATE
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [inLobby, setInLobby] = useState(true);
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState<"X" | "O" | null>(null);
  const [status, setStatus] = useState("in_progress");
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [gameReason, setGameReason] = useState<string | null>(null);

  /*
    CREATE NEW GAME (as Player X)
   */
  const newGame = async () => {
    // Reset game state
    setBoard(Array(9).fill(null));
    setStatus("in_progress");
    setWinnerId(null);
    setMySymbol("X");
    setInLobby(false);

    const res = await fetch(`${API}/games/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setGameId(data.id);
  };

  /*
    RETURN TO LOBBY
   */
  const goToLobby = () => {
    setGameId(null);
    setBoard(Array(9).fill(null));
    setStatus("in_progress");
    setWinnerId(null);
    setInLobby(true);
  };

  /*
    LOGIN HANDLER
   */
  const handleLogin = (u: any, t: string) => {
    setUser(u);
    setToken(t);
  };

  /*
    JOIN GAME HANDLER (as Player O)
   */
  const handleJoin = (id: number) => {
    setGameId(id);
    setInLobby(false);
    setMySymbol("O");
  };

  /*
    SOCKET EVENT HANDLERS - Real-time updates
   */
  useEffect(() => {
    if (!gameId || !user) return;

    const handleGameUpdate = (newBoard: (string | null)[]) => {
      setBoard([...newBoard]);
    };

    const handleGameOver = ({ winnerId, board, reason }: any) => {
      setBoard(board || []);
      setWinnerId(winnerId);
      setStatus(reason === "abandoned" ? "abandoned" : "finished");
      setGameReason(reason);
    };

    // Join game room
    socket.emit("join_game", { gameId, playerId: user.id });

    // Listen for updates
    socket.on("game_update", handleGameUpdate);
    socket.on("game_over", handleGameOver);

    // Cleanup listeners
    return () => {
      socket.off("game_update", handleGameUpdate);
      socket.off("game_over", handleGameOver);
    };
  }, [gameId, user]);

  /*
    MAKE MOVE - Send to server via Socket.io
   */
  const makeMove = (pos: number) => {
    if (!gameId || !user || status === "finished") return;
    socket.emit("move", {
      gameId,
      position: pos,
      playerId: user.id,
    });
  };

  // RENDER LOGIC
  if (!user) return <AuthPage onLogin={handleLogin} />;

  if (inLobby) {
    return <Lobby token={token} onJoin={handleJoin} userId={user.id} />;
  }

  return (
    <div className={styles.appContainer}>
      <h1 className={styles.gameTitle}>Tic Tac Toe</h1>
      <p className={styles.userInfo}>Logged in as: {user.username}</p>

      {/* GAME RESULTS DISPLAY */}
      {(status === "finished" || status === "abandoned") && (
        <div className={styles.statusSection}>
          {gameReason === "afk" && (
            <div>
              {winnerId === Number(user.id) ? (
                <h2 className={styles.statusWin}>
                  You won! Opponent timed out!
                </h2>
              ) : (
                <h2 className={styles.statusLose}>
                  You lost! You waited too long!
                </h2>
              )}
            </div>
          )}

          {gameReason === "abandoned" && (
            <div>
              {winnerId === Number(user.id) ? (
                <h2 className={styles.statusAbandoned}>
                  You won! Opponent left the game!
                </h2>
              ) : (
                <h2 className={styles.statusLose}>
                  You lost! You left the game!
                </h2>
              )}
            </div>
          )}

          {gameReason === "win" && (
            <div>
              {winnerId === Number(user.id) ? (
                <h2 className={styles.statusWin}>You won!</h2>
              ) : (
                <h2 className={styles.statusLose}>You lost!</h2>
              )}
            </div>
          )}

          {gameReason === "draw" && <h2>Draw!</h2>}

          <div className={styles.actionButtons}>
            <button className={styles.btnLobby} onClick={goToLobby}>
              ⬅ Back to Lobby
            </button>
            <button className={styles.btnNewGame} onClick={newGame}>
              🎮 New Game
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      <Board board={board} onClick={makeMove} />
    </div>
  );
}
