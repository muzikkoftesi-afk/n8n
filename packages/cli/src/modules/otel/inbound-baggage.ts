import type { Logger } from '@n8n/backend-common';
import {
	defaultTextMapGetter,
	defaultTextMapSetter,
	propagation,
	ROOT_CONTEXT,
} from '@opentelemetry/api';
import { W3CBaggagePropagator } from '@opentelemetry/core';

const RESERVED_KEY_PREFIX = 'n8n.';
const propagator = new W3CBaggagePropagator();

/**
 * Returns the caller's `baggage` header without `n8n.`
 */
export function sanitizeInboundBaggage(header: unknown, logger: Logger): string | undefined {
	const raw = toHeaderString(header);
	if (!raw) return undefined;

	const received = countEntries(raw);
	const baggage = propagation.getBaggage(
		propagator.extract(ROOT_CONTEXT, { baggage: raw }, defaultTextMapGetter),
	);

	const reservedKeys = (baggage?.getAllEntries() ?? [])
		.map(([key]) => key)
		.filter((key) => key.toLowerCase().startsWith(RESERVED_KEY_PREFIX));

	const carrier: Record<string, string> = {};
	if (baggage) {
		const kept = baggage.removeEntries(...reservedKeys);
		propagator.inject(propagation.setBaggage(ROOT_CONTEXT, kept), carrier, defaultTextMapSetter);
	}

	const sanitized = carrier.baggage;
	const dropped = received - (sanitized ? countEntries(sanitized) : 0);
	if (dropped > 0) {
		logger.warn('Dropped entries from the inbound baggage header', {
			received,
			dropped,
			reservedPrefix: reservedKeys.length,
		});
	}

	return sanitized;
}

function toHeaderString(header: unknown): string | undefined {
	if (typeof header === 'string') return header;
	if (Array.isArray(header) && header.every((value) => typeof value === 'string')) {
		return header.join(',');
	}
	return undefined;
}

function countEntries(header: string): number {
	return header.split(',').filter((entry) => entry.trim() !== '').length;
}
