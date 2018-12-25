[![CircleCI](https://circleci.com/gh/TailorBrands/node-exporter-prometheus/tree/master.svg?style=svg&circle-token=e881d8475dd8dfab8c6bc695ef84a2677e04443b)](https://circleci.com/gh/TailorBrands/node-exporter-prometheus/tree/master)
[![Test Coverage](https://api.codeclimate.com/v1/badges/eb78a8090d08e3c3bd63/test_coverage)](https://codeclimate.com/repos/5bfc1fbbe40b610285001d18/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/eb78a8090d08e3c3bd63/maintainability)](https://codeclimate.com/repos/5bfc1fbbe40b610285001d18/maintainability)

# Prometheus Exporter for Express Applications

This module allows application to expose Prometheus compatible metrics. The metrics include request duration and statuses and optionally those that are
exported by default in [`prom-client`](https://github.com/siimon/prom-client). [Example output showing all metrics](./examples/output.txt).
By default, the `/metrics` and `/healthz` endpoints are ignored.

### Installing

```js
npm install @tailorbrands/node-exporter-prometheus
```

### Setup

Since the duration of requests is being measured, it is important that the exporter be activated before the first application route or middleware.

```js
app = express();
// Node prometheus exporter setup
const options = {appName}; // `appName` is the name of your service/application
const prometheusExporter = require('@tailorbrands/node-exporter-prometheus')
const promExporter = PromExporter(options);
app.use(promExporter.middleware);
app.get('/metrics', promExporter.metrics);
// Application routes and middleware starts here
app.use(...)
app.get(...)
app.post(...)
```

### Options

- `appName`                             - Name that will be used in the label for every metric
- `ignoredRoutes` (optional)            - An array of routes to be exuded when calculating metrics. Default value: `['/metrics', '/healthz']`
- `collectDefaultMetrics` (optional)    - A boolean indicating whether or not to collect [default nodejs metrics](https://github.com/siimon/prom-client/#default-metrics) (default: false)

## Additional Metrics

Once you have the default metrics accessible, you might want to add some of your own custom metrics.  The module exposes the underlying `prom-client` as a property called `client`.  This allows you to add any other `prom-client` metrics.
Here is an example using a Gauge metric. It will add something similar to following in the output of the metrics endpoint:
<pre>
# HELP simple_counter One route increases another one decreases
# TYPE simple_counter gauge
simple_counter{app_name="test-app"} 2
</pre>

```js
const {promMiddleware, promMetrics, promClient} = require('node-prometheus-exporter')({ appName });
const simpleCounter = new promClient.Gauge({
  name: 'simple_counter',
  help: 'One route increases another one decreases'
});
app.get('/increase', (req, res) => {
  simpleCounter.inc()
  res.send(200)
})
app.get('/decrease', (req, res) => {
  simpleCounter.dec()
  res.send(200)
})
```

## Testing

```js
npm test
```

---

## About Tailor Brands
[Check us out!](https://www.tailorbrands.com)
