/**
 * Usernames chosen by a user (register, or a change of username): 3-30 characters from
 * [a-z0-9._-], the same set and maximum Google sign-up derives from the e-mail local part. No
 * spaces, control characters, upper case or look-alike Unicode. Usernames that existed before
 * the rule (or the UUID fallback of Google sign-up) stay valid until they are changed.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const USERNAME_RULE_MESSAGE =
	'username must be 3-30 characters of lowercase letters, digits, ".", "_" or "-"';

export const isValidUsername = (username: string): boolean => USERNAME_PATTERN.test(username);
