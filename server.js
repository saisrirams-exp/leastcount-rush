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
const socketPlayerMap = new Map(); // socketId -> persistentPlayerId

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
        const pId = socketPlayerMap.get(socketId) || socketId;
        socket.emit('gameState', room.getClientState(pId));
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
            try {
              if (room.status === 'PLAYING' && room.getCurrentPlayer()?.id === currentPlayer.id) {
                const move = room.decideBotMove(currentPlayer);
                if (move) {
                  if (move.action === 'SHOW') {
                    room.handleCallShow(currentPlayer.id);
                    broadcastRoomState(room);
                    room.botMoving = false;
                  } else if (move.action === 'DROP') {
                    room.handleDrop(currentPlayer.id, move.cardIds);
                    broadcastRoomState(room);
                    // Bot decides draw after dropping
                    setTimeout(() => {
                      try {
                        if (room.status === 'PLAYING' && room.getCurrentPlayer()?.id === currentPlayer.id) {
                          const drawMove = room.decideBotMove(currentPlayer);
                          if (drawMove && drawMove.action === 'DRAW') {
                            room.handleDraw(currentPlayer.id, drawMove.source);
                          }
                          broadcastRoomState(room);
                        }
                      } finally {
                        room.botMoving = false;
                      }
                    }, 600);
                    return; // Retain room.botMoving = true until inner draw completes!
                  } else if (move.action === 'DRAW') {
                    room.handleDraw(currentPlayer.id, move.source);
                    broadcastRoomState(room);
                    room.botMoving = false;
                  } else {
                    room.botMoving = false;
                  }
                } else {
                  room.botMoving = false;
                }
              } else {
                room.botMoving = false;
              }
            } catch (err) {
              console.error('[Bot Error]', err);
              room.botMoving = false;
            }
          }, 800);
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
  socket.on('createRoom', ({ playerId, playerName, avatar, settings }) => {
    const pId = playerId || socket.id;
    const code = generateRoomCode();
    const room = new GameRoom(code, pId, playerName, settings, avatar);
    room.players[0].socketId = socket.id;
    rooms.set(code, room);
    playerRoomMap.set(socket.id, code);
    socketPlayerMap.set(socket.id, pId);

    socket.join(code);
    socket.emit('roomJoined', {
      success: true,
      roomCode: code,
      playerId: pId,
      state: room.getClientState(pId)
    });
    console.log(`[Room ${code}] Created by ${playerName} (${pId}) (Max ${room.maxPlayers} players)`);
  });

  // JOIN ROOM
  socket.on('joinRoom', ({ roomCode, playerId, playerName, avatar }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const pId = playerId || socket.id;
    const room = rooms.get(code);

    if (!room) {
      return socket.emit('roomError', `Table "${code}" not found. Please verify the 5-letter code.`);
    }

    const res = room.addPlayer(pId, playerName, false, socket.id, avatar);
    if (!res.success) {
      return socket.emit('roomError', res.message);
    }

    playerRoomMap.set(socket.id, code);
    socketPlayerMap.set(socket.id, pId);
    socket.join(code);

    socket.emit('roomJoined', {
      success: true,
      roomCode: code,
      playerId: pId,
      state: room.getClientState(pId)
    });

    broadcastRoomState(room);
    console.log(`[Room ${code}] ${playerName} (${pId}) joined (${room.players.length}/${room.maxPlayers})`);
  });

  // UPDATE SETTINGS (Host only)
  socket.on('updateSettings', (settings) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    room.updateSettings(settings);
    broadcastRoomState(room);
  });

  // ADD BOT
  socket.on('addBot', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    room.addBot();
    broadcastRoomState(room);
  });

  // FILL WITH BOTS TO MAX
  socket.on('fillBots', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    room.fillWithBots();
    broadcastRoomState(room);
  });

  // REMOVE BOT
  socket.on('removeBot', (botId) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    room.removeBot(botId);
    broadcastRoomState(room);
  });

  // START GAME
  socket.on('startGame', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    const res = room.startNewGame();
    if (!res.success) {
      return socket.emit('roomError', res.message);
    }

    broadcastRoomState(room);
  });

  // START NEXT ROUND
  socket.on('nextRound', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    if (room.status === 'ROUND_OVER') {
      room.startNewRound();
      broadcastRoomState(room);
    }
  });

  // UNIFIED DROP & DRAW (Player stages card in middle, then picks from deck or discard)
  socket.on('dropAndDraw', ({ dropCardIds, source }) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id) || socket.id;
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleDropAndDraw(pId, dropCardIds, source);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // DROP CARDS
  socket.on('dropCards', ({ cardIds }) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id) || socket.id;
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleDrop(pId, cardIds);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // DRAW CARD
  socket.on('drawCard', ({ source }) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id) || socket.id;
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleDraw(pId, source);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // CALL SHOW
  socket.on('callShow', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id) || socket.id;
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleCallShow(pId);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // SLASH CARDS (Match & Drop)
  socket.on('slashCards', ({ cardIds }) => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id) || socket.id;
    const room = rooms.get(code);
    if (!room) return;

    const res = room.handleSlash(pId, cardIds);
    if (!res.success) {
      return socket.emit('actionError', res.message);
    }

    broadcastRoomState(room);
  });

  // STOP GAME ENTIRELY (Host / Admin Only)
  socket.on('stopGame', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== pId) return;

    room.stopGame('Game was stopped by the table admin.');
    broadcastRoomState(room);
    console.log(`[Room ${code}] Game stopped by admin ${pId}`);
  });

  // LEAVE ROOM / EXIT OPTION
  socket.on('leaveRoom', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (room) {
      room.removePlayer(pId || socket.id);
      socket.leave(code);
      playerRoomMap.delete(socket.id);
      socketPlayerMap.delete(socket.id);

      socket.emit('leftRoom', { success: true });

      if (room.players.length === 0) {
        rooms.delete(code);
        console.log(`[Room ${code}] Deleted (empty after player left)`);
      } else {
        broadcastRoomState(room);
      }
    }
  });

  // DISCONNECT (With 5-minute grace period before cleaning up)
  socket.on('disconnect', () => {
    const code = playerRoomMap.get(socket.id);
    const pId = socketPlayerMap.get(socket.id);
    if (code && pId) {
      const room = rooms.get(code);
      if (room) {
        room.setPlayerDisconnected(pId);
        broadcastRoomState(room);

        // Keep room alive for 5 minutes of disconnect before cleaning up
        setTimeout(() => {
          const r = rooms.get(code);
          if (r) {
            const anyActive = r.players.some(x => !x.isBot && x.connected);
            if (!anyActive) {
              rooms.delete(code);
              console.log(`[Room ${code}] Cleaned up after all humans disconnected for 5 minutes.`);
            }
          }
        }, 300000);
      }
      playerRoomMap.delete(socket.id);
      socketPlayerMap.delete(socket.id);
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
