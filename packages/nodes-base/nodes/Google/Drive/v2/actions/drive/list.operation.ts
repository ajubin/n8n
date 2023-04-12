import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { updateDisplayOptions } from '../../../../../../utils/utilities';
import { returnAllOrLimit } from '../common.descriptions';
import { googleApiRequest, googleApiRequestAllItems } from '../../transport';

const properties: INodeProperties[] = [
	...returnAllOrLimit,
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Query',
				name: 'q',
				type: 'string',
				default: '',
				description:
					'Query string for searching shared drives. See the <a href="https://developers.google.com/drive/api/v3/search-shareddrives">"Search for shared drives"</a> guide for supported syntax.',
			},
			{
				displayName: 'Use Domain Admin Access',
				name: 'useDomainAdminAccess',
				type: 'boolean',
				default: false,
				description:
					'Whether to issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs. (Default: false).',
			},
		],
	},
];

const displayOptions = {
	show: {
		resource: ['drive'],
		operation: ['list'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	i: number,
	options: IDataObject,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	const returnAll = this.getNodeParameter('returnAll', i);

	const qs: IDataObject = {};

	let response: IDataObject[] = [];

	Object.assign(qs, options);

	if (returnAll) {
		response = await googleApiRequestAllItems.call(
			this,
			'drives',
			'GET',
			'/drive/v3/drives',
			{},
			qs,
		);
	} else {
		qs.pageSize = this.getNodeParameter('limit', i);
		const data = await googleApiRequest.call(this, 'GET', '/drive/v3/drives', {}, qs);
		response = data.drives as IDataObject[];
	}

	const executionData = this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(response),
		{ itemData: { item: i } },
	);

	returnData.push(...executionData);

	return returnData;
}
