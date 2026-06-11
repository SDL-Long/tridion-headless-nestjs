# Tridion Headless NestJS

A common NestJS library for Tridion Sites Headless, providing GraphQL and Content Delivery API clients, authentication, navigation, page, component, binary, and caching services.

## Features

* GraphQL API Client
* Content Delivery API Client
* OAuth Authentication
* Navigation Service
* Page Service
* Component Service
* Taxonomy Service
* Binary Service
* Redis Cache Support
* Discovery Service Integration
* NestJS Module Integration

## Prerequisites

* Node.js 20+
* npm 10+
* Tridion Sites Headless Environment

## Installation

```bash
npm install
```

## Configuration

Configure the required environment variables in your `.env` file.

Example:

```properties
DISCOVERY_SERVICE_URI=
CLIENT_ID=
CLIENT_SECRET=
REDIS_HOST=
REDIS_PORT=
CACHE_TTL=
```

## Running Locally

Start the application in development mode:

```bash
npm run start:dev
```

Build the project:

```bash
npm run build
```

## Development

When implementing new reusable functionality in an application project, the changes should be migrated to the shared library before packaging or publishing.

After updating the shared library:

```bash
npm run build
```

## Package

Create a local npm package:

```bash
npm pack
```

## Publish

Publish the package to the configured npm registry:

```bash
npm publish
```

## Contributing

Contributions are welcome through pull requests.

Please ensure all changes are reviewed and tested before merging.

## License

MIT License
