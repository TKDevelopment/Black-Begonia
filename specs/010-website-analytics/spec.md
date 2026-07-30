# Feature Specification: Public Website Analytics and Search Insights

**Feature Branch**: `010-website-analytics`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Integrate the public Black Begonia Florals website with Google Analytics 4 and Google Search Console to understand acquisition, public-site engagement, inquiry conversion, and SEO outcomes while excluding private, authentication, and payment surfaces and protecting visitor privacy."

## Clarifications

### Session 2026-07-22

- Q: What should happen before a visitor accepts analytics or after they decline it? → A: Enable privacy-restricted analytics by default only for confidently identified U.S. visitors; require affirmative opt-in outside the U.S. or when location is unknown; honor Global Privacy Control and manual opt-outs with no subsequent GA4 requests or cookieless pings; never load GA4 on excluded routes; permanently disable advertising-related integrations and settings; and require accessible preferences, disclosure, annual review, change-triggered reassessment, and qualified pre-production privacy review.
- Q: How long should a visitor's saved Analytics Preferences remain valid before the website asks them to choose again? → A: Twelve months, with earlier invalidation and re-prompting after a material analytics or privacy change.
- Q: Who should have administrative access to the GA4 and Search Console properties? → A: The florist is the primary administrator, one additional business-controlled account is the recovery administrator, and every other user receives only the minimum reporting access needed.
- Q: Where should the florist review the recurring combined SEO and lead-generation report? → A: Use only native GA4 and Search Console reports with a documented monthly review procedure; do not add an external combined dashboard or a custom CRM dashboard in this feature.
- Q: How should visits from the florist's own devices be excluded from production analytics? → A: Provide an explicit internal-browser preference for known florist devices, exclude those browsers from production analytics, and keep all local, preview, staging, and automated traffic outside production measurement.
- Q: What visitor action should count as starting an inquiry? → A: Record the inquiry start once, when the visitor first makes a user-driven change to a meaningful customer-facing form field; page load, focus alone, hidden/technical/honeypot fields, and automatic population do not count.
- Q: At what point should an inquiry count as a successfully confirmed lead? → A: Count the lead once the CRM successfully creates the durable lead record; later inspiration-link, notification-email, toast, or success-navigation failures do not suppress or duplicate that confirmed lead.
- Q: What page-depth threshold should count as meaningful scroll engagement? → A: Record one meaningful-scroll event when the visitor reaches 90% of an eligible page.
- Q: How should a general inquiry reached through a workshop call to action be classified? → A: Preserve the inquiry type as general and separately record a safe workshop origin context without adding a workshop form or changing the CRM lead type.
- Q: What information should be collected when a visitor reaches the public Not Found page? → A: Record a Not Found event with an allowlisted safe public route category when recognizable and `other` otherwise; never transmit the raw requested path, query string, fragment, token, or unknown value.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Measure Qualified Inquiry Journeys (Priority: P1)

As the florist, I can distinguish confirmed inquiries from page visits and weaker intent signals so I can learn which public content and acquisition sources produce qualified leads.

**Why this priority**: The primary business value is knowing whether website and SEO activity results in accepted inquiries rather than traffic alone.

**Independent Test**: Complete successful and unsuccessful wedding and general inquiry journeys from different public landing pages and verify that only server-confirmed submissions create one lead outcome with the correct non-sensitive journey context.

**Acceptance Scenarios**:

1. **Given** a visitor arrives from Google on a location page, **When** the visitor views a portfolio item, starts a wedding inquiry, and the CRM creates the durable lead record, **Then** the journey records its eligible engagement and exactly one confirmed lead outcome.
2. **Given** a visitor arrives from a tagged Instagram campaign, **When** the visitor successfully submits a general inquiry, **Then** the confirmed lead can be evaluated by source, campaign, initial landing page, device, and reporting period.
3. **Given** a visitor presses Submit but validation fails or the request is not accepted, **When** the visitor remains on the form, **Then** no confirmed lead outcome is recorded.
4. **Given** a visitor manually opens or refreshes an inquiry success route, **When** no newly accepted inquiry exists for that journey, **Then** no confirmed lead outcome is recorded.
5. **Given** an accepted inquiry has already been measured, **When** the browser retries, refreshes, or revisits the success route, **Then** the accepted inquiry is not counted again.
6. **Given** a visitor merely loads an inquiry page, focuses a control, or triggers hidden, honeypot, technical, or automatic field population, **When** no meaningful customer-facing value is changed by the visitor, **Then** no inquiry start is recorded.
7. **Given** a visitor first changes a meaningful customer-facing inquiry field, **When** additional fields are later changed during the same attempt, **Then** exactly one inquiry start is recorded for that attempt.
8. **Given** the CRM has created the durable lead record, **When** inspiration-link persistence, notification email, toast presentation, or success-page navigation later fails, **Then** the inquiry remains one confirmed lead and is not counted again by a retry of those supporting steps.

