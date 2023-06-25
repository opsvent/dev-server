import fs from 'fs';

import Winston from 'winston';

import Api from './api';
import Config from './config';
import Db from './db';
import loadJobDefs from './loadJobDefs';

const logger = Winston.createLogger({
	level: 'debug',
	format: Winston.format.combine(
		Winston.format.timestamp(),
		Winston.format.printf(
			({ timestamp, level, group, message, ...rest }) => {
				const restInfo = Object.keys(rest)
					.map(
						key =>
							`\n\t> ${key.padEnd(15, ' ')} - ${
								rest[key] instanceof Object ||
								rest[key] instanceof Array
									? JSON.stringify(rest[key])
									: rest[key]
							}`
					)
					.join('');

				return `${timestamp} - ${level.padEnd(5, ' ')} - ${(
					group || 'main'
				).padEnd(15, ' ')} - ${message}${restInfo}`;
			}
		)
	),
	transports: [new Winston.transports.Console()]
});

const config = new Config();
const db = new Db(config.server.databaseFile, logger.child({ group: 'db' }));
const api = new Api(config.api, logger.child({ group: 'api' }), db);
let configWatcher: fs.FSWatcher | null = null;

const main = async () => {
	logger.info('OpsVent Dev-Server starting up', {
		version: process.env.npm_package_version
	});

	const config = new Config();

	logger.info('Loading job definitions');
	const jobDefs = await loadJobDefs(config.server.jobsDefinitionFile).catch(
		e => {
			logger.error('Failed to load job definitions', {
				error: e.message
			});
		}
	);
	if (!jobDefs) {
		return;
	}
	logger.info('Finished loading job definitions', {
		count: jobDefs.jobs.length
	});

	logger.info('Start watching for changes in configuration file');
	configWatcher = fs.watch(config.server.jobsDefinitionFile, {}, async () => {
		logger.info('Configuration file changed. Reloading file');
		const newJobDefs = await loadJobDefs(config.server.jobsDefinitionFile);
		jobDefs.generation = newJobDefs.generation;
		jobDefs.jobs = newJobDefs.jobs;
	});

	try {
		await db.connect();
		await api.start(jobDefs);
	} catch (e) {
		logger.error('Error during startup', { error: e });
		exit();
		return;
	}
};

const exit = async () => {
	logger.info('Shutting down');
	configWatcher?.close();
	await db.close().catch(() => {});
	await api.close().catch(() => {});
	logger.info('Bye!');
	process.exit();
};

process.on('SIGTERM', exit);
process.on('SIGINT', exit);

main();
