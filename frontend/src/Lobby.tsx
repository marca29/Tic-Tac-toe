/*
  LOBBY COMPONENT - Game browser & leaderboard
  ============================================
  Shows available games, leaderboard, player stats, and game creation
 */
import { useEffect, useState } from "react";
import styles from "./Lobby.module.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface LobbyProps {
  token: string | null;
  onJoin: (gameId: number) => void;
  userId: number;
}

export default function Lobby({ token, onJoin, userId }: LobbyProps) {
  // LOBBY STATE
  const [games, setGames] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [yourRank, setYourRank] = useState<number | null>(null);
  const [yourStats, setYourStats] = useState<any>(null);

  /*
    UTILITY FUNCTIONS
   */
  const goToDocs = () => {
    window.open("/docs.pdf", "_blank", "noopener,noreferrer");
  };

  /*
    LOAD AVAILABLE GAMES (polling every 5s)
   */
  const loadGames = async () => {
    const res = await fetch(`${API}/games/available`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setGames(data);
    console.log(data);
  };

  /*
    LOAD LEADERBOARD & YOUR STATS
   */
  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/stats/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Find your position in leaderboard
      const yourPlayer = data.find((p: any) => p.id === userId);
      if (yourPlayer) {
        const rank = data.findIndex((p: any) => p.id === userId) + 1;
        setYourRank(rank);
        setYourStats(yourPlayer);
      } else {
        setYourRank(null);
        setYourStats(null);
      }

      // Show top 10
      setStats(data.slice(0, 10));
    } catch (e) {
      console.log("Stats error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  /*
    JOIN GAME - HTTP API call + callback to App
   */
  const joinGame = async (id: number) => {
    try {
      const res = await fetch(`${API}/games/${id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Game no longer available!");
        return;
      }

      const data = await res.json();
      onJoin(data.id); // Navigate to game
    } catch (e) {
      alert("Connection error. Try again.");
    }
  };

  /*
    AUTO-REFRESH every 5 seconds
   */
  useEffect(() => {
    loadGames();
    loadStats();
    const interval = setInterval(() => {
      loadGames();
      loadStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /*
    CREATE NEW GAME (becomes Player X)
   */
  const createGame = async () => {
    const res = await fetch(`${API}/games/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    onJoin(data.id);
  };

  return (
    <div className={styles.wrapper}>
      {/* LOBBY TITLE */}
      <h2 className={styles.title}>🎮 Lobby</h2>

      {/* CREATE GAME BUTTON */}
      <button className={styles.createButton} onClick={createGame}>
        ➕ Create Game
      </button>

      {/* AVAILABLE GAMES SECTION */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Available Games</h3>

        {/* GAME LIST */}
        {games.map((g) => (
          <div key={g.id} className={styles.gameItem}>
            <span>
              Game #{g.id}
              {g.player_x_id === userId && (
                <span className={styles.yourGameTag}>(Yours)</span>
              )}
            </span>
            <button
              className={styles.joinButton}
              onClick={(e) => {
                e.stopPropagation();
                joinGame(g.id);
              }}
            >
              Join
            </button>
          </div>
        ))}
        {games.length === 0 && (
          <p className={styles.empty}>No games available</p>
        )}
      </div>

      {/* LEADERBOARD SECTION - MOBILE OPTIMIZED */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>🏆 Leaderboard (Top 10)</h3>
        {loadingStats ? (
          <p className={styles.empty}>Loading stats...</p>
        ) : (
          <div className={styles.statsContainer}>
            {/* LEADERBOARD TABLE */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th}>Wins</th>
                    <th className={styles.th}>Losses</th>
                    <th className={styles.th}>Draws</th>
                    <th className={styles.th}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((player: any, index: number) => (
                    <tr key={player.id}>
                      <td className={styles.td}>{index + 1}</td>
                      <td className={styles.td}>
                        <strong>{player.username}</strong>
                      </td>
                      <td className={styles.td}>{player.wins || 0}</td>
                      <td className={styles.td}>{player.losses || 0}</td>
                      <td className={styles.td}>{player.draws || 0}</td>
                      <td className={styles.tdScore}>
                        {Number(player.score || 0).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* YOUR PERSONAL STATS */}
            {yourStats ? (
              <div className={styles.yourStatsBox}>
                <h4>📊 Your Stats</h4>
                <div className={styles.yourRank}>#{yourRank}</div>
                <div className={styles.statRow}>
                  Wins: {yourStats.wins || 0}
                </div>
                <div className={styles.statRow}>
                  Losses: {yourStats.losses || 0}
                </div>
                <div className={styles.statRow}>
                  Draws: {yourStats.draws || 0}
                </div>
                <div className={styles.statRow}>
                  <strong>{Number(yourStats.score || 0).toFixed(1)} pts</strong>
                </div>
              </div>
            ) : (
              <div className={styles.noStats}>
                <p>Play some games to see your stats! 🎮</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOCUMENTATION BUTTON */}
      <div className={styles.footerButtons}>
        <button className={styles.docsButton} onClick={goToDocs}>
          📄 Game Documentation
        </button>
      </div>
    </div>
  );
}