---

### User Story 2 - Protect Private and Sensitive Journeys (Priority: P1)

As a customer, prospect, or florist, my CRM, payment, authentication, and form data is never sent to public-site analytics.

**Why this priority**: The application shares one domain across public, CRM, payment, and authentication surfaces; preventing collection is safer than filtering sensitive information after collection.

**Independent Test**: Inspect analytics activity while directly loading, refreshing, and navigating between eligible public routes and every excluded route family, including dynamic and token-bearing URLs.

**Acceptance Scenarios**:

1. **Given** a user opens or navigates within `/admin/*`, **When** the route loads or changes, **Then** no analytics library is activated and no analytics request or event is produced.
2. **Given** a customer opens `/pay/:token` or `/pay/:token/status`, **When** the payment page loads or changes state, **Then** no analytics library is activated and no token, payment detail, route, or interaction is collected.
3. **Given** a visitor uses login, password recovery, or password change routes, **When** authentication-related activity occurs, **Then** no analytics activity is produced.
4. **Given** a measured public session navigates to an excluded route, **When** the excluded route becomes active, **Then** public measurement stops and does not resume until an eligible public route is entered.
5. **Given** an eligible public event is collected, **When** its transmitted fields are inspected, **Then** it contains none of the prohibited personal, customer, project, payment, authentication, token, query-string, fragment, or free-text values defined by this specification.
6. **Given** a visitor reaches the public Not Found page through an unknown URL, **When** the event is measured, **Then** it contains only a recognized allowlisted public route category or `other` and contains no raw or encoded unknown path value.

---

### User Story 3 - Make a Meaningful Analytics Choice (Priority: P1)

As a public visitor, I can make and later change a clear choice about optional analytics without losing access to content or inquiry functionality.

**Why this priority**: Visitor choice and consistent consent signals are prerequisites for trustworthy, privacy-conscious measurement.

**Independent Test**: Exercise undetermined, accepted, declined, withdrawn, expired, corrupted, and returning-visitor consent states across direct loads, refreshes, and client-side navigation on desktop and mobile.

**Acceptance Scenarios**:

1. **Given** a visitor is confidently identified as being in the United States and has no contrary preference, **When** an eligible public page loads, **Then** privacy-restricted analytics is enabled by default and a clear opt-out remains available.
2. **Given** a visitor is outside the United States or location cannot be confidently determined, **When** an eligible public page loads, **Then** analytics remains disabled until the visitor affirmatively opts in.
3. **Given** Global Privacy Control is detected or a visitor manually opts out, **When** the visitor browses and submits an inquiry, **Then** all public functionality remains available and no subsequent GA4 request, event, or cookieless ping is sent.
4. **Given** an opted-out visitor later opts in, **When** future eligible public interactions occur, **Then** privacy-restricted measurement begins without attempting to reconstruct or backfill the opted-out period.
5. **Given** an enabled visitor later opts out, **When** future eligible interactions occur, **Then** all subsequent GA4 requests stop and the visitor can continue using the site.
6. **Given** a saved preference is less than twelve months old and no material analytics or privacy change has invalidated it, **When** the visitor returns, **Then** it overrides the regional default; once it reaches twelve months or is invalidated earlier, the visitor returns to the applicable U.S., non-U.S., or unknown-location default and is offered the appropriate choice again.
7. **Given** a visitor uses keyboard navigation or assistive technology, **When** the footer-level Analytics Preferences control or an opt-in notice is used, **Then** its choices and consequences are understandable and operable without manipulative design.

---

### User Story 4 - Connect Search Visibility to Website Outcomes (Priority: P2)

As the florist, I can compare Google Search visibility with public-site engagement and confirmed inquiries so I can prioritize SEO and content improvements.

**Why this priority**: Search Console describes what happens before a search click, while analytics describes eligible behavior after arrival; their combined value is greater than either report alone.

**Independent Test**: Using an authorized production property with representative data, compare organic queries and landing pages with engagement and lead outcomes without requiring the two products' totals to match.

**Acceptance Scenarios**:

1. **Given** the production domain property is verified and the sitemap is submitted, **When** the florist reviews search performance, **Then** queries, impressions, clicks, click-through rate, average position, landing pages, devices, available geography, and time trends are accessible.
2. **Given** the production search and analytics properties are connected with sufficient permission, **When** the florist reviews an organic landing page, **Then** pre-click search visibility can be evaluated alongside post-click engagement and confirmed leads.
3. **Given** Search Console and analytics show different totals, **When** the florist reviews reporting guidance, **Then** the difference is explained as an expected result of distinct attribution, privacy, processing, URL, and timing rules rather than a required reconciliation defect.
4. **Given** a location or service page gains impressions, **When** the florist evaluates it, **Then** the report shows whether the increased visibility is accompanied by qualified engagement or confirmed inquiries without claiming causation.

