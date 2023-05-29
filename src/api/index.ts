import FastifyView from '@fastify/view';
import Ejs from 'ejs';
import Fastify from 'fastify';
import FastifyRawBody from 'fastify-raw-body';
import Winston from 'winston';

import { ApiConfig } from '../config';
import Db from '../db';
import { JobDefType } from '../jobDefSchemas';

import * as routes from './routes';

class Api {
	private config: ApiConfig;
	private logger: Winston.Logger;
	private fastify;
	private db: Db;

	constructor(config: ApiConfig, logger: Winston.Logger, db: Db) {
		this.config = config;
		this.logger = logger;
		this.db = db;

		this.logger.info('Initializing API');

		this.fastify = Fastify();
		this.fastify.register(FastifyRawBody);
		this.fastify.register(FastifyView, {
			engine: {
				ejs: Ejs
			}
		});
	}

	public async start(jobsDef: JobDefType) {
		this.logger.info('Starting API');
		this.logger.debug('Registering routes');
		for (const route of Object.values(routes)) {
			await this.fastify.register(route, {
				db: this.db,
				logger: this.logger,
				jobsDef,
				secret: this.config.secret
			});
		}

		this.logger.info('Starting listening');
		await this.fastify.listen({ port: this.config.port });

		this.logger.info('Ready to respond to requests', {
			port: this.config.port
		});
	}

	public async close(): Promise<void> {
		this.logger.info('Closing API server');
		await this.fastify.close().catch(() => {});
	}
}

export default Api;
