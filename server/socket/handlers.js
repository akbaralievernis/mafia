const roomManager = require('../game/RoomManager');

function setupHandlers(io, socket) {
  socket.on('createRoom', ({ roomId, playerName }, callback) => {
    const created = roomManager.createRoom(roomId);
    if (!created) {
      return callback({ error: 'Room already exists' });
    }
    
    const result = roomManager.joinRoom(roomId, { name: playerName, socketId: socket.id });
    if (result.error) return callback(result);

    socket.join(roomId);
    callback({ success: true, room: result.room });
  });

  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const result = roomManager.joinRoom(roomId, { name: playerName, socketId: socket.id });
    if (result.error) return callback(result);

    socket.join(roomId);
    io.to(roomId).emit('roomUpdated', result.room);
    callback({ success: true, room: result.room });
  });

  socket.on('startGame', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (room && room.game) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && player.isHost) {
        room.game.start(io);
      }
    }
  });

  socket.on('action', ({ roomId, targetName }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.game.handleAction(socket.id, targetName, io);
    }
  });

  socket.on('disconnect', () => {
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      const { roomId, room } = result;
      if (room) {
        io.to(roomId).emit('roomUpdated', roomManager.getRoomData(roomId));
      }
    }
  });
}

module.exports = setupHandlers;
