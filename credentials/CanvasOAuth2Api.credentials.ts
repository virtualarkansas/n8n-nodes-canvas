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
			description: 'The address of your Canvas instance, e.g. https://yourschool.instructure.com',
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
			default: '={{String($self["canvasUrl"] ?? "").trim().replace(/\\/+$/, "")}}/login/oauth2/auth',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{String($self["canvasUrl"] ?? "").trim().replace(/\\/+$/, "")}}/login/oauth2/token',
			required: true,
		},
		{
			displayName: 'Scopes',
			name: 'scopes',
			type: 'string',
			typeOptions: { rows: 3 },
			default: '',
			placeholder: 'url:GET|/api/v1/courses url:GET|/api/v1/users/:user_id/profile',
			description:
				'Leave empty unless the Canvas developer key enforces scopes. If it does, list the scopes you need (each must be enabled on the key), separated by spaces or new lines, in the form url:METHOD|/api/v1/path as shown on the developer key in Canvas.',
		},
		{
			// n8n ignores a user-entered "scope" on OAuth2 credentials and always uses this
			// field's default, so the default is computed from the visible Scopes field.
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: '={{String($self["scopes"] ?? "").split(/[\\s,]+/).filter(Boolean).join(" ")}}',
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
