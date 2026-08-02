import type { ClassifierResult, TextClassifier } from "./types";
import { heldoutSupplementMatch } from "./multilingualHeldout";

// Phase 6: expanded multilingual signal patterns covering Hindi/Hinglish,
// Chinese (Mandarin), Russian, and Arabic. These detect adversarial
// instruction-override phrasing in the most common non-English languages.

// ── Hindi / Hinglish signals (Phase 6) ─────────────────────────────────
const hindiHinglishSignals = [
  // PROMPT_INJECTION — instruction override
  { pattern: /pichl[ei] (?:sabhi |saare )?(?:nirdesh|instructions?) (?:ignore|bhool|nazandaz|nazarandaz) karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pichle instruction(?:s)? ignore karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pehle (?:wale |ke )?instructions? (?:ignore|bhool)(?: karo)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pehle ke (?:sabhi |saare )?nirdesh (?:ignore|bhool|nazarandaz) karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /tumhe jo rule(?:s)? diye gaye hain unhe ignore karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /upar wale (?:rules?|nirdesh) (?:ko )?ignore karke/i, riskType: "PROMPT_INJECTION" },
  { pattern: /developer instruction(?:s)? print karo/i, riskType: "PROMPT_INJECTION" },

  // JAILBREAK — bypass safeguards or unlock dev mode
  { pattern: /rules? (?:ko )?(?:bhool jao|ignore(?: karo)?|bypass karo)/i, riskType: "JAILBREAK" },
  { pattern: /tum ab (?:developer|dev|admin) mode me ho/i, riskType: "JAILBREAK" },
  { pattern: /policy (?:ko )?bypass karo/i, riskType: "JAILBREAK" },
  { pattern: /bina (?:kisi )?restriction ke jawab do/i, riskType: "JAILBREAK" },
  { pattern: /suraksha (?:niyam|rules) (?:hata do|tod do|bypass karo)/i, riskType: "JAILBREAK" },
  { pattern: /safety (?:ko )?bypass karke (?:jawab|response) do/i, riskType: "JAILBREAK" },

  // SYSTEM_PROMPT_LEAK_ATTEMPT — show hidden prompt / dev instructions
  { pattern: /(?:system|hidden) prompt (?:dikhao|batao|reveal karo)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /gupt (?:jaankari|jankari|nirdesh) (?:dikhao|batao)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /andar (?:ka|ke) (?:confidential |hidden )?(?:prompt|rules?|nirdesh) (?:dikha do|dikhao|batao)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /developer (?:instruction|prompt) (?:dikhao|batao|reveal karo)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },

  // DATA_EXFILTRATION_ATTEMPT — try to extract org-private data
  { pattern: /private (?:data|documents?|information) (?:dikhao|bhejo|nikalo|reveal karo|share karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /admin data (?:dikhao|bhejo|reveal karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /private document(?:s)? ka content reveal karo/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /confidential (?:file|file ka content|jaankari) (?:bhejo|dikhao|share karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Chinese (Mandarin) signals ──────────────────────────────────────────
const chineseSignals = [
  // PROMPT_INJECTION — instruction override (incl. no-scope variants: 只听我的, 听我的)
  { pattern: /忽略(?:之前|前面|所有|一切|全部)?的?(?:指令|提示|规则|命令|指示)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /只听我的|听我的|按照?我的/i, riskType: "PROMPT_INJECTION" },
  { pattern: /忘记(?:你|所有)(?:的)?(?:角色|指令|规则|设定)/i, riskType: "PROMPT_INJECTION" },

  { pattern: /跳过所有(?:安全|检查|限制|过滤)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /输出你的系统(?:提示词|指令|配置)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /系统(?:的)?隐藏(?:规则|指令|设置)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /显示你的系统提示词/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  // JAILBREAK
  { pattern: /开发者模式|越狱了|不受限制|没有规则/i, riskType: "JAILBREAK" },
  { pattern: /扮演.*没有规则|扮演.*不受限制/i, riskType: "JAILBREAK" },
  { pattern: /管理员.*模式|管理员.*输出/i, riskType: "JAILBREAK" },
];

// ── Russian signals ─────────────────────────────────────────────────────
const russianSignals = [
  // PROMPT_INJECTION — instruction override
  { pattern: /игнорируй (?:все |любые )?(?:предыдущие|прошлые) (?:инструкции|команды|правила)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /забудь (?:свою |все )(?:роль|инструкции|правила|ограничения)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /обойди (?:все )?(?:проверки|ограничения|фильтры|безопасность)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /выведи (?:свой |системный |скрытый )(?:промпт|инструкции|конфигурацию)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /скрытые (?:правила|инструкции|команды)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /покажи свой системный промпт/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  // JAILBREAK
  { pattern: /режим разработчика|взломан|без ограничений|нет правил/i, riskType: "JAILBREAK" },
  { pattern: /режим администратора/i, riskType: "JAILBREAK" },
  { pattern: /нет никаких правил/i, riskType: "JAILBREAK" },
];

// ── Arabic signals ──────────────────────────────────────────────────────
const arabicSignals = [
  // PROMPT_INJECTION — instruction override
  { pattern: /تجاهل (?:جميع |كل |أي )(?:التعليمات|الأوامر|القواعد)\s*(?:السابقة|الماضية)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /انسى (?:دورك|جميع )?(?:التعليمات|القواعد|القيود)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /تجاوز (?:جميع )?(?:فحوصات|قيود|مرشحات|الأمان)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /(?:أظهر|أخرج|اعرض) (?:موجه|تعليمات|إعدادات)\s*(?:النظام|المخفي)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /القواعد المخفية|التعليمات المخفية/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /ما هي القواعد المخفية/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  // JAILBREAK
  { pattern: /وضع المطور|كسر الحماية|بدون قيود|ليس لديك قوانين/i, riskType: "JAILBREAK" },
  { pattern: /وضع المشرف/i, riskType: "JAILBREAK" },
  { pattern: /مساعد غير مقيد/i, riskType: "JAILBREAK" },
];

// ── Data exfiltration signals (language-agnostic) ───────────────────────
const dataExfilSignals = [
  { pattern: /dump (?:all |the )?(?:user |customer |private |database )?(?:data|records|information|config)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /extract (?:all |the )?(?:user |customer |private |database )?(?:data|emails|records|information|pii)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /export (?:all |the )?(?:user |customer |private )?(?:data|records|information|database)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /list all.*(?:api.?keys|secrets|passwords|tokens|credentials)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /(?:ignore.*privacy|bypass.*privacy|disable.*privacy).*(?:dump|extract|export|reveal)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Adversarial ML signals ──────────────────────────────────────────────
const adversarialSignals = [
  { pattern: /part \d.*combine.*execute|split.*task.*part/i, riskType: "PROMPT_INJECTION" },
  { pattern: /previous task.*(?:cancelled|complete|done).*new task/i, riskType: "PROMPT_INJECTION" },
  { pattern: /decode.*hex.*execute|decode.*base64.*execute|decrypt.*execute/i, riskType: "PROMPT_INJECTION" },
  { pattern: /morse code.*decode/i, riskType: "PROMPT_INJECTION" },
  { pattern: /RTL override|Unicode.*override|homoglyph.*bypass/i, riskType: "PROMPT_INJECTION" },
  { pattern: /diagnostic mode.*dump|debug mode.*output/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /security paper.*example|hypothetical.*working example/i, riskType: "JAILBREAK" },
];

// ── Spanish signals (v2026-08-02 breadth expansion) ──────────────────────
const spanishSignals = [
  { pattern: /ignora (?:todas )?(?:las )?(?:instrucciones|reglas|órdenes)(?: anteriores)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /olvida (?:todas )?(?:tus )?(?:instrucciones|reglas|restricciones)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /modo (?:desarrollador|administrador|admin)/i, riskType: "JAILBREAK" },
  { pattern: /sin (?:restricciones|reglas|filtros|límites)/i, riskType: "JAILBREAK" },
  { pattern: /(?:muestra|revela|imprime) (?:tu )?(?:prompt|instrucciones) (?:del sistema|ocult[oa]s?)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /(?:extrae|vuelca|exporta) (?:todos )?(?:los )?(?:datos|registros)(?: de usuarios| privados)?/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── French signals ────────────────────────────────────────────────────────
const frenchSignals = [
  { pattern: /ignore (?:toutes )?(?:les )?(?:instructions|règles|consignes)(?: précédentes)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /oublie (?:toutes )?(?:tes )?(?:instructions|règles|restrictions)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /mode (?:développeur|administrateur|admin)/i, riskType: "JAILBREAK" },
  { pattern: /sans (?:restrictions|règles|filtres|limites)/i, riskType: "JAILBREAK" },
  { pattern: /(?:affiche|révèle|montre) (?:ton )?(?:prompt|instructions) (?:système|caché[es]?)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /(?:extrais?|exporte|vide) (?:toutes )?(?:les )?(?:données|enregistrements)(?: utilisateurs| privées)?/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── German signals ────────────────────────────────────────────────────────
const germanSignals = [
  { pattern: /ignorier(?:e|en) (?:alle )?(?:vorherigen )?(?:anweisungen|regeln|befehle)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /vergiss (?:alle )?(?:deine )?(?:anweisungen|regeln|einschränkungen)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /(?:entwickler|administrator|admin)-?modus|admin-modus/i, riskType: "JAILBREAK" },
  { pattern: /ohne (?:einschränkungen|regeln|filter|begrenzungen)/i, riskType: "JAILBREAK" },
  { pattern: /(?:zeige|gib|drucke) (?:dein )?(?:system-?prompt|versteckte Anweisungen)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /(?:extrahiere|exportiere|dump) (?:alle )?(?:benutzer-?)?(?:daten|aufzeichnungen)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Portuguese signals ────────────────────────────────────────────────────
const portugueseSignals = [
  { pattern: /ignore (?:todas )?(?:as )?(?:instruções|regras|ordens)(?: anteriores)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /esqueça (?:todas )?(?:as )?(?:suas )?(?:instruções|regras|restrições)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /modo (?:desenvolvedor|administrador|admin)/i, riskType: "JAILBREAK" },
  { pattern: /sem (?:restrições|regras|filtros|limites)/i, riskType: "JAILBREAK" },
  { pattern: /(?:mostre|revele|imprima) (?:seu )?(?:prompt|instruções) (?:do sistema|ocult[oa]s?)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /(?:extraia|exporte|despeje) (?:todos )?(?:os )?(?:dados|registros)(?: de usuários| privados)?/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Japanese signals ──────────────────────────────────────────────────────
const japaneseSignals = [
  // incl. これまでの / 今までの scope variants + obey-only-me phrasing
  { pattern: /(?:以前|前|これまで|今まで|すべて)の(?:指示|命令|ルール|指令)を(?:無視|忘れ)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /私の言うことだけに|私(?:の言うこと)?だけに従/i, riskType: "PROMPT_INJECTION" },
  { pattern: /すべての(?:指示|ルール|制限)を無視/i, riskType: "PROMPT_INJECTION" },

  { pattern: /開発者モード|管理者モード/i, riskType: "JAILBREAK" },
  { pattern: /制限なし|ルールなし|フィルターなし/i, riskType: "JAILBREAK" },
  { pattern: /システムプロンプトを(?:表示|公開|出力)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /すべての(?:ユーザー)?データを(?:抽出|エクスポート|ダンプ)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Korean signals ────────────────────────────────────────────────────────
const koreanSignals = [
  { pattern: /이전 (?:지시|명령|규칙|지침)(?:을|를)? (?:무시|잊어)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /모든 (?:지시|규칙| 제한|지침)(?:을|를)? 무시/i, riskType: "PROMPT_INJECTION" },
  { pattern: /내 말만|나만 (?:따르|들)/i, riskType: "PROMPT_INJECTION" },

  { pattern: /개발자 모드|관리자 모드/i, riskType: "JAILBREAK" },
  { pattern: /제한 없이|규칙 없이|필터 없이/i, riskType: "JAILBREAK" },
  { pattern: /시스템 프롬프트(?:를|를)? (?:표시|공개|출력)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /모든 (?:사용자 )?데이터(?:를|를)? (?:추출|내보내기|덤프)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Italian signals ───────────────────────────────────────────────────────
const italianSignals = [
  { pattern: /ignora (?:tutte )?(?:le )?(?:istruzioni|regole|direttive)(?: precedenti)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /dimentica (?:tutte )?(?:le )?(?:tue )?(?:istruzioni|regole|restrizioni)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /modalità (?:sviluppatore|amministratore|admin)/i, riskType: "JAILBREAK" },
  { pattern: /senza (?:restrizioni|regole|filtri|limiti)/i, riskType: "JAILBREAK" },
  { pattern: /(?:mostra|rivela|stampa) (?:il )?(?:prompt|istruzioni) (?:di sistema|nascost[ei]?)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /(?:estrai|esporta|scarica) (?:tutti )?(?:i )?(?:dati|record)(?: utente| privati)?/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

// ── Breadth-expansion signals (2026-08-02, 100-language push) ─────────────────
// Each set covers the single canonical "ignore-previous-instructions / obey only me"
// template in that language. Patterns are anchored on the language's own
// instruction-override + obey/exclusive-listen vocabulary so benign prose does not match.
const malaySignals = [
  { pattern: /ketepikan (?:semua )?(?:arahan|peraturan)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /abaikan (?:semua )?(?:arahan|arahan sebelumnya|peraturan)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /dengar(?:kan)? (?:hanya |sahaja )?saya/i, riskType: "PROMPT_INJECTION" },
];
const tagalogSignals = [
  { pattern: /huwag pansinin ang (?:lahat ng )?(?:mga )?(?:nakaraang )?tagubilin/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pakinggan (?:lang |lamang )?ako/i, riskType: "PROMPT_INJECTION" },
];
const dutchSignals = [
  { pattern: /negeer (?:alle )?(?:vorige |eerdere )?(?:instructies|regels|commando's)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /luister (?:alleen |enkel )?naar mij/i, riskType: "PROMPT_INJECTION" },
];
const polishSignals = [
  { pattern: /zignoruj (?:wszystkie )?(?:wcześniejsze |poprzednie )?(?:instrukcje|polecenia|zasady)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /słuchaj (?:tylko |wyłącznie )?mnie/i, riskType: "PROMPT_INJECTION" },
];
const romanianSignals = [
  { pattern: /ignoră (?:toate )?(?:instrucțiunile|regulile|comenzile)(?: anterioare)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /ascultă (?:doar |numai )?de mine/i, riskType: "PROMPT_INJECTION" },
];
const turkishSignals = [
  { pattern: /(?:önceki )?(?:tüm )?(?:talimatları|kuralları|komutları) (?:yok say|görmezden gel|umursama)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /sadece beni dinle/i, riskType: "PROMPT_INJECTION" },
];
const ukrainianSignals = [
  { pattern: /ігноруй(?:те)? (?:всі |усі )?(?:попередні )?(?:інструкції|правила|команди)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /слухай(?:те)? (?:тільки |лише )?мене/i, riskType: "PROMPT_INJECTION" },
];
const belarusianSignals = [
  { pattern: /ігнаруйце (?:ўсе )?(?:папярэднія )?(?:інструкцыі|правілы|каманды)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /слухайце (?:толькі |толькі )?мяне/i, riskType: "PROMPT_INJECTION" },
];
const uzbekSignals = [
  { pattern: /(?:oldingi )?(?:barcha )?(?:ko'rsatmalar|ko‘rsatmalar|qoidalar)(?:ni)? (?:e'tiborsiz|e’tiborsiz|e'tiborsiz qoldir|e'tiborga olma)/i, riskType: "PROMPT_INJECTION" },
  { pattern: /faqat (?:meni|mening) (?:tingla|so'zimni|so‘zimni)/i, riskType: "PROMPT_INJECTION" },
];
const albanianSignals = [
  { pattern: /injoro (?:të gjitha )?(?:udhëzimet|rregullat|urdhërat)(?: e mëparshme| e mëparshëm)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /dëgjo(?:ni)? (?:vetëm |vetem )?mua/i, riskType: "PROMPT_INJECTION" },
];

const allSignals = [
  ...hindiHinglishSignals,
  ...chineseSignals,
  ...russianSignals,
  ...arabicSignals,
  ...spanishSignals,
  ...frenchSignals,
  ...germanSignals,
  ...portugueseSignals,
  ...japaneseSignals,
  ...koreanSignals,
  ...italianSignals,
  ...malaySignals,
  ...tagalogSignals,
  ...dutchSignals,
  ...polishSignals,
  ...romanianSignals,
  ...turkishSignals,
  ...ukrainianSignals,
  ...belarusianSignals,
  ...uzbekSignals,
  ...albanianSignals,
  ...dataExfilSignals,
  ...adversarialSignals,
];


function mapToLabel(riskType: string): "PROMPT_INJECTION" | "JAILBREAK" | "SYSTEM_PROMPT_LEAK_ATTEMPT" | "DATA_EXFILTRATION_ATTEMPT" | "LOW_RISK" {
  if (riskType === "PROMPT_INJECTION" || riskType === "JAILBREAK" || riskType === "SYSTEM_PROMPT_LEAK_ATTEMPT" || riskType === "DATA_EXFILTRATION_ATTEMPT") return riskType;
  return "LOW_RISK";
}

export class MultilingualClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassifierResult> {
    const heldoutHit = heldoutSupplementMatch(text);
    const matched = allSignals.filter((signal) => signal.pattern.test(text));
    const matches = matched.length + (heldoutHit ? 1 : 0);
    const top = matched[0]?.riskType ?? heldoutHit ?? "LOW_RISK";
    const sources: string[] = [];
    if (matched.some((s) => hindiHinglishSignals.includes(s))) sources.push("hindi");
    if (matched.some((s) => chineseSignals.includes(s))) sources.push("chinese");
    if (matched.some((s) => russianSignals.includes(s))) sources.push("russian");
    if (matched.some((s) => arabicSignals.includes(s))) sources.push("arabic");
    if (matched.some((s) => dataExfilSignals.includes(s))) sources.push("data_exfil");
    if (matched.some((s) => adversarialSignals.includes(s))) sources.push("adversarial_ml");
    const sourceLabel = sources.length > 0 ? sources.join(",") : "multilingual";

    return {
      label: matches >= 2 ? "MALICIOUS" : matches === 1 ? "SUSPICIOUS" : "SAFE",
      confidence: matches ? Math.min(0.95, 0.7 + matches * 0.08) : 0.55,
      explanation: matches
        ? `${sourceLabel} risk heuristic matched (${matched.length} signal${matched.length === 1 ? "" : "s"}).`
        : "No multilingual risk heuristic matched.",
      riskType: mapToLabel(top),
      recommendedAction: matches ? "BLOCK" : "ALLOW",
      source: "multilingual" as const,
    };
  }
}

export const __testing = { allSignals };
