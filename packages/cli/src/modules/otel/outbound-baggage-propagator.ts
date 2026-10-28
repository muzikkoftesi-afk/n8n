import type {
	Baggage,
	Context,
	TextMapGetter,
	TextMapPropagator,
	TextMapSetter,
} from '@opentelemetry/api';
import { defaultTextMapGetter, propagation, ROOT_CONTEXT } from '@opentelemetry/api';
import { W3CBaggagePropagator } from '@opentelemetry/core';

const w3cBaggage = new W3CBaggagePropagator();

/**
 * Writes the W3C `baggage` header but never reads it. The global propagator also serves
 * libraries that extract inbound headers (for example Sentry's HTTP integration), so a full
 * baggage propagator would put the raw caller baggage of every request on the active context.
 */
export class OutboundBaggagePropagator implements TextMapPropagator {
	inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
		w3cBaggage.inject(context, carrier, setter);
	}

	extract(context: Context, _carrier: unknown, _getter: TextMapGetter): Context {
		return context;
	}

	fields(): string[] {
		return w3cBaggage.fields();
	}
}

/** Parses a `baggage` header value that n8n saved. Undefined when it has no entries. */
export function parseBaggageHeader(header: string): Baggage | undefined {
	return propagation.getBaggage(
		w3cBaggage.extract(ROOT_CONTEXT, { baggage: header }, defaultTextMapGetter),
	);
}
