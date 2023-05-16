export enum JobType {
	http = 'http',
	ping = 'ping',
	keyword = 'keyword',
	script = 'script'
}

export enum PingIPVersion {
	ipv4 = 'ipv4',
	ipv6 = 'ipv6'
}

export interface Job {
	id: number;
	name: string;
	description?: string;
	type: JobType;
	frequency: number;
}

export interface HTTPJob extends Job {
	type: JobType.http;
	endpoint: string;
	allowedHttpStatuses: (number | [number, number])[];
	timeout: number;
}

export interface PingJob extends Job {
	type: JobType.ping;
	version: PingIPVersion;
	endpoint: string;
	timeout: number;
}

export interface KeywordJob extends Job {
	type: JobType.keyword;
	endpoint: string;
	keywords: string[];
	timeout: number;
}

export interface ScriptJob extends Job {
	type: JobType.script;
	script: string;
	timeout: number;
}

export enum MonitorStatus {
	UP,
	DOWN
}
