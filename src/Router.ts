/* eslint-disable class-methods-use-this */
import { WebSocket } from 'ws';
import { IRouteObject, RouterCallback } from './interfaces/IRouteObject';

export class Router {
  routes: Array<IRouteObject> = [];

  prefix = '';

  setPrefix(prefix: string) {
    this.prefix = prefix;
  }

  addRoute(route: string, callback: RouterCallback) {
    this.routes.push({ route, callback } as IRouteObject);
  }

  removeRoute(route: string) {
    this.routes = this.routes.filter((r) => r.route !== route);
  }

  handle(reqRoute: string, ws: WebSocket, messageData: string) {
    if (reqRoute && this.routes && this.routes.length > 0) {
      try {
        const currentRoute = this.routes.find((route) => reqRoute.indexOf(route.route) === 0);
        if (currentRoute) {
          currentRoute.callback(ws, messageData);
        }
      } catch (e) {
        // console.error(e);
        // res.writeHead(500);
        // res.end(JSON.stringify({ errors: [{ title: 'Error while handling request' }] }));
      }
    }

    // res.writeHead(404);
    // res.end(JSON.stringify({ errors: [{ title: 'Resource not found' }] }));
  }
}
