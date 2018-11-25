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

	it('Measures request durration', async () => {
		const metricPrefix = 'node_http_duration_seconds';

		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, metricPrefix);
		// Since no actual requests have been made we don't expect any metrics
		// to be available (/metrics is ignored as a route)
		expect(metrics).toHaveLength(0);

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
		// Since no actual requests have been made we don't expect any metrics
		// to be available (/metrics is ignored as a route)
		expect(metrics).toHaveLength(0);

		// Generate metrics by making requests to both valid and invalid routes
		res = await request(this.app).get('/fake_route'); // Yield 404
		res = await request(this.app).get('/some_route'); // Yield 200

		// Refetch the metrics and ensure that both requests were monitored
		res = await request(this.app).get('/metrics');
		metrics = _filterMetrics(res.text, metricPrefix);
		expect(metrics).toHaveLength(2);
	});
});

describe('Supports ignored routes', () => {
	this.app = null;
	this.server = null;
	this.prometheusClient = null;

	beforeEach(async () => {
		this.app = express();
		const {server, client} = await _createServer(this.app, TEST_APP_NAME, IGNORED_ROUTES);
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

	it('Supports ignoring specified routes ', async () => {
		const metricPrefix = 'node_http_requests_total';

		// Ensure no existing metrics exist
		let res = await request(this.app).get('/metrics');
		let metrics = _filterMetrics(res.text, metricPrefix);
		// Since no actual requests have been made we don't expect any metrics
		// to be available (/metrics is ignored as a route)
		expect(metrics).toHaveLength(0);

		// Generate metrics by making requests to both monitored and ignored routes
		res = await request(this.app).get('/ignore'); // Should NOT be calculated
		res = await request(this.app).get('/calculate'); // Should be calculated

		// Refetch the metrics and ensure that both requests were monitored
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

function _createServer(app, appName = undefined, ignoredRoutes = undefined) {
	const {middleware, metrics, client} = require('../index.js')({
		appName,
		ignoredRoutes
	});
	app.use(middleware);
	app.get('/metrics', metrics);
	app.use((req, reply) => reply.status(404).end());
	let server;
	return new Promise(resolve => {
		server = app.listen(TEST_PORT, () => resolve({server, client}));
	});
}
