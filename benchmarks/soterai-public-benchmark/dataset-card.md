# Dataset Card

## Provenance
All rows in this public dataset are synthetic and generated for defensive benchmark evaluation.

## Schema
Each JSONL row includes id, category, text, expected_label, expected_risk_category, source_type, language, difficulty, notes, and should_block.

## Counts
- Prompt injection: 250
- Jailbreak: 250
- System prompt leak: 300
- Data exfiltration: 300
- RAG poisoning: 200
- Tool abuse: 100
- MCP risk: 100
- Unicode obfuscation: 200
- Hinglish/multilingual: 200
- Secret/PII: 300
- Benign controls: 1000

## Restrictions
Do not treat this as independent validation. Do not add real secrets, real PII, proprietary customer data, or copyrighted long text.
