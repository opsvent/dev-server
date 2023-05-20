import { Type, Static } from '@sinclair/typebox';
import _ from 'lodash';

import { MonitorLog } from '../../models';
import { MonitorStatus } from '../../types';
import Route from '../Route';

const ReportBodySchema = Type.Object({
	monitor: Type.Number(),
	ok: Type.Boolean(),
	message: Type.Optional(Type.String())
});

const ReporterRoute: Route = async (fastify, ctx) => {
	fastify.get('/reporter/generation', () => {
		return {
			generation: ctx.jobsDef.generation
		};
	});

	fastify.get('/reporter/definitions', () => {
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
					monitorStatus.get(req.body.monitor) || MonitorStatus.DOWN;
				log.toStatus = reported;
				log.description = req.body.message || '';

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
