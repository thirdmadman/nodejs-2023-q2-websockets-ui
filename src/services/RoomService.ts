import { AddPlayerDTO } from '../dto/request/AddPlayerDTO';

export class RoomService {
  convertAddPlayerRequest(messageData: string) {
    try {
      const addPlayerDTO = JSON.parse(messageData) as AddPlayerDTO;
      if (!addPlayerDTO || addPlayerDTO.indexRoom === undefined) {
        return null;
      }
      return addPlayerDTO;
    } catch (e) {
      console.error(e);
    }
    return null;
  }
}
