import { Type, Static } from '@sinclair/typebox';
import { NotFound } from 'http-errors';

import { MonitorLog } from '../../models';
import Route from '../Route';

const MonitorGetSchema = Type.Object({
	id: Type.Number()
});

const MonitorsRoute: Route = async (fastify, ctx) => {
	fastify.get('/monitors', () => {
		return ctx.jobsDef.jobs;
	});

	const jobIds = ctx.jobsDef.jobs.map(job => job.id);
	fastify.get<{ Params: Static<typeof MonitorGetSchema> }>(
		'/monitors/:id',
		{
			schema: {
				params: MonitorGetSchema
			}
		},
		async req => {
			if (!jobIds.includes(req.params.id)) {
				throw new NotFound();
			}

			return {
				...ctx.jobsDef.jobs.find(job => job.id == req.params.id),
				log: await ctx.db.conn.getRepository(MonitorLog).find({
					where: {
						monitorId: req.params.id
					},
					order: { timestamp: 'ASC' }
				})
			};
		}
	);
};

export default MonitorsRoute;
