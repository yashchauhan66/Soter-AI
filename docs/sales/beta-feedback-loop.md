# Beta Feedback and Accuracy Loop

1. Collect feedback only from authorized users.
2. Store redacted examples, detector category, expected action, and business impact.
3. Separate false positive, reported false negative, correct decision, and policy preference.
4. Review repeated patterns by segment and detector.
5. Add accepted redacted examples to a versioned evaluation dataset.
6. Evaluate precision, recall, and regressions before rollout.
7. Pilot threshold/policy suggestions with the reporting customer.
8. Roll out only when quality improves without unacceptable regression.
9. Report the change and remaining limitation.

Do not send raw sensitive content to external analytics or ML providers.
