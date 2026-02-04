import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class CanvasOAuth2Api implements ICredentialType {
	name = 'canvasOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Canvas OAuth2 API';

	icon: Icon = 'file:../icons/canvas.svg';

	documentationUrl = 'https://developerdocs.instructure.com/services/canvas/basics/file.oauth';

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
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '={{$self["canvasUrl"]}}/login/oauth2/auth',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{$self["canvasUrl"]}}/login/oauth2/token',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'url:GET|POST|PUT|DELETE',
			description: 'Canvas uses URL-based scopes for API access',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
