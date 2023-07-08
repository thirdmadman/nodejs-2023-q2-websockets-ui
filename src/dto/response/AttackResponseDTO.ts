export type TAttackStatus = 'miss' | 'killed' | 'shot';
export interface AttackResponseDTO {
  position: {
    x: number;
    y: number;
  };
  currentPlayer: number;
  status: TAttackStatus;
}
