// Structured server-side logger for checkout + webhook flows.
// Always-on (low volume, one request per order). Set DEBUG_CHECKOUT=false in env
// to silence info/debug lines while keeping warn/error.

import { env } from '$env/dynamic/private';

type Level = 'debug' | 'info' | 'warn' | 'error';

function enabled(level: Level): boolean {
	if (level === 'warn' || level === 'error') return true;
	return env.DEBUG_CHECKOUT !== 'false';
}

function emit(scope: string, level: Level, msg: string, data?: unknown) {
	if (!enabled(level)) return;
	const line = `[${scope}] ${msg}`;
	const fn =
		level === 'error'
			? console.error
			: level === 'warn'
				? console.warn
				: level === 'info'
					? console.info
					: console.log;
	if (data === undefined) fn(line);
	else fn(line, safe(data));
}

function safe(data: unknown): unknown {
	if (data instanceof Error) {
		return { name: data.name, message: data.message, stack: data.stack };
	}
	return data;
}

export type Logger = {
	debug: (msg: string, data?: unknown) => void;
	info: (msg: string, data?: unknown) => void;
	warn: (msg: string, data?: unknown) => void;
	error: (msg: string, data?: unknown) => void;
	child: (subscope: string) => Logger;
};

export function createLogger(scope: string): Logger {
	return {
		debug: (msg, data) => emit(scope, 'debug', msg, data),
		info: (msg, data) => emit(scope, 'info', msg, data),
		warn: (msg, data) => emit(scope, 'warn', msg, data),
		error: (msg, data) => emit(scope, 'error', msg, data),
		child: (sub) => createLogger(`${scope}:${sub}`)
	};
}
