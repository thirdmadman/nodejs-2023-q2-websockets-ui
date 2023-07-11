import { IRoom } from '../interfaces/IRoom';
import { GenericRepository } from './GenericRepository';

class RoomRepository extends GenericRepository<IRoom> {
  findAllOwnRoomsByPlayerId(playerId: number) {
    const allRooms = this.findAll();

    if (!allRooms || allRooms.length === 0) {
      return null;
    }

    const playerOwnRooms = allRooms.filter((room) => room.ownerPlayerId === playerId);

    if (!playerOwnRooms || playerOwnRooms.length === 0) {
      return null;
    }

    return playerOwnRooms;
  }
}
export const roomRepository = new RoomRepository('room');
