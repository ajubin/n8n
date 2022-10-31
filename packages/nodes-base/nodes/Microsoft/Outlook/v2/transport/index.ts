import { OptionsWithUri } from 'request';
import { IExecuteFunctions, IExecuteSingleFunctions, ILoadOptionsFunctions } from 'n8n-core';
import { IDataObject, INodeExecutionData, NodeApiError } from 'n8n-workflow';

export async function microsoftApiRequest(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	// tslint:disable-next-line:no-any
	body: any = {},
	qs: IDataObject = {},
	uri?: string,
	headers: IDataObject = {},
	option: IDataObject = { json: true },
	// tslint:disable-next-line:no-any
): Promise<any> {
	const credentials = await this.getCredentials('microsoftOutlookOAuth2Api');

	let apiUrl = `https://graph.microsoft.com/v1.0/me${resource}`;
	// If accessing shared mailbox
	if (credentials.useShared && credentials.userPrincipalName) {
		apiUrl = `https://graph.microsoft.com/v1.0/users/${credentials.userPrincipalName}${resource}`;
	}

	const options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body,
		qs,
		uri: uri || apiUrl,
	};
	try {
		Object.assign(options, option);

		if (Object.keys(headers).length !== 0) {
			options.headers = Object.assign({}, options.headers, headers);
		}

		if (Object.keys(body).length === 0) {
			delete options.body;
		}

		return await this.helpers.requestWithAuthentication.call(
			this,
			'microsoftOutlookOAuth2Api',
			options,
		);
	} catch (error) {
		let message = (error.message as string) || '';
		if (
			message.toLowerCase().includes('bad request') ||
			message.toLowerCase().includes('unknown error')
		) {
			message = error.description;
		}

		throw new NodeApiError(this.getNode(), error, {
			message,
			...error,
		});
	}
}

export async function microsoftApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	// tslint:disable-next-line:no-any
	body: any = {},
	query: IDataObject = {},
	headers: IDataObject = {},
	// tslint:disable-next-line:no-any
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;
	query['$top'] = 100;

	do {
		responseData = await microsoftApiRequest.call(
			this,
			method,
			endpoint,
			body,
			query,
			uri,
			headers,
		);
		uri = responseData['@odata.nextLink'];
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (responseData['@odata.nextLink'] !== undefined);

	return returnData;
}

export async function microsoftApiRequestAllItemsSkip(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	// tslint:disable-next-line:no-any
	body: any = {},
	query: IDataObject = {},
	headers: IDataObject = {},
	// tslint:disable-next-line:no-any
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;
	query['$top'] = 100;
	query['$skip'] = 0;

	do {
		responseData = await microsoftApiRequest.call(
			this,
			method,
			endpoint,
			body,
			query,
			undefined,
			headers,
		);
		query['$skip'] += query['$top'];
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (responseData['value'].length !== 0);

	return returnData;
}

export async function downloadAttachments(
	this: IExecuteFunctions,
	messages: IDataObject[] | IDataObject,
	prefix: string,
) {
	const elements: INodeExecutionData[] = [];
	if (!Array.isArray(messages)) {
		messages = [messages];
	}
	for (const message of messages) {
		const element: INodeExecutionData = {
			json: message,
			binary: {},
		};
		if (message.hasAttachments === true) {
			const attachments = await microsoftApiRequestAllItems.call(
				this,
				'value',
				'GET',
				`/messages/${message.id}/attachments`,
				{},
			);
			for (const [index, attachment] of attachments.entries()) {
				const response = await microsoftApiRequest.call(
					this,
					'GET',
					`/messages/${message.id}/attachments/${attachment.id}/$value`,
					undefined,
					{},
					undefined,
					{},
					{ encoding: null, resolveWithFullResponse: true },
				);

				const data = Buffer.from(response.body as string, 'utf8');
				element.binary![`${prefix}${index}`] = await this.helpers.prepareBinaryData(
					data as unknown as Buffer,
					attachment.name,
					attachment.contentType,
				);
			}
		}
		if (Object.keys(element.binary!).length === 0) {
			delete element.binary;
		}
		elements.push(element);
	}
	return elements;
}

export async function getMimeContent(
	this: IExecuteFunctions,
	messageId: string,
	binaryPropertyName: string,
	outputFileName?: string,
) {
	const response = await microsoftApiRequest.call(
		this,
		'GET',
		`/messages/${messageId}/$value`,
		undefined,
		{},
		undefined,
		{},
		{ encoding: null, resolveWithFullResponse: true },
	);

	let mimeType: string | undefined;
	if (response.headers['content-type']) {
		mimeType = response.headers['content-type'];
	}

	const fileName = `${outputFileName || messageId}.eml`;
	const data = Buffer.from(response.body as string, 'utf8');
	const binary: IDataObject = {};
	binary[binaryPropertyName] = await this.helpers.prepareBinaryData(
		data as unknown as Buffer,
		fileName,
		mimeType,
	);

	return binary;
}
