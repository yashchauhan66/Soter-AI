# Customer Onboarding Checklist (Pilot)

## Pre-requisites
- [ ] Enterprise has signed the pilot agreement.
- [ ] Enterprise has designated a primary admin and security contact.
- [ ] Customer IT team has access to the Soter Admin Control Plane.

## Configuration
- [ ] Provision dedicated tenant in Soter backend.
- [ ] Work with admin to configure initial DLP policy (mild threshold for pilot).
- [ ] Configure allowed target AI domains.
- [ ] Generate bulk enrollment token for pilot cohort.

## Deployment
- [ ] Customer IT team packages extension for their MDM (Intune, Jamf, Chrome Enterprise).
- [ ] Customer deploys to pilot group (e.g., 50-100 users).
- [ ] Customer pushes initial configuration (API Base URL and Enrollment Token) via MDM managed policies.

## Validation
- [ ] Verify devices appear in the "Extension Enrollments" dashboard.
- [ ] Verify successful heartbeat from at least 80% of pilot devices within 24 hours.
- [ ] Perform a test scan event using a benign test phrase to confirm end-to-end event logging.

## Feedback & Review
- [ ] Schedule weekly sync with admin to review false positives.
- [ ] Adjust DLP thresholds if needed.
- [ ] Collect user feedback on UI interruptions.
