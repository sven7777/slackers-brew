# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** — do not open a public
issue.

Use GitHub's [private vulnerability reporting](https://github.com/sven7777/slackers-brew/security/advisories/new)
("Report a vulnerability" under the repository's **Security** tab).

You can expect an initial response within a few business days. Once a fix is
released, we'll credit the reporter unless you prefer to remain anonymous.

## Scope

This is a client-side React application; all data is stored locally in the
browser (no backend, no transmitted credentials). Reports of concern include,
but are not limited to:

- Cross-site scripting (XSS) via rendered ingredient/recipe data
- Dependency vulnerabilities not yet caught by automated scanning
- Build/supply-chain issues in the toolchain
