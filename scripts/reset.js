import { resetDatabase } from '../server/db.js';

resetDatabase();
console.log('Lab reset: accounts, products, orders, sessions, events and evidence restored. Mode is back to vulnerable.');
console.log('If the server is running, sign in again. Old lab_session cookies no longer match any session.');
