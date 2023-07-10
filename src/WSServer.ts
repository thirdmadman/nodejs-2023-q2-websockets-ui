/* eslint-disable max-classes-per-file */
import { WebSocketServer, WebSocket } from 'ws';
import { ConnectionHandler } from './ConnectionHandler';

import { BACKEND_HOST, BACKEND_PORT } from './common/config';
import { WSGlobalEventHandler } from './WSGlobalEventHandler';
import { CommunicationDTOTypes } from './dto/CommunicationDTO';

export class WSServer {
  private server: WebSocketServer;

  private wsGlobalEventHandler = new WSGlobalEventHandler();

  constructor() {
    this.server = new WebSocketServer({ port: Number(BACKEND_PORT) });
    console.log(`WS Server is running on http://${BACKEND_HOST}:${BACKEND_PORT}`);

    const wsConnectionHandler = (ws: WebSocket) => {
      const connectionHandler = new ConnectionHandler(ws, this.server);
      this.wsGlobalEventHandler.addConnection(connectionHandler);
      const handler = (playerId: number, messageType: CommunicationDTOTypes, message: string) => {
        const res = this.wsGlobalEventHandler.sentToClientWithPlayerId(playerId, messageType, message);
        return res;
      };
      connectionHandler.onSendMessageToPlayerWithId = handler;

      ws.on('message', (data: Buffer) => connectionHandler.handleMessage(data));
      ws.on('close', () => connectionHandler.onClose());
    };

    this.server.on('connection', wsConnectionHandler);
  }
}
