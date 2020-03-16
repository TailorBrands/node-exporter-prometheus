const Prometheus = require('prom-client');

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_IGNORED_ROUTES = ['/metrics', '/healthz'];
const DEFAULT_APP_NAME = 'node';

/**
 * @param {object} opts An object containing the required configuration.
 *    appName                           - The name to be used as a default label
 *    ignoredRoutes (optional)          - An array of routes that should be ignored
 *    collectDefaultMetrics (optional)  - A boolean indicating whether or not to collect default metrics (default: false)
 * @returns {object} The internal prometheus client, middleware function, and metrics function.
 */
module.exports = ({appName = DEFAULT_APP_NAME, ignoredRoutes = DEFAULT_IGNORED_ROUTES, collectDefaultMetrics = false}) => {
	Prometheus.register.setDefaultLabels({appName});

	const durationSummary = createDurationSummary();
	const statusCounter = createStatusCounter();
	let defaultMetricsInterval = null; // eslint-disable-line no-unused-vars

	if (collectDefaultMetrics) {
		defaultMetricsInterval = Prometheus.collectDefaultMetrics({timeout: DEFAULT_TIMEOUT_MS});
	}

	/**
     * This is the middleware function that actually measures response metrics. For every request the
     * duration is measured as well as the request path, request method, and response status.
     * @param {Request} req A request object
     * @param {Response} response A response object
     * @param {Function} next Function to trigger the next middleware function in the chain
     */
	const middlewareFunc = (request, response, next) => {
		if (!ignoredRoutes.includes(request.path)) {
			const end = durationSummary.startTimer();
			response.on('finish', () => {
				const requestData = {status: response.statusCode};
				statusCounter.inc(requestData, 1); // Observes the status code of the request
				end(); // Observes the duration of the request
			});
		}

		next();
	};

	/**
     * This is the function that serves the metrics data - use it as follows:
     * `app.get('/metrics', PrometheusExporter.metrics);`
     * @param {Request} req A request object
     * @param {Response} response A response object
     */
	const metricsFunc = (request, response) => {
		response.set('Content-Type', Prometheus.register.contentType);
		response.end(Prometheus.register.metrics());
	};

	return {
		middleware: middlewareFunc,
		metrics: metricsFunc,
		client: Prometheus
	};
};

/**
 * This summary metric measures the duration of requests and reports
 * them as percentiles
 * @returns {Summary} A metric that measures request duration in percentiles.
 */
function createDurationSummary() {
	return new Prometheus.Summary({
		name: 'node_http_duration_seconds',
		help: 'Duration of HTTP requests in seconds',
		percentiles: [0.5, 0.9, 0.99],
		maxAgeSeconds: 600,
		ageBuckets: 5
	});
}

/**
 * This counter metric measures the number of requests,
 * their type, their path, and status
 * @returns {Counter} A metric that counts total requests, their paths, and status codes.
 */
function createStatusCounter() {
	return new Prometheus.Counter({
		name: 'node_http_requests_total',
		help: 'Response status codes',
		labelNames: ['status']
	});
}
