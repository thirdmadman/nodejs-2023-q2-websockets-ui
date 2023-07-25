import { ConnectionHandler } from './ConnectionHandler';
import { CommunicationDTOTypes } from './dto/CommunicationDTO';

export class WSGlobalEventHandler {
  private connections = Array<ConnectionHandler>();

  sentToClientWithPlayerId(playerId: number, messageType: CommunicationDTOTypes, message: string) {
    if (!this.connections || this.connections.length <= 0) {
      return null;
    }

    const playerConnection = this.connections.find((con) => con.getPlayerId() === playerId);
    if (!playerConnection) {
      return null;
    }

    playerConnection.sendToPlayer(messageType, message);

    return null;
  }

  addConnection(con: ConnectionHandler) {
    this.connections.push(con);
  }
}
