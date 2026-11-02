// Keeps the most recent database queries in memory for the Lab 4 query inspector.
const MAX = 40;
let log = [];

export function recordQuery(entry) {
  log.unshift({ at: new Date().toISOString(), ...entry });
  log = log.slice(0, MAX);
}

export const recentQueries = () => log;
export const clearQueries = () => { log = []; };
