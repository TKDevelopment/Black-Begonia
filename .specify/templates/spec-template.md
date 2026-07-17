# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

User stories MUST be prioritized as independently testable journeys. Assign
priorities as P1, P2, P3, etc., where P1 is the most critical.

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- What happens when [boundary condition]?
- How does the system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users MUST be able to [key interaction]
- **FR-004**: System MUST [data requirement]
- **FR-005**: System MUST [behavior]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Constitution Alignment *(mandatory)*

- **Surface**: Feature MUST identify whether it affects the public website,
  client portal, CRM admin portal, Supabase backend, or cross-cutting code.
- **Product Owner Approval**: If public website behavior, content, styling,
  SEO, routing, or forms are affected, approval MUST be recorded before
  implementation.
- **Brownfield Preservation**: Feature MUST list existing functionality that is
  intentionally preserved and any workflows that are explicitly authorized for
  refactor or removal.
- **Supabase Security**: Data features MUST define affected tables, RLS policy
  expectations, storage policy expectations, and edge-function access paths.
- **Schema Migration**: Every new or modified Supabase table MUST identify the
  executable SQL migration that updates an existing environment; declarative
  table definitions alone are not sufficient.
- **Standalone Edge Functions**: Any affected Supabase Edge Function MUST be
  independently deployable without an `_shared` directory, local shared
  function module, or import from another edge function.
- **Testing Expectations**: Feature MUST state unit-test coverage expectations
  and whether proposal, lead, inquiry, or authorization integration checks are
  required.
- **Sensitive Data**: Feature MUST describe handling for customer data, emails,
  passcodes, signatures, proposal PDFs, secrets, and payment-related records.
- **Proposal Workflow**: Proposal features MUST state whether they preserve the
  invoice/planning workflow, manual Canva PDF upload path, and future payment
  or reporting data needs.

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable metric]
- **SC-002**: [Measurable metric]
- **SC-003**: [User or operational success metric]
- **SC-004**: [Business metric]

## Assumptions

- [Assumption about target users]
- [Assumption about scope boundaries]
- [Assumption about data/environment]
- [Dependency on existing system/service]
