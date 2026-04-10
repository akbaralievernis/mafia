/**
 * SupabaseIOMock — emulates the Socket.io server-side API (io.to().emit / io.emit)
 * so GameEngine, NightPhase, DayPhase, WinChecker can be used unchanged.
 *
 * Key behaviour:
 *  - io.to(targetId).emit(event, data)  → sends a targeted Supabase broadcast
 *  - io.to(roomId).emit(event, data)    → also sends to everyone (targetId = null)
 *  - io.emit(event, data)               → sends to everyone (targetId = null)
 *
 *  In BOTH cases the message is ALSO fired locally on the host's eventBus
 *  so the host UI receives every event without an extra network round-trip.
 */
export default class SupabaseIOMock {
  /**
   * @param {object} channel   - Supabase RealtimeChannel
   * @param {object} eventBus  - Local event bus (has .emit(event, data))
   * @param {string} hostId    - The host's own player ID
   * @param {string} roomId    - The room code / channel name (used for room-wide emits)
   */
  constructor(channel, eventBus, hostId, roomId) {
    this.channel = channel;
    this.eventBus = eventBus;
    this.hostId = hostId;
    this.roomId = roomId;
  }

  /** Send to a specific player (or the whole room if targetId === roomId) */
  to(targetId) {
    const isBroadcast = !targetId || targetId === this.roomId;
    return {
      emit: (event, data) => {
        // Fire locally for the host
        this.eventBus.emit(event, data);

        // Send over Supabase to guests
        this.channel?.send({
          type: 'broadcast',
          event: 'server_to_client',
          payload: {
            event,
            data,
            targetId: isBroadcast ? null : targetId
          }
        }).catch(err => console.error('[SupabaseIOMock] to().emit error:', err));
      }
    };
  }

  /** Broadcast to everyone (no specific target) */
  emit(event, data) {
    this.eventBus.emit(event, data);

    this.channel?.send({
      type: 'broadcast',
      event: 'server_to_client',
      payload: { event, data, targetId: null }
    }).catch(err => console.error('[SupabaseIOMock] emit error:', err));
  }
}
