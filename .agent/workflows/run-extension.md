---
description: How to run, test, and package the SoterAI IDE Guard VS Code extension
---

This workflow details how to run the SoterAI IDE Guard extension in development mode, run integration tests, and package it for production usage.

### Prerequisites
Make sure dependencies are installed and the packages are built:
```bash
# In the repository root
npm install
npm run build
```

### Steps to Run and Test

#### 1. Running the VS Code Extension in Development
1. Open the project folder `c:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard` in VS Code.
2. Open the **Run and Debug** view in the sidebar (or press `Ctrl+Shift+D`).
3. Select **Extension** from the dropdown menu and press `F5` / click the Play button.
4. A new **Extension Development Host** VS Code window will spawn running the SoterAI IDE Guard extension.

#### 2. Running the Shared Core Tests
To execute the local detector suite for secrets, PII, prompt injections, and code risk patterns:
```bash
cd packages/guard-core
npm run test
```

#### 3. Packaging the Extension to `.vsix`
To package the extension into a private local installation package:
```bash
cd packages/vscode-extension
npx @vscode/vsce package
```
This produces `soterai-ide-guard-0.1.0.vsix` in the directory, which can be installed in any VS Code instance using `Extension: Install from VSIX...` command.
