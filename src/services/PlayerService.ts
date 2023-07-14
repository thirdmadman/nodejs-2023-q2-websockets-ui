import { PlayerRequestDTO } from '../dto/request/PlayerRequestDTO';
import { IPlayer } from '../interfaces/IPlayer';
import { playerRepository } from '../repository/PlayerRepository';

export class PlayerService {
  convertPlayerRegRequest(messageData: string) {
    try {
      const playerDTO = JSON.parse(messageData) as PlayerRequestDTO;

      if (!playerDTO || playerDTO.name === undefined || playerDTO.password === undefined) {
        return null;
      }

      if (playerDTO.name.length < 5 || playerDTO.password.length < 5) {
        return null;
      }

      return playerDTO;
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  registerPlayer(playerDTO: PlayerRequestDTO) {
    const newPlayer: IPlayer = {
      id: 1,
      name: playerDTO.name,
      password: playerDTO.password,
      score: 0,
      isOnline: true,
    };

    return playerRepository.create(newPlayer);
  }
}