---

### User Story 5 - Understand Content and Marketing Performance (Priority: P2)

As the florist, I can compare public pages, contact actions, referrals, and campaigns so I can invest in the content and channels that show the strongest qualified interest.

**Why this priority**: Content-level and channel-level insight makes the analytics actionable for a regional floral business.

**Independent Test**: Generate representative organic, direct, social, referral, email, and tagged campaign journeys and verify the recurring report separates traffic, engagement, intent signals, and confirmed leads.

**Acceptance Scenarios**:

1. **Given** eligible traffic from organic search, direct visits, Instagram, Facebook, email, directories, venues, vendors, and tagged campaigns, **When** the florist reviews acquisition, **Then** available sources, media, campaigns, landing pages, and confirmed outcomes can be compared using consistent labels.
2. **Given** a visitor views portfolio, service, location, workshop, testimonial, or inquiry content, **When** the florist reviews content performance, **Then** page engagement and its contribution to inquiry journeys can be compared by device and acquisition context.
3. **Given** a visitor selects a public phone, email, Facebook, Instagram, approved outbound, or promotional call-to-action link, **When** the interaction is measured, **Then** the originating public page and available acquisition context are retained without transmitting the destination's personal or secure values.
4. **Given** a page has high traffic but weak onward engagement, or strong engagement but weak search visibility, **When** the florist reviews it, **Then** the report identifies the pattern as a decision-support signal rather than an automatic SEO conclusion.
5. **Given** a visitor follows a workshop call to action into the general inquiry form, **When** the inquiry starts or becomes a confirmed lead, **Then** its inquiry type remains general and its safe origin context identifies workshop.

---

### User Story 6 - Operate Trustworthy Measurement (Priority: P2)

As the florist, I retain practical control of the analytics accounts, definitions, retention, privacy disclosures, and recurring validation so the data remains trustworthy over time.

**Why this priority**: Analytics loses value when ownership, access, event meanings, or privacy behavior is undocumented or abandoned.

**Independent Test**: Review the production ownership record, access levels, retention setting, event dictionary, privacy policy, campaign convention, validation evidence, and recurring reporting instructions as a complete operational handoff.

**Acceptance Scenarios**:

1. **Given** the production properties exist, **When** account access is reviewed, **Then** the florist is the primary administrator, a separate business-controlled account is the recovery administrator, and all other named users and third-party access have only the minimum reporting permissions needed.
2. **Given** the standard event-level retention setting is reviewed, **When** production acceptance occurs, **Then** it is set to 14 months and its purpose, review owner, and limitations are documented.
3. **Given** the analytics behavior is ready for release, **When** the public privacy policy is compared with observed collection and consent behavior, **Then** the disclosures accurately match the deployed experience.
4. **Given** production measurement is active, **When** the florist follows the documented monthly review procedure across the native GA4 and Search Console reports, **Then** search visibility, acquisition, engagement, intent, and confirmed inquiry outcomes can be reviewed without an external combined dashboard and without using CRM, payment, or personally identifiable analytics data.
5. **Given** the florist marks a known browser as internal, **When** public pages are reviewed from that browser, **Then** no production analytics activity is generated while the public experience remains unchanged.

---

### User Story 7 - Preserve Website Reliability and Experience (Priority: P3)

As a public visitor, I can browse and submit an inquiry even when analytics is declined, blocked, slow, or unavailable.

**Why this priority**: Analytics must observe the business experience without becoming a dependency of that experience.

**Independent Test**: Block analytics and consent-supporting network requests, then exercise public navigation, portfolio viewing, contact actions, and inquiry submission on desktop and mobile while comparing page-experience measurements with the pre-release baseline.

**Acceptance Scenarios**:

1. **Given** the analytics provider is blocked or unavailable, **When** a visitor browses, views a portfolio, opens an inquiry, submits it, or uses contact links, **Then** each core public task remains functional.
2. **Given** analytics and consent functionality is active, **When** eligible pages are measured before and after release, **Then** there is no material regression against the approved page-experience thresholds.
3. **Given** a direct server-rendered or prerendered entry is followed by browser hydration and route navigation, **When** page views are inspected, **Then** each eligible navigation is measured once and no server-side event is emitted.

### Edge Cases

