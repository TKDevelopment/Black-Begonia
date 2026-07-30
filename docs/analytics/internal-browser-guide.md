# Internal Browser Exclusion Guide

On each florist/staff browser:

1. Open **Analytics Preferences** in the public footer.
2. Select **Exclude this browser from analytics**.
3. Reload an approved public page and verify no Google Analytics request begins.
4. Repeat for every browser profile/device used for internal testing.

The marker is local to that browser. It contains no user identity and is not staff authentication.
Clearing site storage removes it. To reverse it, reopen preferences and select
**Include this browser again**. Review these markers when devices, browsers, or staff access change.
