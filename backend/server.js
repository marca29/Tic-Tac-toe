/*
  TIC-TAC-TOE SERVER - Complete Multiplayer Backend
  ==================================================
  Express.js + Socket.io server with:
  Real-time multiplayer
  JWT authentication
  PostgreSQL database
  AFK timeout system (15s per move)
  Win detection & draw handling
  Leaderboard & player stats
 */

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");      // Password hashing
const jwt = require("jsonwebtoken");     // JWT tokens for auth
const http = require("http");
const { Server } = require("socket.io"); // Real-time communication
const pool = require("./db");

const app = express();

// MIDDLEWARE SETUP
app.use(cors());           // Enable CORS for frontend
app.use(express.json());   // Parse JSON bodies

// JWT SECRET - CHANGE THIS IN PRODUCTION!
const JWT_SECRET = process.env.JWT_SECRET;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }    // Allow all origins (adjust for production)
});

/*
  GLOBAL STATE MANAGEMENT
  =======================
  activeP layers: Maps socket.id -> playerId (tracks who's online)
  gameTimers: Maps gameId -> timeout (AFK detection per game)
 */
const activePlayers = new Map(); // socket.id -> playerId
const gameTimers = new Map();    // gameId -> timeout

/*
  WIN DETECTION L OGIC
  ===================
  All possible winning combinations for 3x3 board (0-8 positions)
 */
const winPatterns = [
  [0,1,2], [3,4,5], [6,7,8],  // Rows
  [0,3,6], [1,4,7], [2,5,8],  // Columns
  [0,4,8], [2,4,6]            // Diagonals
];

function checkWinner(board) {
  // Check each winning pattern
  for (const [a, b, c] of winPatterns) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Return 'X' or 'O'
    }
  }
  return null; // No winner
}

/*
  AFK TIMER SYSTEM (15 SECONDS PER MOVE)
  ======================================
  Automatically ends games when players don't move in time
 */
function resetMoveTimer(gameId) {
  // Clear existing timer for this game
  if (gameTimers.has(gameId)) {
    clearTimeout(gameTimers.get(gameId));
  }

  // Set new 15-second timer
  const timer = setTimeout(async () => {
    console.log("⏰ TIMEOUT:", gameId);

    // Get current game state
    const gameRes = await pool.query("SELECT * FROM games WHERE id=$1", [gameId]);
    const game = gameRes.rows[0];
    if (!game) return;

     if (!game.player_x_id || !game.player_o_id) {
      return;
    }

    // CASE 1: Both players joined -> loser is current turn player
    if (game.player_x_id && game.player_o_id) {
      const movesRes = await pool.query("SELECT * FROM moves WHERE game_id=$1 ORDER BY id ASC", [gameId]);
      const moves = movesRes.rows;
      const isXTurn = moves.length % 2 === 0; // Even moves = X's turn

      const loserId = isXTurn ? game.player_x_id : game.player_o_id;
      const winnerId = loserId === game.player_x_id ? game.player_o_id : game.player_x_id;

      // Update game as finished with winner
      await pool.query("UPDATE games SET status='finished', winner_id=$1 WHERE id=$2", [winnerId, gameId]);
      io.to(`game_${gameId}`).emit("game_over", { winnerId, reason: "afk" });

    } else {
      // CASE 2: No opponent joined -> mark as abandoned
      await pool.query("UPDATE games SET status='abandoned' WHERE id=$1", [gameId]);
    }

    gameTimers.delete(gameId);
  }, 15000); // 15 seconds timeout

  gameTimers.set(gameId, timer);
}

/*
  JWT AUTHENTICATION MIDDLEWARE
  =============================
  Protects API routes requiring login
 */
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.sendStatus(401);
  }
};

/*
  AUTHENTICATION ROUTES
  =====================
 */

// REGISTER - Create new user
app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10); // Hash password

  const result = await pool.query(
    "INSERT INTO users (username, password_hash) VALUES ($1,$2) RETURNING id, username",
    [username, hash]
  );

  res.json(result.rows[0]);
});

// LOGIN - Authenticate existing user
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  const userRes = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
  if (!userRes.rows.length) {
    return res.status(400).json({ error: "User not found" });
  }

  const user = userRes.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(400).json({ error: "Wrong password" });
  }

  // Generate JWT token
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

/**
  REAL-TIME SOCKET.IO LOGIC
  =========================
 */
