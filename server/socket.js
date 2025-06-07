const { Server } = require('socket.io');
const { client: redisClient } = require('./redisClient');

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, username }) => {
      if (!roomId || !username) {
        socket.emit('error', 'Missing roomId or username');
        return;
      }

      let room;
      try {
        const data = await redisClient.get(roomId);
        room = data ? JSON.parse(data) : [];
      } catch (err) {
        console.error('❌ Redis read error:', err);
        socket.emit('error', 'Server error');
        return;
      }

      if (room.length >= 2) {
        socket.emit('roomFull');
        return;
      }

      const user = { id: socket.id, username };
      room.push(user);

      try {
        await redisClient.set(roomId, JSON.stringify(room));
      } catch (err) {
        console.error('❌ Redis write error:', err);
        socket.emit('error', 'Server error');
        return;
      }

      socket.join(roomId);
      console.log(`✅ ${username} joined room ${roomId}`);
      socket.emit('roomJoined', { roomId, user });

      // Start game when 2 players joined
      if (room.length === 2) {
        const startingPlayerIndex = Math.floor(Math.random() * 2);
        const gameState = {
          currentTurnIndex: startingPlayerIndex,
          requiredLetter: null,
          history: [], // 👈 store country history
        };
        await redisClient.set(`${roomId}_gameState`, JSON.stringify(gameState));

        io.to(roomId).emit('startGame', {
          roomId,
          players: room,
          currentTurnIndex: startingPlayerIndex,
          requiredLetter: null,
          history: [],
        });
      }

      // Listen for countrySpoken
      socket.on('countrySpoken', async ({ roomId, country }) => {
        if (!roomId || !country) return;

        let players, gameState;
        try {
          const roomData = await redisClient.get(roomId);
          players = roomData ? JSON.parse(roomData) : [];

          const gameData = await redisClient.get(`${roomId}_gameState`);
          gameState = gameData ? JSON.parse(gameData) : null;

          if (!players || !gameState) return;
        } catch (err) {
          console.error('❌ Redis fetch error:', err);
          return;
        }

        const currentPlayer = players[gameState.currentTurnIndex];
        if (currentPlayer.id !== socket.id) {
          socket.emit('error', '⛔ Not your turn');
          return;
        }

        const countryNormalized = country.trim().toLowerCase();

        if (gameState.requiredLetter) {
          if (countryNormalized[0] !== gameState.requiredLetter.toLowerCase()) {
            socket.emit('invalidCountry', {
              reason: `Country must start with "${gameState.requiredLetter.toUpperCase()}"`,
            });
            return;
          }
        }

        // Extract the last valid letter
        let lastLetter = null;
        for (let i = countryNormalized.length - 1; i >= 0; i--) {
          const c = countryNormalized[i];
          if (c >= 'a' && c <= 'z') {
            lastLetter = c;
            break;
          }
        }
        if (!lastLetter) lastLetter = countryNormalized[countryNormalized.length - 1];

        // Update state
        gameState.history = gameState.history || [];
        gameState.history.push(country);

        gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % 2;
        gameState.requiredLetter = lastLetter;

        try {
          await redisClient.set(`${roomId}_gameState`, JSON.stringify(gameState));
        } catch (err) {
          console.error('❌ Redis write error:', err);
          return;
        }

        io.to(roomId).emit('turnUpdate', {
          currentTurnIndex: gameState.currentTurnIndex,
          requiredLetter: gameState.requiredLetter.toUpperCase(),
          lastCountry: country,
          lastPlayerId: socket.id,
          history: gameState.history, // 👈 send full history
        });
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        try {
          const data = await redisClient.get(roomId);
          if (!data) return;

          let updatedRoom = JSON.parse(data).filter(u => u.id !== socket.id);

          if (updatedRoom.length === 0) {
            await redisClient.del(roomId);
            await redisClient.del(`${roomId}_gameState`);
          } else {
            await redisClient.set(roomId, JSON.stringify(updatedRoom));
            await redisClient.del(`${roomId}_gameState`);
            io.to(roomId).emit('userLeft', { updatedRoom });
          }
        } catch (err) {
          console.error('❌ Redis error on disconnect:', err);
        }
      });
    });
  });
}

module.exports = { initSocket };
