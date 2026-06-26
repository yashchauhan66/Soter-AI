# SoterAI Dify Marketplace Submission Checklist

## Prerequisites

- [ ] Dify plugin tested locally with a running Dify instance
- [ ] All 4 tools return correct JSON when called with valid credentials
- [ ] Provider credential validation works (valid key accepted, invalid key rejected)
- [ ] Icon renders correctly at 64x64 and smaller sizes

## Submission Steps

1. **Fork the dify-plugins repository**
   ```
   gh repo fork langgenius/dify-plugins --clone
   ```

2. **Add the plugin directory**
   Copy the entire `dify/` folder into the forked repo under the appropriate category:
   ```
   cp -r packages/integrations/dify/ dify-plugins/security/soterai/
   ```

3. **Verify the directory structure**
   ```
   security/soterai/
     manifest.yaml
     icon.svg
     provider/
       soterai.py
     tools/
       input_guard.yaml
       input_guard.py
       output_guard.yaml
       output_guard.py
       pii_redactor.yaml
       pii_redactor.py
       rag_scanner.yaml
       rag_scanner.py
     README.md
   ```

4. **Submit a Pull Request**
   - Title: `Add SoterAI security plugin`
   - Description must include:
     - Plugin name and category
     - Brief description of what the plugin does
     - List of tools provided
     - Link to the SoterAI documentation or website
     - Confirmation that the plugin has been tested

## Required PR Fields

| Field | Value |
|-------|-------|
| Plugin name | soterai |
| Author | SoterAI |
| Category | security |
| Version | 0.1.0 |
| Tools count | 4 |
| External dependencies | None (stdlib only) |
| API documentation | https://docs.soterai.dev |
| Privacy URL | https://soterai.dev/privacy |
| Terms URL | https://soterai.dev/terms |
| Support email | support@soterai.dev |

## Review Process

1. Dify team reviews the PR for manifest correctness and code quality.
2. They may request changes to naming, descriptions, or parameter handling.
3. Once approved, the plugin appears in the Dify Marketplace.
4. Future updates follow the same fork-and-PR workflow with a bumped version number.

## Post-Submission

- [ ] Monitor the PR for reviewer feedback
- [ ] Update version in manifest.yaml for any requested changes
- [ ] After merge, verify the plugin appears in the Dify Marketplace search
- [ ] Add a badge to the main project README linking to the Dify Marketplace listing
