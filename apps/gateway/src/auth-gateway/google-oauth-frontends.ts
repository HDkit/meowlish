import { type IEnvVars } from '../configs/config';

export const GOOGLE_CALLBACK_PATH = '/api/v1/auth/google/callback';

/** Where one Google flow calls back to and where the user lands afterwards. */
export interface GoogleOAuthFrontend {
	/** Set only for a non-default frontend; this is what the OAuth state remembers. */
	origin?: string;
	callbackUrl: string;
	loginRedirectUrl: string;
}

/**
 * Picks the frontend a Google flow belongs to. No `frontend` (or the origin of
 * FE_LOGIN_REDIRECT_URL) is the default: BASE_URL's callback and FE_LOGIN_REDIRECT_URL.
 * Any other origin must be listed in GOOGLE_OAUTH_FRONTENDS; otherwise this returns undefined,
 * so the redirect can never be pointed at an arbitrary site.
 */
export const resolveGoogleOAuthFrontend = (
	vps: IEnvVars['vps'],
	frontend?: string,
): GoogleOAuthFrontend | undefined => {
	const landing = new URL(vps.feLoginRedirectUrl);
	const origin = frontend?.trim().replace(/\/+$/, '');
	if (!origin || origin === landing.origin) {
		return {
			callbackUrl: `${vps.baseUrl}${GOOGLE_CALLBACK_PATH}`,
			loginRedirectUrl: vps.feLoginRedirectUrl,
		};
	}
	if (!vps.googleOAuthFrontends.includes(origin)) return undefined;
	return {
		origin: origin,
		callbackUrl: `${origin}${GOOGLE_CALLBACK_PATH}`,
		loginRedirectUrl: new URL(landing.pathname + landing.search, origin).toString(),
	};
};
