const request = require('supertest');
const express = require('express');

const TEST_PORT = 9394;
const TEST_APP_NAME = 'test-app';
const IGNORED_ROUTES = ['/metrics', '/ignore'];

describe('Adds duration and status metrics', () => {
	this.app = null;
	this.server = null;
	this.prometheusClient = null;

	beforeEach(async () => {
		this.app = express();
		const {server, client} = await _createServer(this.app);
		this.server = server;
		this.prometheusClient = this.prometheusClient || client;
	});

	afterEach(done => {
		this.app = null;
		this.prometheusClient.register.clear();
		if (this.server) {
			this.server.close(done);
		} else {
			done();
		}
	});

	it('Measures request duration', async () => {
		const metricPrefix = 'node_http_duration_seconds';

		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, metricPrefix);
		// Since no actual requests have been made we don't expect any values to be available
        metrics.forEach(metric => {
            expect(metric.endsWith('0'));
        });

		// This request should be measured
		res = await request(this.app).get('/non_existent_route');

		res = await request(this.app).get('/metrics');
		metrics = _filterMetrics(res.text, metricPrefix);
		// The six metrics are
		// node_http_duration_seconds_sum
		// node_http_duration_seconds_count
		// 3x node_http_duration_seconds (one per percentile bucket)
		expect(metrics).toHaveLength(5);
	});

	it('Counts request statuses', async () => {
		const metricPrefix = 'node_http_requests_total';

		// Setup a real route
		this.app.get('/some_route', (req, res) => res.end());

		// Ensure no existing metrics exist
		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, metricPrefix);
		// Since no actual requests have been made we don't expect any values to be available
        metrics.forEach(metric => {
            expect(metric.endsWith('0'));
        });

		// Generate metrics by making requests to both valid and invalid routes
		res = await request(this.app).get('/fake_route'); // Yield 404
		res = await request(this.app).get('/some_route'); // Yield 200

		// Re-fetch the metrics and ensure that both requests were monitored
		res = await request(this.app).get('/metrics');
		metric = _filterMetrics(res.text, metricPrefix).pop();
        expect(metric.endsWith('2'));
	});
});

describe('Supports optional collecting of default metrics', () => {
	this.app = null;
	this.server = null;
	this.prometheusClient = null;

	afterEach(done => {
		this.app = null;
		this.prometheusClient.register.clear();
		if (this.server) {
			this.server.close(done);
		} else {
			done();
		}
	});

	it('Collects default metrics', async () => {

		this.app = express();
		const {server, client} = await _createServer(this.app, {
            appName: TEST_APP_NAME, collectDefaultMetrics: true
        });
		this.server = server;
		this.prometheusClient = this.prometheusClient || client;

		let res = await request(this.app).get('/metrics');

        // nodejs_version_info is one of the default metrics
		let metric = _filterMetrics(res.text, 'nodejs_version_info').pop();
		expect(metric.endsWith('1'));
	});

	it('Does not collect default metrics by default', async () => {

		this.app = express();
		const {server, client} = await _createServer(this.app, { appName: TEST_APP_NAME });
		this.server = server;
		this.prometheusClient = this.prometheusClient || client;

		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, 'node');

        // nodejs_version_info is one of the default metrics
		let metric = _filterMetrics(res.text, 'nodejs_version_info').pop();

		// Default metrics start with either 'process' or 'nodejs'
        metrics.forEach(metric => {
            expect(metric.startsWith('process')).toBeFalsy();
            expect(metric.startsWith('nodejs')).toBeFalsy();
        });
	});
});

describe('Supports ignored routes', () => {
	this.app = null;
	this.server = null;
	this.prometheusClient = null;

	beforeEach(async () => {
		this.app = express();
		const {server, client} = await _createServer(this.app, {
            appName: TEST_APP_NAME, ignoredRoutes: IGNORED_ROUTES
        });
		this.server = server;
		this.prometheusClient = this.prometheusClient || client;
	});

	afterEach(done => {
		this.app = null;
		this.prometheusClient.register.clear();
		if (this.server) {
			this.server.close(done);
		} else {
			done();
		}
	});

	it('Supports ignoring specified routes', async () => {
		const metricPrefix = 'node_http_requests_total';

		// Ensure no existing metrics exist
		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, metricPrefix);
		// Since no actual requests have been made we don't expect any values to be available
        metrics.forEach(metric => {
            expect(metric.endsWith('0'));
        });

		// Generate metrics by making requests to both monitored and ignored routes
		res = await request(this.app).get('/ignore'); // Should NOT be calculated
		res = await request(this.app).get('/calculate'); // Should be calculated

		// Re-fetch the metrics and ensure that both requests were monitored
		res = await request(this.app).get('/metrics');
		metrics = _filterMetrics(res.text, metricPrefix);
		expect(metrics).toHaveLength(1);
	});
});

/*
 * Helper function to that only returns relevant metrics
 */
function _filterMetrics(metrics, filterText) {
	return metrics.split('\n')
		.filter(Boolean) // Filter out blank lines)
		.filter(metric => {
			return metric.startsWith(filterText);
		});
}

function _createServer(app, options = {}) {
	const {middleware, metrics, client} = require('../index.js')(options);
	app.use(middleware);
	app.get('/metrics', metrics);
	app.use((req, reply) => reply.status(404).end());
	let server;
	return new Promise(resolve => {
		server = app.listen(TEST_PORT, () => resolve({server, client}));
	});
}