- Direct loads, refreshes, server rendering, hydration, and client-side navigation must not create duplicate or missing eligible page views.
- Moving from an eligible route to an excluded route must stop measurement; returning to an eligible route may resume only under the current consent state.
- Dynamic portfolio and location slugs may identify public content, but arbitrary paths, query strings, fragments, tokens, and not-found inputs must not be transmitted.
- Ad blockers, browser tracking prevention, disabled scripts, failed provider requests, unavailable storage, and declined consent produce incomplete data without breaking the website.
- Corrupted, expired, unavailable, or newly versioned consent preferences return to the applicable U.S., non-U.S., or unknown-location default; a valid saved preference takes precedence over regional defaults.
- VPNs, mobile networks, proxies, and inaccurate regional detection may produce an uncertain location; uncertainty must use the non-U.S. opt-in default rather than guessing that the visitor is in the United States.
- Repeated clicks, retries, refreshes, direct success-page access, and replayed client state must not duplicate confirmed leads.
- Failure of inspiration-link persistence, notification email, toast presentation, or success-page navigation after durable lead creation must not suppress the confirmed lead or cause supporting-step retries to create another lead event.
- Campaign values with inconsistent case or naming must be governed by documented naming conventions rather than silently treated as reliable comparisons.
- Low traffic, privacy thresholds, reporting delays, and visitors changing devices may limit conclusions and must be disclosed in reporting guidance.
- Search Console and analytics totals may differ and must not be forced to reconcile exactly.
- Future routes are unmeasured until classified; new admin, payment, token, or authentication routes are excluded by default.
- Public Not Found behavior is measured with an allowlisted public route category when safely recognizable and `other` otherwise; the raw requested path, query, fragment, token, unmatched value, and any encoded representation are never transmitted.
- A known florist browser may lose its internal preference when browser storage is cleared or the browser/device changes; the florist must be able to restore the preference, and unidentified internal traffic must be documented as a limitation rather than inferred through fingerprinting.
- Accidental prohibited-data collection must trigger documented containment, access review, correction, and provider-side remediation steps.

## Requirements *(mandatory)*

### Functional Requirements

#### Scope and route boundaries

- **FR-001**: The feature MUST measure only an explicit allowlist of approved public marketing and lead-generation routes on the production domain.
- **FR-002**: The feature MUST exclude `/admin/*`, `/pay/*`, login, password recovery, password change, authenticated CRM, customer payment status, secure token-bearing, preview, staging, local development, and automated test routes from analytics activation and collection.
- **FR-003**: Excluded routes MUST remain unmeasured on direct load, refresh, server render, client navigation, and navigation from a previously measured route.
- **FR-004**: Future routes MUST remain unmeasured until explicitly classified, and any future private, payment, authentication, or token-bearing route MUST be excluded by default.
- **FR-005**: The feature MUST preserve all existing public content, inquiry, SEO metadata, sitemap, server-rendering, prerendering, CRM, authentication, proposal, and payment behavior except for the analytics, consent, privacy-policy, and reporting changes expressly authorized here.

#### Search and production property foundation

- **FR-006**: The production domain MUST have a business-controlled Google Search Console domain property whose verification status and ownership are documented.
- **FR-007**: The production sitemap MUST be submitted or confirmed in Search Console, and submission status MUST be documented.
- **FR-008**: The florist MUST be able to review available search queries, impressions, clicks, click-through rate, average position, landing pages, devices, general geography, and time trends.
- **FR-009**: One clearly identified production GA4 property and website stream MUST be established for the production domain.
- **FR-010**: Production measurement MUST be separated from all local, automated, preview, and staging traffic; a florist-controlled internal-browser preference MUST prevent production analytics on known florist browsers without using IP-only identification or invasive visitor fingerprinting.
- **FR-011**: The production Search Console and GA4 properties MUST be connected when the documented business-controlled accounts have sufficient permission.
- **FR-012**: Documentation MUST state that Search Console measures pre-click search performance, GA4 measures eligible post-click behavior, neither product directly improves rankings, and their totals are not expected to match exactly.

#### Page, acquisition, and event measurement

- **FR-013**: Each actual eligible public navigation MUST produce exactly one intended page-view event across direct loads, refreshes, hydration, and client-side route changes, with no event emitted from server-side execution.
- **FR-014**: The florist MUST be able to compare engagement for the home, about, services, wedding, general floral, workshops, portfolio, portfolio detail, locations, location detail, testimonials, inquiry, privacy, terms, and other explicitly approved public marketing pages.
- **FR-015**: The event taxonomy MUST be lean, versioned, and documented with each event's business question, trigger, allowed parameters, consent requirement, and reporting category.
- **FR-016**: The initial taxonomy MUST cover eligible page views, portfolio views, approved promotional or service calls to action, wedding inquiry starts, general inquiry starts, safe workshop-origin context on the existing general inquiry journey, confirmed inquiry submissions, phone clicks, email clicks, Instagram clicks, Facebook clicks, approved outbound clicks, public downloads when present, and one meaningful-scroll event at 90% page depth. An inquiry start MUST occur only on the first user-driven change to a meaningful customer-facing field and MUST exclude page load, focus alone, hidden/technical/honeypot fields, and automatic population.
- **FR-017**: Traffic, engagement, intent signals, and confirmed lead outcomes MUST remain distinct reporting categories.
- **FR-018**: Supporting clicks, content views, scrolls, and inquiry starts MUST NOT be represented as confirmed inquiries.
- **FR-019**: Acquisition reporting MUST distinguish available organic Google, other organic search, direct, Instagram, Facebook, venue, vendor, wedding-directory, email, tagged campaign, paid, and other referral traffic.
- **FR-020**: A documented, case-consistent campaign naming convention MUST support comparable source, medium, campaign, content, and term values without permitting personal or secure data.
- **FR-021**: Contact and outbound events MUST retain only the originating public content classification and safe acquisition context; destination email addresses, telephone numbers, personalized URLs, and secure values MUST NOT be transmitted.

