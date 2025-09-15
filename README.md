# Employee of the Month API

API backend for the Employee of the Month voting system, built with Azure Functions and TypeScript.

## Overview

This system manages employee nominations and voting processes for monthly recognition programs. It provides endpoints for employee management, nomination creation, voting period management, and result tracking.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Azure Functions
- **Database**: Azure Cosmos DB
- **Language**: TypeScript 4.x
- **Build Tool**: TypeScript Compiler (tsc)

## Project Structure

```
src/
├── config/
│   └── env.config.ts           # Environment configuration
├── containers/
│   ├── models/                 # Data models
│   │   ├── Employee.ts
│   │   ├── Nomination.ts
│   │   ├── VotingPeriod.ts
│   │   └── VoteResult.ts
│   ├── repositories/           # Data access layer
│   │   ├── EmployeeRepository.ts
│   │   ├── NominationRepository.ts
│   │   └── VotingPeriodRepository.ts
│   ├── services/               # Business logic
│   │   ├── EmployeeService.ts
│   │   ├── VotingService.ts
│   │   ├── ValidationService.ts
│   │   └── NotificationService.ts
│   └── utils/                  # Utilities
│       ├── CosmosClient.ts
│       ├── ResponseHelper.ts
│       ├── Validators.ts
│       ├── DateHelper.ts
│       └── Dependencies.ts
└── functions/                  # Azure Functions endpoints
    ├── health/
    │   └── health.route.ts     # Health check endpoint
    ├── voting/
    │   ├── getEmployees.ts     # Get all employees
    │   ├── getCurrentVoting.ts # Get current voting period
    │   ├── getVotingResults.ts # Get voting results
    │   ├── createNomination.ts # Create nomination
    │   └── closeVotingPeriod.ts# Close voting period
    └── index.ts                # Function exports
```

## Features

- **Employee Management**: CRUD operations for employee records
- **Nomination System**: Create and manage employee nominations
- **Voting Periods**: Manage voting periods with start/end dates
- **Results Tracking**: Generate voting results and statistics
- **Health Monitoring**: Built-in health check endpoint

## Prerequisites

- Node.js 18.x or higher
- Azure Functions Core Tools
- Azure Cosmos DB account

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env`:
   ```bash
   # Add your Azure Cosmos DB configuration
   # Copy from .env.example if available
   ```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode compilation
- `npm run clean` - Remove dist directory
- `npm run prestart` - Clean and build before starting
- `npm start` - Start Azure Functions runtime
- `npm test` - Run tests (placeholder)

## Development

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. The API will be available at `http://localhost:7071`

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/employees` - Get all employees
- `GET /api/voting/current` - Get current voting period
- `GET /api/voting/results` - Get voting results
- `POST /api/voting/nominate` - Create nomination
- `POST /api/voting/close` - Close voting period

## Deployment

The application is designed to run on Azure Functions. Configure your Azure environment and deploy using Azure CLI or Azure DevOps pipelines.

## Contributing

1. Create a feature branch from `development`
2. Make your changes
3. Build and test locally
4. Create a pull request to `main`

## License

[Add your license here]