const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./game/room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// In-memory room store
const rooms = new Map(); // roomCode -> GameRoom
const playerRoomMap = new Map(); // socketId -> roomCode

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Broadcasts updated state to all connected clients in a room
function broadcastRoomState(room) {
  if (!room) return;
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (sockets) {
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('gameState', room.getClientState(socketId));
      }
    }
  }
}

// Server Game Loop (Timer & Bot Execution)
setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    if (room.status === 'PLAYING') {
      const currentPlayer = room.getCurrentPlayer();
      if (!currentPlayer) continue;

      // Handle Bot Turn
      if (currentPlayer.isBot) {
        if (!room.botMoving) {
          room.botMoving = true;
          setTimeout(() => {
            if (room.status === 'PLAYING' && room.getCurrentPlayer()?.id === currentPlayer.id) {
              const move = room.decideBotMove(currentPlayer);
              if (move) {
                if (move.action === 'SHOW') {
                  room.handleCallShow(currentPlayer.id);
                } else if (move.action === 'DROP') {
                  room.handleDrop(currentPlayer.id, move.cardIds);
                  // Bot immediately decides draw after dropping
                  setTimeout(() => {
                    if (room.status === 'PLAYING' && room.getCurrentPlayer()?.id === currentPlayer.id) {
                      const drawMove = room.decideBotMove(currentPlayer);
                      if (drawMove && drawMove.action === 'DRAW') {
                        room.handleDraw(currentPlayer.id, drawMove.source);
                      }
                      broadcastRoomState(room);
                    }
                    room.botMoving = false;
                  }, 600);
                } else if (move.action === 'DRAW') {
                  room.handleDraw(currentPlayer.id, move.source);
                }
              }
              broadcastRoomState(room);
            }
            room.botMoving = false;
          }, 1000);
        }
      } else {
        // Human Player Timer countdown
        if (room.turnTimeRemaining > 0) {
          room.turnTimeRemaining--;
          if (room.turnTimeRemaining === 0) {
            // Auto play on timeout
            room.autoPlayCurrentTurn();
            broadcastRoomState(room);
          } else {
            // Send lightweight tick to room
            io.to(room.code).emit('turnTimerTick', {
              turnTimeRemaining: room.turnTimeRemaining,
              currentTurnPlayerId: currentPlayer.id
            });
          }
        }
      }
    }
  }
}, 1000);

io.on('connection', (socket) => {
  // CREATE ROOM
  socket.on('createRoom', ({ playerName, settings }) => {
    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id, playerName, settings);
    rooms.set(code, room);
    playerRoomMap.set(socket.id, code);

    socket.join(code);
    socket.emit('roomJoined', {
      success: true,
      roomCode: code,
      playerId: socket.id,
      state: room.getClientState(socket.id)
    });
    console.log(`[Room ${code}] Created by ${playerName} (Max ${room.maxPlayers} players)`);
  });

  // JOIN ROOM
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      return socket.emit('roomError', 'Table not found. Please check the code.');
    }

    const res = room.addPlayer(socket.id, playerName, false);
    if (!res.success) {
      return socket.emit('roomError', res.message);
    }

    playerRoomMap.set(socket.id, code);
    socket.join(code);

    socket.emit('roomJoined', {
      success: true,
      roomCode: code,
      playerId: socket.id,
      state: room.getClientState(socket.id)
    });

    broadcastRoomState(room);
    console.log(`[Room ${code}] ${playerName} joined (${room.players.length}/${room.maxPlayers})`);
  });

  // UPDATE SETTINGS (Host only)
  socket.on('updateSettings', (settings) => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.updateSettings(settings);
    broadcastRoomState(room);
  });

  // ADD BOT
  socket.on('addBot', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.addBot();
    broadcastRoomState(room);
  });

  // FILL WITH BOTS TO MAX
  socket.on('fillBots', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.fillWithBots();
    broadcastRoomState(room);
  });

  // REMOVE BOT
  socket.on('removeBot', (botId) => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.removeBot(botId);
    broadcastRoomState(room);
  });

  // START GAME
  socket.on('startGame', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    const res = room.startNewGame();
    if (!res.success) {
      return socket.emit('roomError', res.message);
    }

    broadcastRoomState(room);
  });

  // START NEXT ROUND
  socket.on('nextRound', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    if (room.status === 'ROUND_OVER') {
      room.startNewRound();
      broadcastRoomState(room);
    }
  });

  // DROP CARDS
  socket.on('dropCards', ({ cardIds }) => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleDrop(socket.id, cardIds);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // DRAW CARD
  socket.on('drawCard', ({ source }) => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleDraw(socket.id, source);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // CALL SHOW
  socket.on('callShow', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleCallShow(socket.id);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // SLASH CARDS (Match & Drop)
  socket.on('slashCards', ({ cardIds }) => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleSlash(socket.id, cardIds);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // STOP GAME ENTIRELY (Host / Admin Only)
  socket.on('stopGame', () => {
    const code = playerRoomMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.stopGame('Game was stopped by the table admin.');
    broadcastRoomState(room);
    console.log(`[Room ${code}] Game stopped by admin ${socket.id}`);
  });

  // LEAVE ROOM / EXIT OPTION
  socket.on('leaveRoom', () => {
    const code = playerRoomMap.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(code);
      playerRoomMap.delete(socket.id);

      socket.emit('leftRoom', { success: true });

      if (room.players.length === 0) {
        rooms.delete(code);
        console.log(`[Room ${code}] Deleted (empty after player left)`);
      } else {
        broadcastRoomState(room);
      }
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const code = playerRoomMap.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.length === 0) {
          rooms.delete(code);
          console.log(`[Room ${code}] Deleted (empty)`);
        } else {
          broadcastRoomState(room);
        }
      }
      playerRoomMap.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🃏 Least Count Rush Server is running!`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log(`👥 Supports 6 to 15 Players (2 to 4 Decks)`);
  console.log(`===============================================`);
});