io.on("connection", (socket) => {
  console.log("🔥 CONNECTED:", socket.id);

  // Join specific game room
  socket.on("join_game", ({ gameId, playerId }) => {
    activePlayers.set(socket.id, playerId);
    socket.join(`game_${gameId}`);
    resetMoveTimer(gameId); // Start AFK timer
  });

  // Handle player move
  socket.on("move", async ({ gameId, position, playerId }) => {
    console.log(`🔄 MOVE: game ${gameId}, pos ${position}, player ${playerId}`);
    
    resetMoveTimer(gameId); // Reset AFK timer immediately

    // Get current game
    const gameRes = await pool.query("SELECT * FROM games WHERE id=$1", [gameId]);
    const game = gameRes.rows[0];
    if (!game || game.status !== "in_progress") return;

    // Get all moves in order
    const movesRes = await pool.query("SELECT * FROM moves WHERE game_id=$1 ORDER BY id ASC", [gameId]);
    const moves = movesRes.rows;

    // Prevent move on occupied position
    if (moves.find(m => m.position === position)) return;

    // Determine whose turn it is (even moves = X, odd = O)
    const isXTurn = moves.length % 2 === 0;
    const isX = playerId === game.player_x_id;
    const isO = playerId === game.player_o_id;

    // Validate player can make this move
    if ((isXTurn && !isX) || (!isXTurn && !isO)) return;

    // Save move to database
    await pool.query("INSERT INTO moves (game_id, player_id, position) VALUES ($1,$2,$3)", 
      [gameId, playerId, position]);

    // Rebuild current board state
    const updated = await pool.query("SELECT * FROM moves WHERE game_id=$1 ORDER BY id ASC", [gameId]);
    const board = Array(9).fill(null);
    updated.rows.forEach((m) => {
      board[m.position] = m.player_id === game.player_x_id ? "X" : "O";
    });

    // Check for winner
    const winnerSymbol = checkWinner(board);
    const isDraw = board.every(cell => cell !== null);

    // CRITICAL: Clear timer BEFORE game ends
    if (gameTimers.has(gameId)) {
      clearTimeout(gameTimers.get(gameId));
      gameTimers.delete(gameId);
    }

    if (winnerSymbol) {
      // Game won
      const winnerId = winnerSymbol === "X" ? game.player_x_id : game.player_o_id;
      await pool.query("UPDATE games SET status='finished', winner_id=$1 WHERE id=$2", [winnerId, gameId]);
      io.to(`game_${gameId}`).emit("game_over", { winnerId, board, reason: "win" });
      return;
    }

    if (isDraw) {
      // Draw
      await pool.query("UPDATE games SET status='finished', winner_id=NULL WHERE id=$1", [gameId]);
      io.to(`game_${gameId}`).emit("game_over", { winnerId: null, board, reason: "draw" });
      console.log(`🤝 DRAW game ${gameId}`);
      return;
    }

    // Game continues - broadcast update and reset timer
    io.to(`game_${gameId}`).emit("game_update", board);
    resetMoveTimer(gameId);
  });

  // Clean up waiting games when player disconnects
  socket.on("disconnect", async () => {
  const playerId = activePlayers.get(socket.id);
  if (!playerId) return;

  console.log("👋 Player disconnected:", playerId);

  // 1. Usuń WAITING gry (jak było)
  await pool.query(`
    DELETE FROM games 
    WHERE status='waiting' AND player_x_id=$1
  `, [playerId]);

  // 2. NOWE: Sprawdź IN_PROGRESS gry - oznacz jako abandoned
  const activeGames = await pool.query(`
    SELECT * FROM games 
    WHERE status='in_progress' 
    AND (player_x_id=$1 OR player_o_id=$1)
  `, [playerId]);

  for (const game of activeGames.rows) {
    // Oznacz grę jako abandoned
    await pool.query("UPDATE games SET status='abandoned' WHERE id=$1", [game.id]);
    
    // Powiadom pozostałego gracza
    io.to(`game_${game.id}`).emit("game_over", { 
      winnerId: playerId === game.player_x_id ? game.player_o_id : game.player_x_id, 
      reason: "abandoned" 
    });
  }

  activePlayers.delete(socket.id);
});
});

/*
  LOBBY & GAME MANAGEMENT ROUTES
  ==============================
 */

// Get available games (waiting for opponent)
app.get("/games/available", auth, async (req, res) => {
  const games = await pool.query(`
    SELECT id, player_x_id 
    FROM games
    WHERE status='waiting'
    AND player_o_id IS NULL
    ORDER BY id ASC
  `);
  res.json(games.rows);
});

// Join existing game as player O
app.post("/games/:id/join", auth, async (req, res) => {
  console.log("🔄 Join attempt:", req.params.id, "by user:", req.user.id);
  
  const userId = req.user.id;
  const gameId = req.params.id;

  const gameRes = await pool.query("SELECT * FROM games WHERE id=$1", [gameId]);
  const game = gameRes.rows[0];

  console.log("Game found:", game);

  // Validate game is available
  if (!game || game.status !== "waiting" || game.player_o_id) {
    console.log("Game invalid:", { 
      game, 
      status: game?.status, 
      hasO: !!game?.player_o_id 
    });
    return res.status(400).json({ error: "Game not available" });
  }

  // Join game and start it
  const updated = await pool.query(
    "UPDATE games SET player_o_id=$1, status='in_progress' WHERE id=$2 RETURNING *",
    [userId, gameId]
  );

  console.log("Game joined:", updated.rows[0]);
  res.json(updated.rows[0]);
});

// Create new game as player X
app.post("/games/create", auth, async (req, res) => {
  const userId = req.user.id;
  const created = await pool.query(
    "INSERT INTO games (player_x_id, status) VALUES ($1,'waiting') RETURNING *",
    [userId]
  );
  res.json(created.rows[0]);
});

// Leave your own waiting game
app.post("/games/:id/leave", auth, async (req, res) => {
  const userId = req.user.id;
  const gameId = req.params.id;

  const gameRes = await pool.query(
    "SELECT * FROM games WHERE id=$1 AND player_x_id=$2 AND status='waiting'",
    [gameId, userId]
  );

  const game = gameRes.rows[0];
  if (!game) {
    return res.status(400).json({ error: "Cannot leave this game" });
  }

  await pool.query("DELETE FROM games WHERE id=$1", [gameId]);
  res.json({ success: true });
});

/*
  LEADERBOARD & STATS
  ===================
  Score = wins - losses*0.5 + draws*0.5
 */
app.get("/stats/leaderboard", auth, async (req, res) => {
  const stats = await pool.query(`
    SELECT 
      id,
      username,
      wins,
      losses,
      draws,
      (wins - losses * 0.5 + draws * 0.5)::numeric(4,1) as score
    FROM users
    ORDER BY score DESC NULLS LAST, wins DESC, id ASC
  `);
  res.json(stats.rows);
});

// START SERVER
server.listen(3001, "0.0.0.0", () => {
  console.log("🚀 Server running on http://0.0.0.0:3001");
});