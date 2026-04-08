class RoleDistributor {
  static assignRoles(players) {
    const validPlayers = players.filter(p => p !== null && p !== undefined);
    const hostPlayer = validPlayers.find(p => p.isHost);
    const activePlayers = validPlayers.filter(p => !p.isHost);
    
    const count = activePlayers.length;
    if (count < 4) throw new Error("Недостаточно игроков для старта игры (минимум 4 помимо создателя)");

    const rolesArray = [];
    let mafiaCount = Math.floor(count / 4) || 1; 
    
    if (count >= 10) {
      rolesArray.push('don'); 
      mafiaCount = Math.max(1, mafiaCount - 1);
      rolesArray.push('maniac'); 
    }

    for (let i = 0; i < mafiaCount; i++) rolesArray.push('mafia');
    rolesArray.push('doctor');
    rolesArray.push('detective'); 

    const citizensCount = count - rolesArray.length;
    for (let i = 0; i < citizensCount; i++) rolesArray.push('citizen');

    for (let i = rolesArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
    }

    const assignedRoles = {};
    if (hostPlayer) assignedRoles[hostPlayer.id] = 'spectator';
    activePlayers.forEach((player, index) => {
      assignedRoles[player.id] = rolesArray[index];
    });

    return assignedRoles;
  }
}

export default RoleDistributor;
