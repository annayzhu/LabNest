export const acceptanceBase = process.env.LABNEST_ACCEPTANCE_URL ?? 'http://localhost:3232';
if (!['http://localhost:3232','http://localhost:3233'].includes(acceptanceBase)) throw new Error('Use the isolated acceptance service on localhost:3232 or localhost:3233.');
