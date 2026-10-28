import type { Logger } from '@n8n/backend-common';
import { mock } from 'vitest-mock-extended';

import { sanitizeInboundBaggage } from '../inbound-baggage';

describe('sanitizeInboundBaggage', () => {
	const logger = mock<Logger>();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([undefined, '', 42, ['tenant=acme', 1]])('returns undefined for %p', (header) => {
		expect(sanitizeInboundBaggage(header, logger)).toBeUndefined();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('keeps caller entries', () => {
		expect(sanitizeInboundBaggage('tenant=acme,region=eu', logger)).toBe('tenant=acme,region=eu');
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('keeps entry metadata', () => {
		expect(sanitizeInboundBaggage('tenant=acme;ttl=60', logger)).toBe('tenant=acme;ttl=60');
	});

	it('keeps percent-encoded values encoded', () => {
		expect(sanitizeInboundBaggage('team=a%20b%2Cc', logger)).toBe('team=a%20b%2Cc');
	});

	it('joins repeated headers', () => {
		expect(sanitizeInboundBaggage(['tenant=acme', 'region=eu'], logger)).toBe(
			'tenant=acme,region=eu',
		);
	});

	it('drops entries with the n8n. prefix in any case', () => {
		const header = 'tenant=acme,n8n.execution.id=forged,N8N.Project.Name=forged';

		expect(sanitizeInboundBaggage(header, logger)).toBe('tenant=acme');
		expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
			received: 3,
			dropped: 2,
			reservedPrefix: 2,
		});
	});

	it('keeps keys that only contain n8n', () => {
		expect(sanitizeInboundBaggage('n8n=1,x.n8n.y=2', logger)).toBe('n8n=1,x.n8n.y=2');
	});

	it('returns undefined when only n8n. entries are sent', () => {
		expect(sanitizeInboundBaggage('n8n.workflow.id=forged', logger)).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('drops malformed entries', () => {
		expect(sanitizeInboundBaggage('tenant=acme,novalue,=empty-key,empty-value=', logger)).toBe(
			'tenant=acme',
		);
		expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
			received: 4,
			dropped: 3,
			reservedPrefix: 0,
		});
	});

	it('keeps at most 180 entries', () => {
		const header = Array.from({ length: 181 }, (_, i) => `k${i}=v`).join(',');

		const sanitized = sanitizeInboundBaggage(header, logger);

		expect(sanitized?.split(',')).toHaveLength(180);
		expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
			received: 181,
			dropped: 1,
			reservedPrefix: 0,
		});
	});

	it('drops an entry over 4096 bytes', () => {
		const header = `big=${'v'.repeat(4096)},tenant=acme`;

		expect(sanitizeInboundBaggage(header, logger)).toBe('tenant=acme');
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('stops at 8192 bytes in total', () => {
		const entry = (key: string) => `${key}=${'v'.repeat(3000)}`;
		const header = [entry('a'), entry('b'), entry('c')].join(',');

		expect(sanitizeInboundBaggage(header, logger)).toBe([entry('a'), entry('b')].join(','));
		expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
			received: 3,
			dropped: 1,
			reservedPrefix: 0,
		});
	});
});