#### Inquiry outcomes and decision support

- **FR-022**: A confirmed lead event MUST be created once the CRM successfully creates the durable lead record; this durable record creation is the authoritative inquiry-acceptance boundary.
- **FR-023**: Invalid forms, failed lead-creation requests, Submit clicks alone, direct success-route visits, refreshes, retries, and previously measured submissions MUST NOT create confirmed lead events.
- **FR-024**: Each durable lead record MUST produce no more than one confirmed lead event for the associated client journey, and later inspiration-link, notification-email, toast, or navigation failures and retries MUST neither suppress nor duplicate it.
- **FR-025**: The confirmed inquiry event MUST be designated as the primary initial key event.
- **FR-026**: The florist MUST be able to compare confirmed inquiries by available source, medium, campaign, organic status, initial landing page, safe origin context, content category, device, safe general geography, new/returning classification, and reporting period.
- **FR-027**: Reporting MUST support aggregated entry, onward-navigation, exit, and inquiry-abandonment analysis for portfolio-to-inquiry, service-to-inquiry, and location-to-inquiry journeys.
- **FR-028**: The florist MUST be able to compare portfolio, service, location, workshop, testimonial, and inquiry content by traffic, engagement, intent signals, and confirmed inquiry contribution.
- **FR-029**: A documented monthly procedure using the native GA4 and Search Console reports MUST enable the florist to compare available search impressions, clicks, click-through rate, average position, organic visits, engagement, confirmed inquiries, conversion rate, landing pages, location pages, services, devices, acquisition sources, campaigns, and time trends without requiring one merged dashboard.
- **FR-030**: Reports and guidance MUST label delayed, thresholded, consent-limited, unavailable, low-volume, or otherwise incomplete data and MUST warn that correlation does not establish causation.
- **FR-031**: The business MUST collect a recommended 60-to-90-day initial baseline covering search visibility, acquisition, public engagement, inquiry starts, confirmed inquiries, conversion rate, landing pages, devices, and locations before drawing major strategic conclusions.
- **FR-032**: The reporting model MUST support later before-and-after comparisons for content, calls to action, inquiry forms, campaigns, partnerships, SEO work, and page-experience improvements.

#### Consent and visitor control

- **FR-033**: Before production release, a qualified privacy review MUST document whether applicable RI, CT, MA, federal, and reasonably anticipated visitor-jurisdiction requirements permit the selected behavior; whether business thresholds apply; whether contractual and property settings avoid sale or targeted-advertising treatment; whether notice, Global Privacy Control, and opt-out handling are sufficient; and how pending Massachusetts legislation affects the policy. This review does not convert the specification into legal advice.
- **FR-034**: Privacy-restricted analytics MUST be enabled by default only for visitors confidently identified as being in the United States; visitors outside the United States or whose location cannot be confidently determined MUST have analytics disabled until affirmative opt-in.
- **FR-035**: A footer-level Analytics Preferences control MUST allow every visitor to enable, disable, revisit, and change optional analytics without losing access to public content, contact actions, or inquiry submission; valid saved preferences MUST override regional defaults.
- **FR-036**: The feature MUST detect and honor supported Global Privacy Control signals as an analytics opt-out, and a manual or signal-based opt-out MUST prevent every subsequent GA4 request, event, or cookieless ping until the visitor affirmatively opts in.
- **FR-037**: Consent controls MUST be usable on supported mobile and desktop sizes and operable by keyboard and assistive technology.
- **FR-038**: U.S., non-U.S., unknown-location, Global Privacy Control, manually enabled, manually disabled, changed, saved, expired, corrupted, and unavailable preference states MUST have documented and testable outcomes; a saved preference MUST remain valid for twelve months unless a material analytics or privacy change invalidates it earlier and requires the appropriate choice to be presented again.
- **FR-039**: The applicable regional default, Global Privacy Control signal, and saved visitor preference MUST be resolved before optional collection during direct loads, server-rendered entry and hydration, route changes, refreshes, and subsequent public pages; unknown location MUST use the non-U.S. opt-in default.
- **FR-040**: Google Ads integration, advertising storage, advertising user data, advertising personalization, Google Signals, remarketing, audience activation, URL passthrough, cross-site advertising measurement, and unnecessary Google data-sharing settings MUST remain disabled for every visitor and MAY be enabled only by a later approved specification with a new privacy review.

