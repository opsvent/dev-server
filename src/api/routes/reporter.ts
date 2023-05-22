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

	const checkAuth = (req: FastifyRequest) => {
		try {
			const sig = req.headers.authorization;
			if (!sig) {
				throw new Error('Authorization header missing');
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
					id: 'DEV_KID',
					key: ctx.secret
				}
			);

			nonceValidator.validate(nonce);
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
	const monitorStatus: Map<number, MonitorStatus> = new Map();
	for (const job of ctx.jobsDef.jobs) {
		const lastEntry = await ctx.db.conn.getRepository(MonitorLog).findOne({
			where: {
				monitorId: job.id
			},
			order: {
				timestamp: 'DESC'
			}
		});
		if (lastEntry) {
			monitorStatus.set(job.id, lastEntry.toStatus);
		}
	}

	fastify.post<{ Body: Static<typeof ReportBodySchema> }>(
		'/reporter/report',
		{ schema: { body: ReportBodySchema } },
		async req => {
			ctx.logger.info('Request to /reporter/report');
			checkAuth(req);

			if (req.body.generation !== ctx.jobsDef.generation) {
				throw new BadRequest('Invalid generation');
			}

			const reported = req.body.ok
				? MonitorStatus.UP
				: MonitorStatus.DOWN;
			if (monitorStatus.get(req.body.monitor) != reported) {
				ctx.logger.debug('Updating monitor status', {
					monitor: req.body.monitor,
					from: monitorStatus.get(req.body.monitor),
					to: reported
				});

				const log = new MonitorLog();
				log.monitorId = req.body.monitor;
				log.timestamp = new Date();
				log.fromStatus =
					monitorStatus.get(req.body.monitor) ?? MonitorStatus.DOWN;
				log.toStatus = reported;
				log.description = req.body.message ?? '';

				await ctx.db.conn.getRepository(MonitorLog).save(log);
				monitorStatus.set(req.body.monitor, reported);
			} else {
				ctx.logger.debug('Got same reported value', {
					monitor: req.body.monitor
				});
			}

			return { generation: ctx.jobsDef.generation, status: 'ok' };
		}
	);
};

export default ReporterRoute;
