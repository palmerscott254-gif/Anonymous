/**
 * Socket Event Handler Setup
 * Registers all socket.io event listeners
 */

import { sessionController } from '../controllers/sessionController.js';
import { roomController } from '../controllers/roomController.js';
import { messageController } from '../controllers/messageController.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const sessionId = socket.id;
    console.log(`[SESSION] ${sessionId} connected`);

    // Session events
    socket.on('session.hello', (payload) => {
      sessionController.handleSessionHello(socket, sessionId, payload);
    });

    // Room events
    socket.on('room.generate_code', (payload) => {
      roomController.handleRoomGenerateCode(socket, sessionId, payload, io);
    });

    socket.on('room.join', (payload) => {
      roomController.handleRoomJoin(socket, sessionId, payload, io);
    });

    socket.on('room.leave', (payload) => {
      roomController.handleRoomLeave(socket, sessionId, payload, io);
    });

    // Message events
    socket.on('msg.send', async (payload) => {
      await messageController.handleMessageSend(socket, sessionId, payload, io);
    });

    socket.on('typing.set', (payload) => {
      messageController.handleTypingSet(socket, sessionId, payload, io);
    });

    socket.on('msg.read', (payload) => {
      messageController.handleMessageRead(socket, sessionId, payload, io);
    });

    // Cleanup
    socket.on('disconnect', () => {
      roomController.handleDisconnect(sessionId, io);
    });
  });
}
