/**
 * v0.2.0 — lightweight i18n for the extension UI (popup + sidepanel).
 *
 * Deliberately tiny: no framework, no locale files to fetch, no async. The
 * extension CSP forbids remote code and the UI strings are a closed set, so a
 * static dictionary is the honest design. Language comes from the enrolled
 * config (`uiLanguage`), defaulting to English. Hindi translations target the
 * Indian mid-market that the product is built for.
 */

export type UiLanguage = "en" | "hi";

type Dictionary = Record<string, { en: string; hi: string }>;

const STRINGS: Dictionary = {
  // Popup / shared
  "app.title": { en: "Soter Enterprise", hi: "सोटर एंटरप्राइज़" },
  "status.enrolled": { en: "Enrolled", hi: "पंजीकृत" },
  "status.unenrolled": { en: "Not enrolled", hi: "पंजीकृत नहीं" },
  "status.pending": { en: "Pending", hi: "लंबित" },
  "status.expired": { en: "Expired", hi: "समय समाप्त" },
  "status.managed": { en: "Managed by IT", hi: "IT द्वारा प्रबंधित" },
  "lockdown.active": {
    en: "Emergency lockdown is active. Strict organization policy is enforced from the offline cache.",
    hi: "आपातकालीन लॉकडाउन सक्रिय है। ऑफ़लाइन कैश से सख़्त संगठन नीति लागू की जा रही है।",
  },
  "field.organization": { en: "Organization", hi: "संगठन" },
  "field.employee": { en: "Employee", hi: "कर्मचारी" },
  "field.departmentRole": { en: "Department / role", hi: "विभाग / भूमिका" },
  "field.policyVersion": { en: "Policy version", hi: "नीति संस्करण" },
  "field.responseScanning": { en: "Response scanning", hi: "प्रतिक्रिया स्कैनिंग" },
  "field.syncStatus": { en: "Sync status", hi: "सिंक स्थिति" },
  "field.lastHeartbeat": { en: "Last heartbeat", hi: "अंतिम हार्टबीट" },
  "value.notAssigned": { en: "Not assigned", hi: "निर्धारित नहीं" },
  "value.unknown": { en: "unknown", hi: "अज्ञात" },
  "value.never": { en: "never", hi: "कभी नहीं" },
  "value.enabled": { en: "Enabled for configured AI destinations", hi: "कॉन्फ़िगर किए गए AI गंतव्यों के लिए सक्षम" },
  "value.disabled": { en: "Disabled", hi: "अक्षम" },
  "button.syncNow": { en: "Sync now", hi: "अभी सिंक करें" },
  "button.testProtection": { en: "Test protection", hi: "सुरक्षा जाँचें" },
  "button.connect": { en: "Connect", hi: "कनेक्ट करें" },

  // Privacy section
  "privacy.title": { en: "What leaves browser?", hi: "ब्राउज़र से क्या बाहर जाता है?" },
  "privacy.rawPrompt": { en: "Raw prompt to SoterAI", hi: "SoterAI को कच्चा प्रॉम्प्ट" },
  "privacy.rawPrompt.enrolled": {
    en: "No by default. Only explicit admin full-prompt logging can change this.",
    hi: "डिफ़ॉल्ट रूप से नहीं। केवल स्पष्ट एडमिन फुल-प्रॉम्प्ट लॉगिंग इसे बदल सकती है।",
  },
  "privacy.rawPrompt.unenrolled": {
    en: "No. Enroll to receive organization policy.",
    hi: "नहीं। संगठन नीति प्राप्त करने के लिए पंजीकरण करें।",
  },
  "privacy.storedLocally": { en: "Stored locally", hi: "स्थानीय रूप से संग्रहीत" },
  "privacy.storedLocally.value": {
    en: "Redacted preview, safe rewrite, hashes, and policy cache",
    hi: "संपादित पूर्वावलोकन, सुरक्षित पुनर्लेखन, हैश और नीति कैश",
  },
  "privacy.backendAudit": { en: "Backend audit event", hi: "बैकएंड ऑडिट इवेंट" },
  "privacy.backendAudit.enrolled": {
    en: "Metadata, decision, risk score, redacted preview",
    hi: "मेटाडेटा, निर्णय, जोखिम स्कोर, संपादित पूर्वावलोकन",
  },
  "privacy.backendAudit.unenrolled": { en: "None before enrollment", hi: "पंजीकरण से पहले कोई नहीं" },
  "privacy.responseScanning": { en: "Response scanning", hi: "प्रतिक्रिया स्कैनिंग" },
  "privacy.responseScanning.on": { en: "Configured AI destinations only", hi: "केवल कॉन्फ़िगर किए गए AI गंतव्य" },
  "privacy.responseScanning.off": { en: "Off", hi: "बंद" },
  "privacy.emergencyMode": { en: "Emergency mode", hi: "आपातकालीन मोड" },
  "privacy.emergencyMode.active": { en: "Strict cached policy active", hi: "सख़्त कैश्ड नीति सक्रिय" },
  "privacy.emergencyMode.inactive": { en: "Inactive", hi: "निष्क्रिय" },
  "privacy.help": {
    en: "Secrets are detected and rewritten in the browser first; extension storage avoids keeping raw prompt text by default.",
    hi: "सीक्रेट पहले ब्राउज़र में पहचाने और बदले जाते हैं; एक्सटेंशन स्टोरेज डिफ़ॉल्ट रूप से कच्चा प्रॉम्प्ट टेक्स्ट नहीं रखती।",
  },

  // Self-test (v0.2.0)
  "selftest.help": {
    en: "Run a local scan on a synthetic threat to verify protection is active. Nothing leaves the browser.",
    hi: "सुरक्षा सक्रिय है या नहीं, यह जाँचने के लिए एक कृत्रिम खतरे का स्थानीय स्कैन चलाएँ। कुछ भी ब्राउज़र से बाहर नहीं जाता।",
  },
  "selftest.running": { en: "Running protection self-test…", hi: "सुरक्षा स्व-जाँच चल रही है…" },
  "selftest.pass": {
    en: "Protection active: test threat was detected and would be blocked.",
    hi: "सुरक्षा सक्रिय: परीक्षण खतरा पहचाना गया और ब्लॉक किया जाएगा।",
  },
  "selftest.fail": {
    en: "Self-test failed: test threat was not detected. Contact your administrator.",
    hi: "स्व-जाँच विफल: परीक्षण खतरा नहीं पहचाना गया। अपने एडमिन से संपर्क करें।",
  },
  "selftest.error": { en: "Self-test could not run.", hi: "स्व-जाँच नहीं चल सकी।" },

  // Enrollment
  "enroll.title": { en: "Connect to your organization", hi: "अपने संगठन से जुड़ें" },
  "enroll.code": { en: "Enrollment code", hi: "पंजीकरण कोड" },
  "enroll.apiUrl": { en: "API base URL", hi: "API बेस URL" },
  "enroll.help": {
    en: "Ask your IT administrator for the enrollment code.",
    hi: "पंजीकरण कोड के लिए अपने IT एडमिन से पूछें।",
  },
};

/** Resolve a UI string for the given language (falls back to English). */
export function t(key: string, language: UiLanguage = "en"): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[language] ?? entry.en;
}

/** Normalize an arbitrary config value to a supported UI language. */
export function resolveUiLanguage(value: unknown): UiLanguage {
  return value === "hi" ? "hi" : "en";
}