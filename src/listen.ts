import { WSServer } from './WSServer';
import { StaticServer } from './StaticServer';

const staticServer = new StaticServer();
const wsServer = new WSServer();

try {
  staticServer.run();
} catch (err) {
  console.error(err);
}

try {
  wsServer.run();
} catch (err) {
  console.error(err);
}
