import {
	subHours,
	addHours,
	Interval,
	areIntervalsOverlapping,
	min,
	max,
	subDays,
	startOfDay,
	addDays,
	format
} from 'date-fns';
import { differenceInSeconds } from 'date-fns/fp';
import _ from 'lodash';
import { LessThan, MoreThanOrEqual } from 'typeorm';

import { MonitorLog } from '../../models';
import { MonitorStatus } from '../../types';
import Route from '../Route';

const getOverlappingSeconds = (a: Interval, b: Interval) => {
	if (areIntervalsOverlapping(a, b, { inclusive: true })) {
		return -differenceInSeconds(
			min([a.end, b.end]),
			max([a.start, b.start])
		);
	}

	return 0;
};

const DashboardRoute: Route = async (fastify, ctx) => {
	fastify.get('/dashboard', async (req, resp) => {
		return resp.view('/src/api/views/dashboard.ejs', {
			monitors: await Promise.all(
				ctx.jobsDef.jobs.map(async jobDef => {
					// get events from the last 30 days
					const events = await ctx.db.conn
						.getRepository(MonitorLog)
						.find({
							where: {
								monitorId: jobDef.id,
								timestamp: MoreThanOrEqual(
									subDays(startOfDay(new Date()), 30)
								)
							},
							order: { timestamp: 'ASC' }
						});

					// get the last event before our threshold to get the
					// starting state
					const startEvent = await ctx.db.conn
						.getRepository(MonitorLog)
						.findOne({
							where: {
								monitorId: jobDef.id,
								timestamp: LessThan(
									events[0]?.timestamp || new Date()
								)
							},
							order: { timestamp: 'DESC' }
						});

					const allEvents = [
						...(startEvent ? [startEvent] : []),
						...events
					];

					const current = _.last(allEvents);
					const startTs =
						_.minBy(allEvents, 'timestamp')?.timestamp ||
						new Date();

					const downtimeIntervals: { start: Date; end: Date }[] =
						allEvents.reduce((acc, cur) => {
							const last = _.last(acc);

							if (cur.toStatus == MonitorStatus.DOWN) {
								// start downtime
								return [
									...acc,
									{ start: cur.timestamp, end: new Date() }
								];
							}

							if (
								last &&
								cur.fromStatus == MonitorStatus.DOWN &&
								cur.toStatus == MonitorStatus.UP
							) {
								// end downtime
								return [
									...acc.slice(0, -1),
									{ start: last.start, end: cur.timestamp }
								];
							}

							return acc;
						}, [] as { start: Date; end: Date }[]);

					const last24Hours = _.times(24, i => {
						const ts = subHours(new Date(), 24 - i);
						const hour = {
							start: ts,
							end: addHours(ts, 1)
						};

						if (ts < startTs) {
							// not recorded yet
							return {
								label: `${24 - i} hours ago`,
								uptime: -1
							};
						}

						const downtime = downtimeIntervals.reduce(
							(acc, cur) =>
								acc + getOverlappingSeconds(hour, cur),
							0
						);

						const upPercent =
							Math.round(((3600 - downtime) / 3600) * 100) / 100;

						return {
							label: `${24 - i} hours ago\n${
								upPercent * 100
							}% up`,
							uptime: upPercent
						};
					});

					const last60Days = _.times(60, i => {
						const ts = subDays(startOfDay(new Date()), 60 - i);
						const day = {
							start: ts,
							end: addDays(ts, 1)
						};

						if (ts < startTs) {
							// not recorded yet
							return {
								label: `${format(ts, 'MMM d')}`,
								uptime: -1
							};
						}

						const downtime = downtimeIntervals.reduce(
							(acc, cur) => acc + getOverlappingSeconds(day, cur),
							0
						);

						const upPercent =
							Math.round(((86400 - downtime) / 86400) * 100) /
							100;

						return {
							label: `${format(ts, 'MMM d')}\n${
								upPercent * 100
							}% up`,
							uptime: upPercent
						};
					});

					return {
						...jobDef,
						current,
						up:
							current?.toStatus == MonitorStatus.UP
								? true
								: false,
						last24Hours,
						last60Days
					};
				})
			)
		});
	});
};

export default DashboardRoute;
