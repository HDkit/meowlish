import { AddGoogleCredCommandHandler } from './add-google-cred.handler';
import { AddMailCredCommandHandler } from './add-mail-cred.handler';
import { AssignRoleToCommandHandler } from './assign-role-to.handler';
import { ConnectGoogleCalendarCommandHandler } from './connect-google-calendar.handler';
import { DisconnectGoogleCalendarCommandHandler } from './disconnect-google-calendar.handler';
import { GoogleRegisterOrLoginCommandHandler } from './google-register-or-login.handler';
import { LockIdentityCommandHandler } from './lock-identity.handler';
import { LogoutAllCommandHandler } from './logout-all.handler';
import { MailLoginCommandHandler } from './mail-login.handler';
import { MailRegisterCommandHandler } from './mail-register.handler';
import { RefreshCommandHandler } from './refresh.handler';
import { RemoveCredCommandHandler } from './remove-cred.handler';
import { RemoveRoleFromCommandHandler } from './remove-role-from.handler';
import { UnlockIdentityCommandHandler } from './unlock-identity.handler';
import { UpdateIdentityCommandHandler } from './update-identity.handler';
import { UpdatePasswordCommandHandler } from './update-password.handler';
import { ValidateAccessCommandHandler } from './validate-access.handler';
import { ValidateRefreshCommandHandler } from './validate-refresh.handler';

export const AuthCommandHandlers = [
	MailRegisterCommandHandler,
	MailLoginCommandHandler,
	GoogleRegisterOrLoginCommandHandler,
	AddMailCredCommandHandler,
	AddGoogleCredCommandHandler,
	RemoveCredCommandHandler,
	AssignRoleToCommandHandler,
	RemoveRoleFromCommandHandler,
	UpdatePasswordCommandHandler,
	UpdateIdentityCommandHandler,
	RefreshCommandHandler,
	ValidateRefreshCommandHandler,
	ValidateAccessCommandHandler,
	LogoutAllCommandHandler,
	LockIdentityCommandHandler,
	UnlockIdentityCommandHandler,
	ConnectGoogleCalendarCommandHandler,
	DisconnectGoogleCalendarCommandHandler,
];
