export interface RoomUser {
  name: string;
  index: number;
}

export interface RoomDTO {
  roomId: number;
  roomUsers: Array<RoomUser>;
}
