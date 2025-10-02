export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface TokenPayload {
  userId: string;
  username?: string;
  email?: string;
  roles: string[];
  votingGroup?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: AuthToken;
  employee?: any;
  message?: string;
  requirePasswordChange?: boolean;
}
