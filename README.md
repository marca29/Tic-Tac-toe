# Setup Guide: Multiplayer Tic-Tac-Toe

This project uses a separated client-server architecture (Vite/React for the frontend, Node/Express/Socket.IO for the backend) and relies on PostgreSQL for data storage.
Follow these steps to get the game running on your Local Area Network.

---

## 1. Installation
Since this is a multi-part project, you will need to install dependencies separately for the backend and the frontend.
```
# 1. Clone the repository
git clone <your-repository-url>

# 2. Backend
cd backend
npm init -y
npm install express cors bcryptjs jsonwebtoken pg socket.io

# 3. Frontend
cd ../frontend
npm install
npm install socket.io-client
```

## 2. Database Setup
You will need PostgreSQL installed and running. Execute the following SQL script in pgAdmin to create the database and required tables:

### Step 2.1: Create the Database
- Open pgAdmin and log in.
- In the left sidebar, right-click on **Databases -> Create -> Database**
- Name the database `tic_tac_toe` and click **Save**.

### Step 2.2: Create the Tables
- Right-click your database `tic_tac_toe` and select **Query Tool**.
- Copy, paste, and run the following SQL script to create the required tables:
```
-- 1. USERS (with statistics)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. GAMES
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  player_x_id INTEGER REFERENCES users(id),
  player_o_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_progress', 'finished', 'abandoned')
  ),
  winner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. MOVES (for game replay and timer)
CREATE TABLE moves (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES users(id),
  position INTEGER CHECK (position >= 0 AND position <= 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDEXES for performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_player_x ON games(player_x_id);
CREATE INDEX idx_games_player_o ON games(player_o_id);
CREATE INDEX idx_moves_game ON moves(game_id);
CREATE INDEX idx_moves_player ON moves(player_id);

-- 5. TRIGGER: Update statistics after a game
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Player X wins
  IF NEW.status = 'finished'
     AND NEW.winner_id = (SELECT player_x_id FROM games WHERE id = NEW.id) THEN
    
    UPDATE users
    SET wins = wins + 1
    WHERE id = (SELECT player_x_id FROM games WHERE id = NEW.id);

    UPDATE users
    SET losses = losses + 1
    WHERE id = (SELECT player_o_id FROM games WHERE id = NEW.id);

  -- Player O wins
  ELSIF NEW.status = 'finished'
        AND NEW.winner_id = (SELECT player_o_id FROM games WHERE id = NEW.id) THEN

    UPDATE users
    SET wins = wins + 1
    WHERE id = (SELECT player_o_id FROM games WHERE id = NEW.id);

    UPDATE users
    SET losses = losses + 1
    WHERE id = (SELECT player_x_id FROM games WHERE id = NEW.id);

  -- Draw
  ELSIF NEW.status = 'finished' AND NEW.winner_id IS NULL THEN

    UPDATE users
    SET draws = draws + 1
    WHERE id = (SELECT player_x_id FROM games WHERE id = NEW.id);

    UPDATE users
    SET draws = draws + 1
    WHERE id = (SELECT player_o_id FROM games WHERE id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to the games table
CREATE TRIGGER trigger_update_stats
AFTER UPDATE OF status, winner_id ON games
FOR EACH ROW
EXECUTE FUNCTION update_player_stats();
```

### Database Connection (`db.js`)
Create a file named `db.js` inside your `backend` directory. This file centralizes your database connection using the pg Pool for efficient management:
```
const { Pool } = require("pg");

const pool = new Pool({
  user: "YOUR_USERNAME",        // Database username
  host: "YOUR_HOSTNAME",        // Localhost for development
  database: "tic_tac_toe",      // Database name
  password: "YOUR_PASSWORD",    // Default password
  port: 5432,                   // Default PostgreSQL port
});

module.exports = pool;
```

##  3. Environment Variables (`.env`)
Before creating your environment variables, find your Host machine's LAN IP address.
Open Command Prompt/Terminal and type `ipconfig`. Look for the:
- **IPv4 Address** on Windows
- **inet** on Mac/Linux

Create a file named `.env` inside the `/backend` directory.
```
VITE_API_URL=http://192.168.1.X:3001
JWT_SECRET=your_very_long_and_random_32_character_secret
```

## 4. Running the Application
You will need two separate terminal windows (or tabs) to run the client and the server simultaneously.

**Terminal 1: Backend**
```
cd backend
node server.js
```
**Terminal 2: Frontend**
```
cd frontend
npm run dev -- --host
```
