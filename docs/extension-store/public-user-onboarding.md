# Public User Onboarding

When users install the Soter Enterprise AI Guard extension from the public Chrome Web Store or Edge Add-ons marketplace, they might not yet have an enterprise enrollment code.

To comply with public listing guidelines and provide a good user experience, the extension defaults to an **Enterprise-only / Demo** view (Option C):

1. **Clear Onboarding State**: The popup displays "Connect to your Soter organization" immediately upon installation.
2. **Missing State Handling**: A clear error message is shown if enrollment fails.
3. **Public Landing Link**: The UI includes a clear "Learn more or Request Access" link that directs unauthorized users to the public landing page (https://soter-example.com/request-access) where they can learn about the product and contact sales.
4. **No Breakages**: The extension does not crash, throw unhandled exceptions, or show a broken "empty" UI when not enrolled. It intercepts nothing and logs nothing until it successfully syncs a policy from a valid backend.

This behavior strictly adheres to public review guidelines for enterprise-only extensions by clearly explaining the requirement and providing a path forward.
