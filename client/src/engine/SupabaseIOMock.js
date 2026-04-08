export default class SupabaseIOMock {
  constructor(channel) {
    this.channel = channel;
  }

  to(targetId) {
    return {
      emit: (event, data) => {
        this.channel.send({
          type: 'broadcast',
          event: 'server_to_client',
          payload: { targetId, event, data }
        }).catch(err => console.error('Mock IO Error:', err));
      }
    };
  }

  emit(event, data) {
    this.channel.send({
      type: 'broadcast',
      event: 'server_to_client',
      payload: { targetId: null, event, data }
    }).catch(err => console.error('Mock IO Error:', err));
  }
}
