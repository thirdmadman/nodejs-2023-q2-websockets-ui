import { WebSocketServer, WebSocket } from 'ws';
import { ConnectionHandler } from './ConnectionHandler';

import { BACKEND_HOST, BACKEND_PORT } from './common/config';

export class WSServer {
  private server: WebSocketServer;

  constructor() {
    this.server = new WebSocketServer({ port: Number(BACKEND_PORT) });
    console.log(`WS Server is running on http://${BACKEND_HOST}:${BACKEND_PORT}`);

    const wsConnectionHandler = (ws: WebSocket) => {
      const connectionHandler = new ConnectionHandler(ws, this.server);

      ws.on('message', (data: Buffer) => connectionHandler.handleMessage(data));
    };

    this.server.on('connection', wsConnectionHandler);
  }
}
