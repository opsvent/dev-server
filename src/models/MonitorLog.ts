import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

import { MonitorStatus } from '../types';

@Entity('monitor_log')
class MonitorLog {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column()
	monitorId!: number;

	@Column('varchar', { length: 255 })
	reporterNode!: string;

	@Column()
	timestamp!: Date;

	@Column()
	fromStatus!: MonitorStatus;

	@Column()
	toStatus!: MonitorStatus;

	@Column('varchar', { length: 255 })
	description!: string;
}

export default MonitorLog;
