import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("bps.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    battery_level INTEGER DEFAULT 100,
    energy_shared INTEGER DEFAULT 0,
    energy_received INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_name TEXT,
    device_type TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    amount INTEGER,
    status TEXT, -- 'pending', 'active', 'completed', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (user && user.password === password) {
      db.prepare("UPDATE users SET is_online = 1 WHERE id = ?").run(user.id);
      res.json({ success: true, user });
    } else if (!user) {
      // Auto-register for prototype
      const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, password);
      const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      res.json({ success: true, user: newUser });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.post("/api/users/update-battery", (req, res) => {
    const { userId, batteryLevel } = req.body;
    db.prepare("UPDATE users SET battery_level = ? WHERE id = ?").run(batteryLevel, userId);
    io.emit("user_status_change");
    res.json({ success: true });
  });

  app.get("/api/users/nearby", (req, res) => {
    const users = db.prepare("SELECT id, username, battery_level FROM users WHERE is_online = 1").all();
    res.json(users);
  });

  app.get("/api/stats/:userId", (req, res) => {
    const stats = db.prepare("SELECT battery_level, energy_shared, energy_received FROM users WHERE id = ?").get(req.params.userId);
    res.json(stats);
  });

  app.get("/api/history/:userId", (req, res) => {
    const history = db.prepare(`
      SELECT s.*, u1.username as sender, u2.username as receiver 
      FROM sessions s
      JOIN users u1 ON s.sender_id = u1.id
      JOIN users u2 ON s.receiver_id = u2.id
      WHERE s.sender_id = ? OR s.receiver_id = ?
      ORDER BY s.created_at DESC
    `).all(req.params.userId, req.params.userId);
    res.json(history);
  });

  app.get("/api/ai/optimize/:userId", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.userId) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    // Simulated AI logic for battery optimization
    const recommendations = [
      "Reduce screen brightness by 15% to extend battery life by 2 hours.",
      "Close background processes: 'System.Analytics' and 'BPS.Scanner'.",
      "Optimal sharing threshold detected: Keep battery above 35% for maximum longevity.",
      "Battery health is at 94%. Avoid deep discharges below 15%."
    ];

    res.json({
      health_score: 94,
      recommendations,
      predicted_longevity: "14h 22m"
    });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
      db.prepare("UPDATE users SET is_online = 1 WHERE id = ?").run(userId);
      io.emit("user_status_change");
    });

    socket.on("request_power", (data) => {
      // data: { senderId, receiverId, amount }
      const { senderId, receiverId, amount } = data;
      const result = db.prepare("INSERT INTO sessions (sender_id, receiver_id, amount, status) VALUES (?, ?, ?, 'pending')")
        .run(senderId, receiverId, amount);
      
      io.to(`user_${senderId}`).emit("power_request_received", {
        sessionId: result.lastInsertRowid,
        from: receiverId,
        amount
      });
    });

    socket.on("accept_request", (sessionId) => {
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
      if (session) {
        db.prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(sessionId);
        
        // Simulate power transfer
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          io.to(`user_${session.sender_id}`).emit("transfer_progress", { sessionId, progress });
          io.to(`user_${session.receiver_id}`).emit("transfer_progress", { sessionId, progress });

          if (progress >= 100) {
            clearInterval(interval);
            db.prepare("UPDATE sessions SET status = 'completed' WHERE id = ?").run(sessionId);
            
            // Update battery levels
            db.prepare("UPDATE users SET battery_level = battery_level - ? WHERE id = ?").run(session.amount, session.sender_id);
            db.prepare("UPDATE users SET battery_level = battery_level + ? WHERE id = ?").run(session.amount, session.receiver_id);
            db.prepare("UPDATE users SET energy_shared = energy_shared + ? WHERE id = ?").run(session.amount, session.sender_id);
            db.prepare("UPDATE users SET energy_received = energy_received + ? WHERE id = ?").run(session.amount, session.receiver_id);

            io.to(`user_${session.sender_id}`).emit("transfer_complete", { sessionId });
            io.to(`user_${session.receiver_id}`).emit("transfer_complete", { sessionId });
          }
        }, 500);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
