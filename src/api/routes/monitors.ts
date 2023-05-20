import Route from '../Route';

const MonitorsRoute: Route = async (fastify, ctx) => {
	fastify.get('/monitors', () => {
		return ctx.jobsDef.jobs;
	});
};

export default MonitorsRoute;
