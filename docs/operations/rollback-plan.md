# Rollback Plan

## Overview
In the event that the Soter Enterprise AI Guard extension causes critical workflow disruption (e.g., falsely blocking all traffic, browser instability, excessive CPU/memory usage), this rollback plan outlines the steps to disable or downgrade the extension.

## Scenario 1: Feature Disruption (False Positives)
If the extension is aggressively blocking valid prompts:
1. **Admin Action:** Log into Soter Control Plane.
2. Navigate to Policies.
3. Lower the threshold or disable specific aggressive rules.
4. The extension polls for policy updates (default every 15-60 minutes). To force sync, the user can click "Sync Policy" in the extension popup.

## Scenario 2: Emergency Lockdown Abuse or Bug
If users are locked out incorrectly:
1. **Admin Action:** Navigate to "Emergency Lockdown" in the admin dashboard.
2. Toggle the lockdown state to OFF.
3. Wait for the extension heartbeat to sync the new state.

## Scenario 3: Complete Extension Failure / Browser Instability
If the extension is causing Chrome/Edge to crash:
1. **Customer IT Action:** Use MDM (Intune/Jamf/Chrome Enterprise) to issue a policy disabling the Soter extension ID.
2. Alternatively, remove the extension from the mandatory force-install list.
3. Users must restart their browser for the MDM policy to take effect.

## Re-deployment
Once the root cause is identified and patched, a new version (e.g., v0.1.1) will be published.
1. Deploy to a tiny test group (5 users).
2. Validate stability.
3. Resume pilot deployment.
