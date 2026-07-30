# Measurement Dictionary

## Events

| Event | Business question | Safe parameters |
|---|---|---|
| `page_view` | Which approved public categories receive visits? | sanitized page location/referrer, page/content category, audited content ID, normalized campaign values |
| `select_content` | Which approved public content is intentionally opened? | page category, content category, audited content ID |
| `cta_select` | Which public calls to action show intent? | page category, controlled CTA location/origin |
| `inquiry_start` | How many visitors meaningfully begin an inquiry? | page category, `general\|wedding`, optional `workshop` origin |
| `generate_lead` | Which journeys produce a durably accepted inquiry? | page category, inquiry type, safe origin/source/medium/campaign |
| `phone_click` / `email_click` | Which pages produce contact intent? | page category, controlled CTA location |
| `social_click` | Which approved social destination is selected? | page category, controlled location, `facebook\|instagram` |
| `outbound_click` | Which approved referral category is selected? | page category, controlled location/category |
| `file_download` | Which public resource category is selected? | page category, controlled resource category |
| `scroll` | Which pages reach meaningful depth? | page category, constant `90` |
| `not_found` | How often is the sanitized public fallback shown? | constant `not_found` category |

`generate_lead` is the only initial key event. Traffic, engagement, intent, and confirmed leads must
remain separate report concepts.

## Campaign convention

Use lowercase ASCII labels with words separated by underscores. Recommended sources include
`instagram`, `facebook`, venue/vendor names, directory names, and email program names. Recommended
media include `social`, `referral`, `email`, `organic`, and `paid_social`. Keep one campaign name
stable across links, for example `2026_summer_weddings`. Never put a name, email, phone, event date,
customer reference, or free text in a UTM value.

## Prohibited data

Never send names, email addresses, phone numbers, street addresses, inquiry answers, free text,
customer/lead/project/payment/invoice/authentication IDs, event dates tied to a person, payment
amount/method, tokens, authorization values, full personalized URLs, query strings, fragments, DOM
text, link destinations, or internal CRM values.

## Approved binding inventory

| Interaction | Safe enum/context | Template |
|---|---|---|
| Header/footer inquiry actions | `cta_select`; `header`, `mobile_header`, `footer`, `footer_marquee` | public header and footer templates |
| Header/footer social actions | `social_click`; controlled location plus `facebook\|instagram` | public header and footer templates |
| Landing inquiry actions | `cta_select`; `landing_hero`, `landing_process`, `landing_locations`, `landing_bottom` | `components/public/landing/landing.component.html` |
| About inquiry actions | `cta_select`; `about_story`, `about_bottom` | `components/public/about/about.component.html` |
| Service inquiry actions | `cta_select`; `wedding_services_process`, `wedding_services_bottom`, `general_services` | wedding/general service templates |
| Inquiry type selection | `cta_select`; `inquiry_selection` | `components/public/inquiries/inquiries.component.html` |
| Location inquiry actions | `cta_select`; `locations_hub`, `location_detail` | location hub/detail templates |
| Testimonial and success actions | `cta_select`; `testimonials`, `testimonials_bottom`, `inquiry_success` | testimonials and inquiry-success templates |
| Workshop inquiry actions | allowlisted `workshop` inquiry origin | `components/public/workshops/workshops.component.html` |
| Portfolio resolution | `select_content`; generic `portfolio` unless a slug is audited | portfolio-detail component |

No public `tel:` or `mailto:` link currently exists in the audited templates. When one is added, it
must use `phone_click` or `email_click` with only a controlled location; the number/address and href
must not be read. File-download and other outbound events remain dormant until a specific approved
public resource or destination exists.
