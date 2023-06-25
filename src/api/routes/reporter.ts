import hmac from '@opsvent/hmac';
import { Type, Static } from '@sinclair/typebox';
import { FastifyRequest } from 'fastify';
import { BadRequest, Unauthorized } from 'http-errors';
import _ from 'lodash';

import { MonitorLog } from '../../models';
import NonceValidator from '../../nonceValidator';
import { MonitorStatus } from '../../types';
import Route from '../Route';

const ReportBodySchema = Type.Object({
	generation: Type.Number(),
	monitor: Type.Number(),
	ok: Type.Boolean(),
	message: Type.Optional(Type.String())
});

const ReporterRoute: Route = async (fastify, ctx) => {
	const nonceValidator = new NonceValidator(600); // 10 minute window

	const checkAuth = (req: FastifyRequest): string => {
		try {
			const sig = req.headers.authorization;
			if (!sig) {
				throw new Error('Authorization header missing');
			}

			const client = hmac.getKeyIdFromSignature(sig);
			const clientSecret = ctx.clients[client];

			if (!clientSecret) {
				throw new Error('Unknown client: ' + client);
			}

			const nonce = hmac.verify(
				sig,
				{
					method: req.method,
					url: req.routerPath,
					body: req.rawBody?.toString() || '',
					timeWindow: 600
				},
				{
					id: client,
					key: clientSecret
				}
			);

			nonceValidator.validate(nonce);

			return client;
		} catch (e) {
			ctx.logger.info('Unauthorized request', {
				reason: (e as any)?.message
			});
			throw new Unauthorized((e as any)?.message || undefined);
		}
	};

	fastify.get('/reporter/generation', req => {
		ctx.logger.info('Request to /reporter/generation');
		checkAuth(req);

		return {
			generation: ctx.jobsDef.generation
		};
	});

	fastify.get('/reporter/definitions', req => {
		ctx.logger.info('Request to /reporter/definitions');
		checkAuth(req);

		return {
			generation: ctx.jobsDef.generation,
			definitions: ctx.jobsDef.jobs.map(jobDef =>
				_.omit(jobDef, ['name', 'description'])
			)
		};
	});

	// get last statuses
	const monitorStatus: Map<string, MonitorStatus> = new Map();
	for (const job of ctx.jobsDef.jobs) {
		for (const reporter of Object.keys(ctx.clients)) {
			const lastEntry = await ctx.db.conn
				.getRepository(MonitorLog)
				.findOne({
					where: {
						monitorId: job.id,
						reporterNode: reporter
					},
					order: {
						timestamp: 'DESC'
					}
				});
			if (lastEntry) {
				monitorStatus.set(`${reporter}:${job.id}`, lastEntry.toStatus);
			}
		}
	}

	fastify.post<{ Body: Static<typeof ReportBodySchema> }>(
		'/reporter/report',
		{ schema: { body: ReportBodySchema } },
		async req => {
			ctx.logger.info('Request to /reporter/report');
			const client = checkAuth(req);

			if (req.body.generation !== ctx.jobsDef.generation) {
				throw new BadRequest('Invalid generation');
			}

			const cacheKey = `${req.body.monitor}:${client}`;
			const reported = req.body.ok
				? MonitorStatus.UP
				: MonitorStatus.DOWN;
			if (monitorStatus.get(cacheKey) != reported) {
				ctx.logger.debug('Updating monitor status', {
					monitor: req.body.monitor,
					instance: client,
					from: monitorStatus.get(cacheKey),
					to: reported
				});

				const log = new MonitorLog();
				log.monitorId = req.body.monitor;
				log.reporterNode = client;
				log.timestamp = new Date();
				log.fromStatus =
					monitorStatus.get(cacheKey) ?? MonitorStatus.DOWN;
				log.toStatus = reported;
				log.description = req.body.message ?? '';

				await ctx.db.conn.getRepository(MonitorLog).save(log);
				monitorStatus.set(cacheKey, reported);
			} else {
				ctx.logger.debug('Got same reported value', {
					monitor: req.body.monitor,
					instance: client
				});
			}

			return { generation: ctx.jobsDef.generation, status: 'ok' };
		}
	);
};

export default ReporterRoute;
