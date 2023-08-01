import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
const URL = 'http://10.10.12.234:3000';

export const socket = io(URL, {
  autoConnect: false,
});