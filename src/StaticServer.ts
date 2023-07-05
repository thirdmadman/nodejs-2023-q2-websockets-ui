import { createServer, IncomingMessage, ServerResponse } from 'http';
import { resolve, dirname } from 'path';
import { readFile } from 'fs';
import { FRONTEND_PORT, FRONTEND_HOST } from './common/config';

export class StaticServer {
  constructor() {
    const handleStateContent = (req: IncomingMessage, res: ServerResponse) => {
      const dirPath = resolve(dirname(''));
      const filePath = resolve(dirPath, req.url === '/' ? 'front/index.html' : `front${req.url || ''}`);
      readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end(JSON.stringify(err));
          return;
        }
        res.writeHead(200);
        res.end(data);
      });
    };

    const server = createServer((req, resp) => handleStateContent(req, resp));
    server.listen(FRONTEND_PORT, Number(FRONTEND_HOST), () => {
      // eslint-disable-next-line no-console
      console.log(`Server is running on http://${FRONTEND_HOST}:${FRONTEND_PORT}`);
    });
  }
}
