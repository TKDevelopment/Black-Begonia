# BlackBegonia

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.5.

## Project Context

Black Begonia is a brownfield Angular 19 application for Black Begonia Florals.
The current codebase hosts the public website and CRM admin portal in one
Angular project, backed by Supabase schemas, private storage, and edge
functions. Floral proposal PDFs are stored for internal project records after
the florist manually obtains a signed proposal/services agreement outside the
CRM.

Development is governed by the project constitution in
`.specify/memory/constitution.md`. Public website changes require product owner
approval before implementation. Supabase work must account for RLS, storage
policies, edge-function boundaries, and secret handling. Every new or modified
Supabase table schema must include a matching executable SQL migration in
`supabase/migrations/`. Every Supabase Edge Function must be standalone; do not
create or use `_shared` directories, local shared edge-function modules, or
imports between edge functions. Karma/Jasmine is the default unit-test stack,
with focused PostgreSQL integration checks required for affected migrations,
RLS, functions, and durable workflow contracts. Do not create automated tests
that target, import, invoke, or simulate Supabase Edge Functions; validate each
function independently through type-checking and documented provider/customer
sandbox smoke checks.

AI agents must not run `git commit`, `git push`, or commit/push-capable
automation. Committing local changes and pushing to origin are human operator
responsibilities; agents may provide source-control summaries and suggested
commit messages for review.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

For headless coverage verification, run:

```bash
npm run test:coverage
```

All new frontend behavior under `src/app` must include colocated Karma/Jasmine
unit tests in the same change. If a file has no executable behavior, document the
approved exclusion in `specs/001-unit-test-coverage/coverage-manifest.md` with the
path, reason, and notes. Critical inquiry, lead, proposal, authorization, and
environment-specific workflows need both success-path and failure-path assertions
when touched.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
