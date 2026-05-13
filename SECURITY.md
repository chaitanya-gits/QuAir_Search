# Security Policy

## Supported Versions

Security fixes are applied to the current `main` branch.

Older snapshots, experimental branches, and unpublished local environments are
not guaranteed to receive backported fixes.

## Reporting a Vulnerability

If you discover a security issue, please avoid opening a public issue with
exploit details.

Instead:

1. Gather the affected area, impact, reproduction steps, and any suggested mitigation.
2. Contact the repository maintainer privately through GitHub security reporting or a private maintainer channel.
3. Allow reasonable time for verification, remediation, and coordinated disclosure.

When submitting a report, include:

- affected file, endpoint, or deployment surface
- prerequisites and reproduction steps
- expected impact
- whether credentials, tokens, or personal data may be exposed

## Response Goals

- Initial acknowledgement: as soon as practical
- Triage and severity review: after reproduction
- Fix and validation: based on impact and deployment risk

## Scope Notes

Please report issues related to:

- authentication and session handling
- secret exposure
- dependency vulnerabilities
- infrastructure or deployment misconfiguration
- access control or data exposure

Do not include real secrets, production credentials, or customer data in public
reports.
