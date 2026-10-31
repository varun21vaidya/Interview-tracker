import { M001 } from './001_init';

/** Index = schema version - 1. Applied in order; PRAGMA user_version tracks progress. */
export const MIGRATIONS: string[] = [M001];
