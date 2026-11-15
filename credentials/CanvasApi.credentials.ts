import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class CanvasApi implements ICredentialType {
	name = 'canvasApi';

	displayName = 'Canvas API';

	icon: Icon = 'file:../icons/canvas.svg';

	documentationUrl = 'https://developerdocs.instructure.com/services/canvas';

	properties: INodeProperties[] = [
		{
			displayName: 'Canvas URL',
			name: 'canvasUrl',
			type: 'string',
			default: '',
			placeholder: 'https://yourschool.instructure.com',
			description: 'The address of your Canvas instance, e.g. https://yourschool.instructure.com',
			required: true,
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Generate at Canvas → Account → Settings → New Access Token',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			// Tolerate surrounding whitespace and a trailing slash, like the node does.
			baseURL: '={{String($credentials?.canvasUrl ?? "").trim().replace(/\\/+$/, "")}}/api/v1',
			url: '/users/self',
			method: 'GET',
		},
	};
}