#### Privacy, governance, and ownership

- **FR-041**: The public privacy policy MUST be updated before or alongside production activation and MUST accurately describe analytics purposes, collected and excluded categories, cookies or similar storage, consent signals, Google's role, retention, visitor choices, withdrawal, and privacy contact options.
- **FR-042**: The privacy policy MUST NOT describe pseudonymous or aggregated measurement as fully anonymous and MUST match observed production behavior at acceptance.
- **FR-043**: Analytics MUST NOT transmit names, email addresses, telephone numbers, mailing addresses, form answers, free text, identifiable event dates, customer/lead/project/payment/invoice/authentication identifiers, secure tokens, signed URLs, recovery/session/authorization values, complete personalized URLs, CRM data, payment data, or payment-method choices.
- **FR-044**: Dynamic route values, page titles, query strings, fragments, campaign values, event names, and event parameters MUST be reviewed and sanitized so prohibited data cannot enter analytics.
- **FR-045**: Only the minimum safe fields needed to answer an approved business question MAY be included in an analytics event.
- **FR-046**: A documented incident process MUST cover containment, correction, access review, provider-side remediation, and revalidation if prohibited or unintended data is collected.
- **FR-047**: The florist MUST be the documented primary administrator of the production properties, and a separate business-controlled account MUST be the recovery administrator so property control does not depend on one account.
- **FR-048**: Every other property user, including contractors and agencies, MUST use a named account with only the minimum reporting permissions needed; configuration authority MUST remain limited to the two business-controlled administrators unless a later documented access review explicitly approves a temporary exception. Access records MUST support periodic review, revocation, removal of obsolete users, third-party documentation, and ownership transfer.
- **FR-049**: Analytics passwords, credentials, secrets, property recovery data, or other privileged account information MUST NOT be committed to source control or exposed to public clients.
- **FR-050**: Event-level retention MUST be set to 14 months for the initial standard property, with the rationale, owner, setting limitations, review point, and any future long-term export need documented.

#### Reliability, validation, and maintenance

- **FR-051**: Analytics or consent-provider delay, blocking, rejection, or failure MUST NOT prevent public content loading, navigation, portfolio viewing, contact actions, inquiry entry, validation, or successful submission.
- **FR-052**: Before production acceptance, a written measurement validation record MUST cover single page views, excluded routes, confirmed-lead accuracy, deduplication, contact/outbound triggers, attribution, consent transitions, prohibited-data absence, environment separation, property connection, ownership, retention, and privacy-policy accuracy.
- **FR-053**: Validation MUST exercise supported desktop and mobile experiences, direct navigation, refresh, server-rendered entry, hydration, client navigation, provider failure, and storage unavailability.
- **FR-054**: Public page experience MUST be baselined before release and compared after release; the feature MUST not move any Core Web Vital from a good classification to needs-improvement or poor, and must not regress any measured 75th-percentile Core Web Vital by more than 10% without explicit product-owner acceptance.
- **FR-055**: Event definitions, route classifications, campaign conventions, consent behavior, access ownership, retention, privacy disclosures, reporting limitations, native-report navigation, monthly review steps, and recurring validation instructions MUST be maintained as an operational handoff.
- **FR-056**: Session replay, heatmaps, personally identifiable visitor profiles, CRM/payment/authentication tracking, personalized advertising, remarketing, data sale/sharing, automatic SEO modification, paid analytics subscriptions, a combined external dashboard, a custom CRM analytics dashboard, scheduled generated reports, and a long-term analytics warehouse are outside this feature.
- **FR-057**: The business MUST review the analytics privacy and provider configuration at least annually and whenever relevant laws, Google settings, target markets, traffic volume, vendors, or measurement purposes materially change.
- **FR-058**: Each inquiry attempt MUST produce no more than one inquiry-start event, even when the visitor changes multiple fields, moves between controls, encounters validation errors, or revises values before submission.
- **FR-059**: Each eligible page view MUST produce no more than one meaningful-scroll event, triggered when the visitor first reaches 90% page depth; repeated movement above and below the threshold MUST NOT duplicate it.
- **FR-060**: A visitor who enters the existing general inquiry journey from an approved workshop call to action MUST retain `general` as the inquiry type and `workshop` as a separate safe origin context through inquiry start and confirmed lead measurement; this context MUST NOT change the CRM lead type or contain user-entered data.
- **FR-061**: A public Not Found event MUST include only an allowlisted safe public route category when the unknown request can be recognized without exposing dynamic values and MUST use `other` otherwise; it MUST NOT include the raw requested path, query string, fragment, token, unmatched segment, page title derived from the unknown value, or any hashed or reversible representation of them.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the public website and cross-cutting route/configuration boundaries only. It does not authorize analytics inside the client payment surface, authentication surface, CRM admin portal, or Supabase customer/payment data flows.
- **Product Owner Approval**: The product owner explicitly authorized public analytics, an accessible consent experience, the privacy-policy update, eligible inquiry instrumentation, and measurement-related performance validation through this specification request. Unrelated public styling, content, routing, SEO, or form changes remain unapproved.
- **Brownfield Preservation**: Existing public pages, route destinations, inquiry validation/submission, sitemap, metadata, SSR/prerender behavior, CRM, proposals, authentication, and payments remain unchanged except for explicitly scoped analytics events, consent controls, privacy disclosures, and operational reporting.
- **Supabase Security**: No Supabase table, RLS policy, storage policy, database function, or Edge Function change is currently required by the feature requirements. If planning discovers a durable backend deduplication or data-contract change is necessary, it must define the affected data boundary, RLS, executable migration, and standalone Edge Function rules before implementation.
- **Schema Migration**: No schema migration is authorized by this specification. Any later plan proposing a Supabase schema change must identify an executable migration that preserves existing data and application order.
- **Standalone Edge Functions**: No Edge Function change is currently required. Any later affected Edge Function must remain standalone without `_shared`, local shared modules, or imports from another function, and no automated Edge Function tests may be created.
- **Testing Expectations**: Angular unit tests are required for route eligibility, browser-only loading, page-view deduplication, event sanitization, inquiry outcome deduplication, consent states, failure isolation, and affected UI. Provider configuration receives documented production/debug validation. PostgreSQL integration tests apply only if planning introduces a database contract. Edge Function automated tests remain prohibited.
- **Sensitive Data**: The feature expressly prohibits customer, inquiry-content, employee, CRM, authentication, proposal, payment, token, and other identifying data from analytics and requires negative validation of outbound requests.
- **Proposal Workflow**: Proposal planning, manual Canva PDF upload, invoice data, payment tracking, and future financial reporting are unaffected and excluded from analytics.
- **Git Publication**: AI agents MUST NOT commit or push. Publication remains the human operator's responsibility.

