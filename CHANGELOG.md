# Changelog

All notable changes to Airlock will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-11

### Added
- **Dev Server Guard**: DNS rebinding protection with Host/Origin validation
- **MCP Watch**: Path traversal detection for AI agent file operations
- **Secret Gate**: In-memory secrets broker replacing plaintext .env files
- **Attack Demonstration**: Realistic attack showing data exfiltration and protection
- **Docker Support**: Production-ready Docker deployment with multi-stage builds
- **Comprehensive Documentation**: Complete guides for all components
- **Error Handling**: Robust error handling with recovery suggestions
- **Professional Project Structure**: Organized docs/ and scripts/ folders

### Security
- DNS rebinding attack mitigation
- Path traversal detection and alerting
- In-memory secret storage
- Zero information disclosure on blocked requests

### Documentation
- Complete README with quick start guide
- Architecture documentation
- Docker deployment guide
- Testing and monitoring guides
- Attack demonstration documentation

## [Unreleased]

### Planned
- Web UI for management dashboard
- Prometheus metrics endpoint
- Desktop notifications for security events
- Kubernetes Helm charts
- Comprehensive test suite with coverage reports
- CI/CD pipeline automation

---

[1.0.0]: https://github.com/yourusername/airlock/releases/tag/v1.0.0
