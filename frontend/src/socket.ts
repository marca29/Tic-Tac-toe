/*
  SOCKET.IO CLIENT - Real-time connection to game server
 */
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/';
export const socket = io(API); 