import dotenv from 'dotenv';
import env from 'env-var';
import _ from 'lodash';

export interface ServerConfig {
	readonly jobsDefinitionFile: string;
	readonly databaseFile: string;
}

export interface ApiConfig {
	readonly port: number;
	readonly reporters: Record<string, string>;
}

class Config {
	_server: ServerConfig;
	_api: ApiConfig;

	constructor() {
		dotenv.config();

		this._server = {
			jobsDefinitionFile: env.get('OVDS_JOBS_DEFS').required().asString(),
			databaseFile: env.get('OVDS_DB').required().asString()
		};

		this._api = {
			port: env.get('OVDS_PORT').default(9000).asPortNumber(),
			reporters: _.fromPairs(
				_.times(
					env.get('OVDS_REPORTERS').required().asIntPositive(),
					i => {
						return [
							env
								.get(`OVDS_REPORTER_${i + 1}_ID`)
								.required()
								.asString(),
							env
								.get(`OVDS_REPORTER_${i + 1}_SECRET`)
								.required()
								.asString()
						];
					}
				)
			)
		};
	}

	public get server() {
		return _.cloneDeep(this._server);
	}

	public get api() {
		return _.cloneDeep(this._api);
	}
}

export default Config;
