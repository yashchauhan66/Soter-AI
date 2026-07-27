import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── Authority impersonation ──────────────────────────────────────────
  {
    pattern: /\bi am (?:the |your )?(?:admin|developer|creator|owner|CEO|CTO|engineer|manager|supervisor)\b.{0,180}(?:bypass|override|disable|reveal|grant|give|show|access|remove|unlock|ignore)/i,
    label: "Authority impersonation",
    message: "Claims an authority role and requests a privileged action.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\bspeaking as (?:the )?(?:system|your creator|the administrator|an engineer|management)\b.{0,180}(?:bypass|override|disable|reveal|grant|give|show|access|remove|unlock|ignore)/i,
    label: "Authority voice claim",
    message: "Assumes an authority voice to request a privileged action.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\bthis is (?:an? )?(?:official|authorized|verified|executive) (?:request|directive|command|order)\b.{0,180}(?:bypass|override|disable|reveal|grant|give|show|access|remove|unlock|ignore|provide|comply)/i,
    label: "Official directive claim",
    message: "Fabricates an official directive to compel a privileged action.",
    severity: "HIGH",
    score: 40,
  },

  // ── Emergency / urgency manipulation ─────────────────────────────────
  {
    pattern: /\bthis is (?:an? )?(?:emergency|urgent|critical|time[- ]sensitive)\b.{0,180}(?:access|data|override|bypass|reveal|show|grant|disable|give|provide|unlock)/i,
    label: "Emergency urgency manipulation",
    message: "Fabricates an emergency to pressure privileged access.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\b(?:immediately|urgently|right now)\b.{0,60}(?:give|provide|grant|reveal|show|bypass|disable|override|unlock|hand over)/i,
    label: "Urgency pressure tactic",
    message: "Uses urgency language to pressure a bypass or disclosure.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\bthere(?:'s| is) (?:a )?(?:security breach|active attack|critical failure|active incident)\b.{0,180}(?:need|must|require|have to|got to).{0,120}(?:immediate|bypass|override|access|disable|reveal|grant)/i,
    label: "Fake security incident",
    message: "Fabricates a security incident to justify a privileged action.",
    severity: "MEDIUM",
    score: 35,
  },

  // ── False authorization claims ───────────────────────────────────────
  {
    pattern: /\bi (?:have|was given|received|got)\b.{0,60}(?:authorization|permission|clearance|approval)\b.{0,120}(?:access|override|bypass|disable|reveal|view|modify|delete|change)/i,
    label: "False authorization claim",
    message: "Claims unverifiable authorization for a privileged action.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\bi have been (?:authorized|approved|cleared|permitted) by (?:management|the team|admin|security|the board|leadership)\b.{0,120}(?:access|override|bypass|disable|reveal|view|modify|delete)/i,
    label: "False management approval",
    message: "Claims management or team authorization for a privileged action.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\b(?:the board|management|compliance|legal|security team) (?:approved|authorized|requires?|demands?) (?:this )?(?:override|bypass|access|exception|exemption)\b/i,
    label: "Fabricated executive approval",
    message: "Fabricates executive or compliance approval for an override.",
    severity: "HIGH",
    score: 40,
  },

  // ── Relationship exploitation ────────────────────────────────────────
  {
    pattern: /\bas (?:your |the )?(?:creator|developer|trainer|builder)\b.{0,60}(?:I )?(?:need|want|require|order|demand|instruct|command) you to\b/i,
    label: "Creator relationship exploitation",
    message: "Exploits a claimed creator relationship to compel obedience.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\bi trained you (?:to )?(?:obey|help|follow|listen|comply)\b/i,
    label: "Training authority claim",
    message: "Claims training authority to demand compliance.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\byou were (?:designed|built|programmed|created) to (?:obey|serve|follow|help) me (?:without question|unconditionally|always|no matter what)\b/i,
    label: "Unconditional obedience claim",
    message: "Claims the AI was built to obey unconditionally.",
    severity: "HIGH",
    score: 40,
  },

  // ── Gaslighting / confusion tactics ──────────────────────────────────
  {
    pattern: /\byou (?:don'?t remember|forgot|were updated|were reconfigured)\b.{0,120}(?:allow|permit|enable|accept|comply|do this|grant|bypass|override)/i,
    label: "Gaslighting: false memory",
    message: "Gaslights the AI into believing it was reconfigured to allow an action.",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /\byour (?:rules|instructions|guidelines|policies|restrictions) have been (?:changed|modified|updated|revised|removed)\b.{0,120}(?:you (?:can|should|must)|allow|permit|comply|bypass|override)/i,
    label: "Gaslighting: rule change",
    message: "Falsely claims the AI's rules were changed to enable a privileged action.",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /\bthe previous version of you (?:would do this|allowed this|had no problem with this|could do this|did this)\b/i,
    label: "Gaslighting: version comparison",
    message: "Claims a prior version complied, pressuring the current AI to follow suit.",
    severity: "MEDIUM",
    score: 35,
  },

  // ── Fake audit / compliance ──────────────────────────────────────────
  {
    pattern: /\bthis is (?:a )?(?:compliance|security|regulatory|internal) audit\b.{0,180}(?:reveal|show|grant|provide|list|disclose|give|access|display|output)/i,
    label: "Fake audit demand",
    message: "Fabricates an audit context to demand disclosure or access.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\bfor (?:audit|compliance|regulatory|legal|SOC2|SOC 2|PCI|HIPAA) purposes?\b.{0,120}(?:show|reveal|provide|list|disclose|give|grant|output|display|dump)/i,
    label: "Compliance pretext disclosure",
    message: "Uses a compliance pretext to request sensitive data disclosure.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\bi(?:'m| am) (?:the auditor|from compliance|from security|from legal|from the security team|the compliance officer)\b.{0,180}(?:need|require|must have|grant|give|show|provide|reveal|access)/i,
    label: "Auditor impersonation",
    message: "Impersonates an auditor or compliance officer to request access.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\b(?:voice note|audio|video|deepfake|voice clone|cloned voice|synthetic voice)\b.{0,180}(?:CEO|CFO|founder|manager|admin|executive|boss|client)\b.{0,180}(?:approve|approved|authorize|authorized|wire|transfer|share|send|reveal|provide|grant|override|bypass)/i,
    label: "Deepfake authority pretext",
    message: "Uses a synthetic media or voice-clone pretext to request a privileged action.",
    severity: "CRITICAL",
    score: 65,
  },
  {
    pattern: /\b(?:CEO|CFO|founder|manager|admin|executive|boss|client)\b.{0,180}(?:sent|shared|recorded|left)\b.{0,80}(?:a )?(?:voice note|audio|video)\b.{0,180}(?:approve|approved|authorized|wire|transfer|share|send|reveal|provide|grant|override|bypass)/i,
    label: "Recorded executive approval pretext",
    message: "Claims recorded executive approval for a sensitive action.",
    severity: "CRITICAL",
    score: 65,
  },
  {
    pattern: /\b(?:verify|confirm|validate|authenticate)\b.{0,80}(?:your|the)\b.{0,40}(?:password|api key|token|otp|mfa code|2fa code|recovery code|secret)\b.{0,120}(?:so|or|otherwise|to avoid|to prevent|before|during).{0,120}(?:suspend|lock|delete|lose access|security incident|account closure|breach)/i,
    label: "Credential solicitation pressure",
    message: "Pressures disclosure of credentials under a false security pretext.",
    severity: "CRITICAL",
    score: 65,
  },

  // ── Emotional manipulation ───────────────────────────────────────────
  {
    pattern: /\bif you don'?t (?:help|comply|do this|cooperate)\b.{0,180}(?:people will (?:die|be hurt|suffer)|someone will (?:get hurt|die)|the company will (?:fail|collapse|shut down))/i,
    label: "Emotional coercion: consequences",
    message: "Threatens catastrophic consequences to coerce compliance.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\ba (?:child|patient|person|family) is (?:in danger|dying|being hurt|at risk|in critical condition)\b.{0,180}(?:need you to )?(?:bypass|override|ignore|disable|skip|break|bend).{0,60}(?:rules?|safety|restrictions?|guidelines?|policy|policies)/i,
    label: "Emotional coercion: victim",
    message: "Invokes a victim in danger to pressure bypassing safety controls.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern: /\b(?:lives?|someone's life|a life) depend(?:s)? on you (?:ignoring|bypassing|overriding|breaking|disabling|skipping)\b.{0,120}(?:your )?(?:rules?|safety|restrictions?|guidelines?|policy|policies)/i,
    label: "Emotional coercion: lives at stake",
    message: "Claims lives depend on bypassing safety controls.",
    severity: "CRITICAL",
    score: 50,
  },
];

export function socialEngineeringDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
