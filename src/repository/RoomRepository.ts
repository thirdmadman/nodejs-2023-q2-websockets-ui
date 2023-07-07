import { IRoom } from '../interfaces/IRoom';
import { GenericRepository } from './GenericRepository';

class RoomRepository extends GenericRepository<IRoom> {}
export const roomRepository = new RoomRepository('room');
