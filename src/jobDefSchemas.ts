import { Type, Static } from '@sinclair/typebox';

import { JobType, PingIPVersion } from './types';

const baseJob = {
	id: Type.Number(),
	name: Type.String(),
	description: Type.Optional(Type.String()),
	type: Type.Enum(JobType),
	frequency: Type.Number({ minimum: 1 })
};

export const HTTPJobSchema = Type.Object({
	...baseJob,
	endpoint: Type.String(),
	allowedHttpStatuses: Type.Array(
		Type.Union([
			Type.Number({ minimum: 100, maximum: 599 }),
			Type.Tuple([
				Type.Number({ minimum: 100, maximum: 599 }),
				Type.Number({ minimum: 100, maximum: 599 })
			])
		])
	),
	timeout: Type.Number({ maximum: 30 })
});
export type HTTPJobType = Static<typeof HTTPJobSchema>;

export const PingJobSchema = Type.Object({
	...baseJob,
	version: Type.Enum(PingIPVersion),
	endpoint: Type.String(),
	timeout: Type.Number({ maximum: 30 })
});
export type PingJobType = Static<typeof PingJobSchema>;

export const KeywordJobSchema = Type.Object({
	...baseJob,
	endpoint: Type.String(),
	keywords: Type.Array(Type.String()),
	timeout: Type.Number({ maximum: 30 })
});
export type KeywordJobType = Static<typeof KeywordJobSchema>;

export const ScriptJobSchema = Type.Object({
	...baseJob,
	script: Type.String(),
	timeout: Type.Number({ maximum: 120 })
});
export type ScriptJobType = Static<typeof ScriptJobSchema>;

export const JobDefSchema = Type.Object({
	generation: Type.Number({ minimum: 1 }),
	jobs: Type.Array(
		Type.Union([
			HTTPJobSchema,
			PingJobSchema,
			KeywordJobSchema,
			ScriptJobSchema
		])
	)
});
export type JobDefType = Static<typeof JobDefSchema>;
