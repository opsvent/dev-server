import 'reflect-metadata';
import { getConnectionManager } from 'typeorm';
import Winston from 'winston';

import * as models from './models';

class Db {
	private logger: Winston.Logger;
	private connection;

	constructor(dbFile: string, logger: Winston.Logger) {
		this.logger = logger;

		this.logger.info('Initializing database');

		this.logger.debug('Getting connection manager');
		const cm = getConnectionManager();

		this.logger.debug('Creating connection');
		this.connection = cm.create({
			type: 'sqlite',
			database: dbFile,
			synchronize: true,
			entities: Object.values(models)
		});
	}

	public async connect() {
		this.logger.info('Connecting to database');
		try {
			await this.connection.connect();
			this.logger.info('Connection estabilished');
		} catch (e) {
			this.logger.error('Failed to connect to database', { error: e });
			throw e;
		}
	}

	public async close() {
		this.logger.info('Closing database');
		try {
			await this.connection.close();
		} catch (e) {
			this.logger.warn('Exception while closing connection', {
				error: e
			});
		}
		this.logger.info('Database connection closed');
	}

	public get conn() {
		return this.connection;
	}
}

export default Db;
