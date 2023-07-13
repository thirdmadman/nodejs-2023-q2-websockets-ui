export const AllCommunicationDTOTypes = [
  'reg',
  'create_room',
  'add_user_to_room',
  'create_game',
  'add_ships',
  'start_game',
  'turn',
  'attack',
  'randomAttack',
  'finish',
  'update_room',
  'update_winners',
  'single_play',
] as const;
export type CommunicationDTOTypes = (typeof AllCommunicationDTOTypes)[number];
export interface CommunicationDTO {
  type: CommunicationDTOTypes;
  data: string;
  id: number;
}
