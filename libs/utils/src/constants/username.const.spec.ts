import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, isValidUsername } from './username.const';

describe('isValidUsername', () => {
	it.each(['admin', 'demo', 'minh.nguyen', 'van_a-2', 'a1b', 'x'.repeat(USERNAME_MAX_LENGTH)])(
		'accepts %p',
		username => expect(isValidUsername(username)).toBe(true),
	);

	it.each([
		['too short', 'x'.repeat(USERNAME_MIN_LENGTH - 1)],
		['too long', 'x'.repeat(USERNAME_MAX_LENGTH + 1)],
		['a space', 'van a'],
		['upper case', 'Admin'],
		['a control character', 'adm\u0000in'],
		['a look-alike letter', 'аdmin'],
		['an accent', 'nguyễn'],
		['an @', 'a@b.c'],
		['a trailing newline', 'admin\n'],
	])('refuses %s', (_name, username) => expect(isValidUsername(username)).toBe(false));
});
