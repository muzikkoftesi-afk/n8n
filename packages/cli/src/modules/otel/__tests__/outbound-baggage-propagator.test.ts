import {
	defaultTextMapGetter,
	defaultTextMapSetter,
	propagation,
	ROOT_CONTEXT,
} from '@opentelemetry/api';

import { OutboundBaggagePropagator, parseBaggageHeader } from '../outbound-baggage-propagator';

describe('OutboundBaggagePropagator', () => {
	const propagator = new OutboundBaggagePropagator();

	it('writes the baggage of the context', () => {
		const ctx = propagation.setBaggage(
			ROOT_CONTEXT,
			propagation.createBaggage({ tenant: { value: 'acme' }, region: { value: 'eu' } }),
		);
		const carrier: Record<string, string> = {};

		propagator.inject(ctx, carrier, defaultTextMapSetter);

		expect(carrier).toEqual({ baggage: 'tenant=acme,region=eu' });
	});

	it('writes nothing without baggage', () => {
		const carrier: Record<string, string> = {};

		propagator.inject(ROOT_CONTEXT, carrier, defaultTextMapSetter);

		expect(carrier).toEqual({});
	});

	it('never reads a baggage header', () => {
		const ctx = propagator.extract(ROOT_CONTEXT, { baggage: 'tenant=acme' }, defaultTextMapGetter);

		expect(propagation.getBaggage(ctx)).toBeUndefined();
	});

	it('declares the baggage header', () => {
		expect(propagator.fields()).toEqual(['baggage']);
	});
});

describe('parseBaggageHeader', () => {
	it('parses a saved header', () => {
		expect(parseBaggageHeader('tenant=acme;ttl=60')?.getEntry('tenant')).toEqual({
			value: 'acme',
			metadata: expect.anything(),
		});
	});

	it('returns undefined for a header without entries', () => {
		expect(parseBaggageHeader('')).toBeUndefined();
	});
});
