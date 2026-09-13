# Contributing

Thanks for contributing to firetv. Bug fixes, improvements, documentation, and
new device-management features are welcome.

## Getting started

Requirements:

- Node.js 18 or newer
- Yarn
- A Fire TV with ADB debugging enabled for device-level testing

Install dependencies and verify the project locally:

```bash
yarn install
yarn typecheck
yarn test
yarn lint
yarn format:check
```

## Making changes

1. Create a focused branch for your change.
2. Keep changes small and focused on one issue.
3. Add or update tests for behavior that can be tested without a device.
4. Update the README when adding or changing user-facing commands.
5. Run the relevant checks before opening a pull request.

Device-level changes should be tested against a Fire TV when practical. Take
care with commands that disable packages, change the launcher, or modify device
settings; preserve the existing preview and confirmation safeguards.

## Pull requests

Include a clear description of the problem and solution, along with the tests
you ran. Mention any device model, Fire OS version, or ADB setup relevant to
the change. Keep unrelated formatting or refactoring out of the pull request.

## Reporting issues

Include the command you ran, the expected and actual behavior, relevant error
output, and your Node.js, operating system, Fire TV, and Fire OS versions.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