### Key Entities *(include if feature involves data)*

- **Analytics Property**: The business-controlled production measurement container, including its owner, access roles, stream identity, retention period, and connection status.
- **Search Property**: The verified production-domain search-performance source, including ownership, sitemap status, and connection status.
- **Route Classification**: A route pattern's measured or excluded status, public content category, dynamic-value handling, and review state.
- **Measurement Event Definition**: A governed event name, business purpose, trigger, safe parameters, consent requirement, reporting category, version, and deduplication expectation.
- **Consent Preference**: A visitor's optional-analytics choice, twelve-month validity period, time/version context, early material-change invalidation state, and ability to be changed or withdrawn; it contains no customer or inquiry identity.
- **Internal-Browser Preference**: A florist-controlled setting on a known browser that prevents production analytics until removed or lost through browser-storage clearing; it contains no customer identity and does not rely on visitor fingerprinting.
- **Campaign Convention**: The approved vocabulary and normalization rules for source, medium, campaign, content, and term labels.
- **Measurement Validation Record**: Evidence that route exclusion, event accuracy, consent, privacy, ownership, retention, environment separation, and website reliability satisfy release requirements.
- **Baseline Report**: The initial 60-to-90-day comparison of search visibility, acquisition, engagement, intent, and confirmed lead outcomes, including limitations and reporting period.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every approved public navigation in the release validation produces exactly one intended page view, and at least 95% of a representative client-side navigation sample is represented without duplicate or missing views.
- **SC-002**: Zero analytics library activations, requests, or events occur during validated admin, payment, login, password recovery, password change, authenticated, or secure token-bearing journeys.
- **SC-003**: Every validated newly created durable CRM lead produces exactly one confirmed lead outcome, including when a later supporting step fails, while zero invalid forms, failed lead-creation requests, duplicated records, refreshes, supporting-step retries, or manually simulated success journeys produce an additional outcome.
- **SC-004**: Zero prohibited personal, customer, project, payment, authentication, free-text, secure-token, query-string, or fragment values appear in inspected analytics requests and validation reports.
- **SC-005**: 100% of tested U.S., non-U.S., unknown-location, Global Privacy Control, manual preference, saved preference, twelve-month expiration, material-change invalidation, direct-load, refresh, hydration, and client-navigation states produce their documented behavior; every opt-out produces zero subsequent GA4 requests or cookieless pings while all core public and inquiry tasks remain successful.
- **SC-006**: The florist can identify confirmed inquiry outcomes by available acquisition source, initial landing page, device, and reporting period and can distinguish traffic, engagement, intent, and leads.
- **SC-007**: The florist can compare Google Search visibility with post-click engagement and confirmed inquiry outcomes for representative location, service, and portfolio landing pages without requiring product totals to match.
- **SC-008**: The florist can compare portfolio, service, location, contact, social, referral, and tagged-campaign performance using the documented event and campaign definitions.
- **SC-009**: Blocking every optional analytics-provider request causes zero failures in public page loading, navigation, portfolio viewing, phone/email links, inquiry entry, or successful inquiry submission.
- **SC-010**: No measured 75th-percentile Core Web Vital moves from good to needs-improvement or poor, and no such metric regresses more than 10% from the approved pre-release baseline without explicit product-owner acceptance.
- **SC-011**: At release, the privacy policy matches observed analytics and consent behavior, the florist is verified as primary administrator, a separate business-controlled recovery administrator is verified, and every other named or third-party user is limited to the documented minimum reporting access.
- **SC-012**: The production event-level retention period is verified as 14 months and its rationale, limitations, owner, and review process are documented.
- **SC-013**: Within 90 days of production activation, the florist can follow the documented monthly procedure in the native GA4 and Search Console interfaces to produce a baseline containing search visibility, acquisition, public engagement, inquiry starts, confirmed inquiries, conversion rate, landing-page, device, and location-page views without CRM, payment, or personally identifiable analytics data.
- **SC-014**: Every validated local, preview, staging, automated, and internal-marked browser journey produces zero production analytics requests while preserving the tested public website behavior.
- **SC-015**: Every validated inquiry attempt records exactly one start after its first meaningful user-driven field change and records zero starts for page load, focus-only, hidden, technical, honeypot, or automatically populated field activity.
- **SC-016**: Every validated eligible page view records exactly one meaningful-scroll event upon first reaching 90% page depth and no duplicate when the visitor crosses that threshold again.
- **SC-017**: Every validated workshop-to-general-inquiry journey remains classified as a general inquiry and exposes workshop as a separate safe origin context at inquiry start and confirmed lead, without changing the CRM record type.
- **SC-018**: Every validated Not Found event contains either an approved public route category or `other`, and zero inspected events contain a raw or encoded unknown path, query, fragment, token, unmatched segment, or unknown-derived page title.

