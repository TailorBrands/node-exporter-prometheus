# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2018-12-24
### Changed
- Optionally collect default metrics; Added `collectDefaultMetrics` boolean.
  Defaults to false.
- Metrics no longer include the request path or method. Request status codes
  are still collected but all paths and methods count for the same metric.

## [1.1.0] - 2018-12-05
### Added
- Use response object to measure request durations

## [1.0.0] - 2018-11-27
### Added
- Implemented first version of exporter

[2.0.0]: https://github.com/TailorBrands/node-exporter-prometheus/v2.0.0
[1.1.0]: https://github.com/TailorBrands/node-exporter-prometheus/v1.1.0
[1.0.0]: https://github.com/TailorBrands/node-exporter-prometheus/v1.0.0
