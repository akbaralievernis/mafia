const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameEngine = require('./core/GameEngine');

const app = express();

const allowedOrigins = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app')) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
};

// Разрешаем CORS для Express (полезно для HTTP-запросов)
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));

// Простой эндпоинт для поддержания сервера в активном состоянии (Keep-Alive)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Хранилище комнат в памяти
// Формат: { "ABCDEF": { id: "ABCDEF", players: [...], status: "lobby", maxPlayers: 10 } }
const rooms = new Map();

// Генератор 6-значного кода
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // 1. Создание комнаты
  socket.on('create_room', ({ playerName, maxPlayers = 10 }, callback) => {
    let roomCode = generateRoomCode();
    // Убедимся, что код уникален
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const player = {
      id: socket.id,
      name: playerName,
      isHost: true
    };

    const newRoom = {
      id: roomCode,
      players: [player],
      status: 'lobby',
      maxPlayers: maxPlayers
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);

    console.log(`Комната ${roomCode} создана игроком ${playerName}`);
    
    // Возвращаем данные создателю
    callback({ success: true, room: newRoom });
  });

  // 2. Подключение к комнате
  socket.on('join_room', ({ roomCode, playerName }, callback) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      return callback({ success: false, error: 'Комната не найдена' });
    }

    if (room.status !== 'lobby') {
      return callback({ success: false, error: 'Игра уже началась' });
    }

    if (room.players.length >= room.maxPlayers) {
      return callback({ success: false, error: 'Комната переполнена' });
    }

    if (room.players.find(p => p.name === playerName)) {
      return callback({ success: false, error: 'Игрок с таким именем уже есть' });
    }

    const player = {
      id: socket.id,
      name: playerName,
      isHost: false
    };

    room.players.push(player);
    socket.join(roomCode);

    // Отменяем таймер уничтожения комнаты, если кто-то зашел
    if (room.destroyTimer) {
      clearTimeout(room.destroyTimer);
      delete room.destroyTimer;
    }

    console.log(`Игрок ${playerName} присоединился к комнате ${roomCode}`);

    // Уведомляем ВСЕХ игроков в комнате об обновлении списка
    io.to(roomCode).emit('room_updated', room);
    
    // Возвращаем успех текущему игроку
    callback({ success: true, room });
  });

  // 3. Старт игры
  socket.on('start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Ищем игрока, проверяем, что он хост
    const player = room.players.find(p => p.id === socket.id);
    if (player && player.isHost) {
      room.status = 'playing';

      // Если игроков меньше 4, добавляем AI ботов
      if (room.players.length < 4) {
        const AIBot = require('./core/AIBot');
        const bots = AIBot.generateBots(room.players.length, 4);
        room.players.push(...bots);
      }

      // Всегда отправляем обновленный список игроков и новый статус (чтобы переключился экран)
      io.to(roomCode).emit('room_updated', room);

      console.log(`Игра в комнате ${roomCode} началась с ${room.players.length} игроками!`);
      
      // Инициализируем игровой движок
      room.engine = new GameEngine(roomCode, room.players, io);
      room.engine.start();
    }
  });

  // 5. Игровые действия (Ночь)
  socket.on('night_action', ({ roomCode, targetId }, callback) => {
    const room = rooms.get(roomCode);
    if (room && room.engine) {
      const result = room.engine.handleNightAction(socket.id, targetId);
      if (callback) callback(result);
    } else if (callback) {
      callback({ error: 'Игра не найдена' });
    }
  });

  // 6. Игровые действия (День - Голосование)
  socket.on('day_vote', ({ roomCode, targetId }, callback) => {
    const room = rooms.get(roomCode);
    if (room && room.engine) {
      const result = room.engine.handleDayVote(socket.id, targetId);
      if (callback) callback(result);
    } else if (callback) {
      callback({ error: 'Игра не найдена' });
    }
  });

  // 7. Игровые действия (День - Чат)
  socket.on('send_chat_message', ({ roomCode, message }, callback) => {
    const room = rooms.get(roomCode);
    if (room && room.engine) {
      const result = room.engine.handleChatMessage(socket.id, message);
      if (callback) callback(result);
    } else if (callback) {
      callback({ error: 'Игра не найдена' });
    }
  });

  // 4. Отключение игрока
  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
    
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const disconnectedPlayer = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        console.log(`Игрок ${disconnectedPlayer.name} покинул комнату ${roomCode}`);

        // Если комната пуста — даем 10 минут на переподключение перед полным удалением
        if (room.players.length === 0) {
          console.log(`Комната ${roomCode} опустела. Ожидание 10 минут перед удалением...`);
          room.destroyTimer = setTimeout(() => {
            if (rooms.has(roomCode) && rooms.get(roomCode).players.length === 0) {
              rooms.delete(roomCode);
              console.log(`Комната ${roomCode} удалена окончательно (истек таймер)`);
            }
          }, 10 * 60 * 1000);
        } else {
          // Если вышел хост, назначаем нового (первого в списке)
          if (disconnectedPlayer.isHost) {
            room.players[0].isHost = true;
            console.log(`Новый хост в комнате ${roomCode} — ${room.players[0].name}`);
          }
          // Уведомляем оставшихся
          io.to(roomCode).emit('room_updated', room);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
