import { FastifyPluginAsync } from 'fastify';
import Winston from 'winston';

import Db from '../db';
import { JobDefType } from '../jobDefSchemas';

export interface RouteCtx {
	db: Db;
	logger: Winston.Logger;
	jobsDef: JobDefType;
	clients: Record<string, string>;
}

type Route = FastifyPluginAsync<RouteCtx>;

export default Route;
