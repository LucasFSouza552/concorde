import { User } from "@concorde/shared";

export interface UserRecord extends User {
	passwordHash: string;
	passwordSalt: string;
}

export interface CreateUserData {
	username: string;
	email: string;
	passwordHash: string;
	passwordSalt: string;
}