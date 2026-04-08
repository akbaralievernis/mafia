const GameManager = require('./GameManager');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        players: [],
        game: new GameManager(roomId, this),
      });
      return true;
    }
    return false;
  }

  joinRoom(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    
    if (room.game.state !== 'lobby') {
      return { error: 'Game already started' };
    }

    if (room.players.find(p => p.name === player.name)) {
      return { error: 'Name already taken in this room' };
    }

    room.players.push({
      ...player,
      isAlive: true,
      role: null,
      isHost: room.players.length === 0 // first player is host
    });

    return { success: true, room: this.getRoomData(roomId) };
  }

  leaveRoom(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        // If it was host, assign new host
        if (player.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
        }

        // If room empty, delete
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        }

        return { roomId, player, room: this.rooms.get(roomId) };
      }
    }
    return null;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomData(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      id: room.id,
      players: room.players.map(p => ({
        name: p.name,
        isHost: p.isHost,
        isAlive: p.isAlive,
        isDisconnected: p.isDisconnected
      })),
      gameState: room.game.state,
      gamePhase: room.game.phase
    };
  }
}

module.exports = new RoomManager();
