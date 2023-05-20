import fs from 'fs/promises';

import YAML from 'yaml';

import { JobDefSchema, JobDefType } from './jobDefSchemas';
import validatorFactory from './schemaValidator';

const loadJobDefs = async (file: string) => {
	const contents = await fs.readFile(file);
	const parsed = YAML.parse(contents.toString('utf-8'));

	const validator = validatorFactory<JobDefType>(JobDefSchema);

	const data = validator.verify(parsed);

	return data;
};

export default loadJobDefs;
