/**
 * Genera un fixture round-robin simple.
 * @param {number[]} teamIds IDs de equipos
 * @returns Array de rondas; cada ronda es array de partidos {home, away}
 */
function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  // Si hay impar, agregamos 'bye' (null)
  if (teams.length % 2 !== 0) teams.push(null);

  const n = teams.length;
  const roundsCount = n - 1;
  const rounds = [];

  for (let r = 0; r < roundsCount; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home !== null && away !== null) {
        // Alternamos localía ligeramente
        if (r % 2 === 0) round.push({ home, away });
        else round.push({ home: away, away: home });
      }
    }
    rounds.push(round);
    // Rotación "método del círculo"
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop());
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

module.exports = { generateRoundRobin };
