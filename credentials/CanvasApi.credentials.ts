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
			description: 'The base URL of your Canvas instance (without trailing slash)',
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
			baseURL: '={{$credentials?.canvasUrl}}/api/v1',
			url: '/users/self',
			method: 'GET',
		},
	};
}