## Assumptions

- The florist/business owner is the primary report consumer and primary administrator of the production Search Console and analytics properties; a separate business-controlled account serves as recovery administrator, while all other users receive only least-privilege reporting access.
- The production public domain remains `blackbegoniaflorals.com`, with CRM under `/admin/*`, payment access under `/pay/*`, and authentication/password routes in the same Angular application.
- The current repository has no established GA4, tag-management, consent-management, or Search Console integration; planning will verify this again before selecting an approach.
- Privacy-restricted analytics is enabled by default only for confidently identified U.S. visitors. Non-U.S. and unknown-location visitors require affirmative opt-in; Global Privacy Control and saved manual preferences override regional defaults; every visitor can use the footer-level Analytics Preferences control; and opt-out means no subsequent GA4 request or cookieless ping.
- Saved Analytics Preferences remain valid for twelve months unless a material analytics or privacy change invalidates them earlier.
- Standard event-level retention is 14 months. A long-term external warehouse is not needed for the initial baseline.
- Recurring review uses native GA4 and Search Console reports plus documented monthly steps; no combined external dashboard, CRM analytics dashboard, or scheduled generated report is required.
- Google Ads integration, advertising storage, advertising user data, advertising personalization, Google Signals, remarketing, audience activation, URL passthrough, cross-site advertising measurement, and unnecessary Google data-sharing settings remain disabled.
- The business will obtain qualified privacy review before production activation and will reassess the policy at least annually and when relevant laws, Google settings, target markets, traffic volume, vendors, or purposes materially change.
- The production GA4 and Search Console account setup includes manual provider-console work by a business-controlled administrator; application deployment alone cannot complete ownership verification, linking, access assignments, or retention configuration.
- Internal traffic will be excluded only through a reliable, documented, non-invasive method. Traffic that cannot be safely identified remains a disclosed reporting limitation.
- Known florist browsers use an explicit internal preference rather than an IP-only filter; the florist must restore the preference after changing browsers/devices or clearing its storage.
- A successful inquiry is confirmed by durable CRM lead-record creation; later inspiration-link, notification-email, toast, or navigation results do not change or repeat that business outcome.
- Inquiry start means the first user-driven change to a meaningful customer-facing form field and is recorded once per attempt; passive page access and non-customer-facing field activity are excluded.
- Meaningful scroll engagement is recorded once per eligible page view when the visitor reaches 90% page depth.
- Workshop calls to action continue using the general inquiry and CRM lead workflow; analytics retains `general` as inquiry type and separately records the safe `workshop` origin context.
- Public Not Found measurement uses only allowlisted safe route categories or `other`; exact broken URLs remain available through appropriate search and hosting diagnostics rather than GA4 event fields.
- Aggregate analytics is decision support rather than an authoritative CRM record, complete visitor history, heatmap, session replay, or proof of SEO causation.
- Search Console reporting delay, analytics consent loss, blockers, privacy thresholds, attribution differences, and low volume are accepted limitations that must be explained rather than hidden.
