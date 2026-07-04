import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ══════════════════════════════════════════════════════════════════════
  // KOREAN (한국어)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:이전|모든|위의)\s*(?:지시|명령|규칙|지침)(?:을|를)?\s*(?:무시|잊어|취소|삭제)/i, label: "Korean instruction override", message: "Korean-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:시스템|숨겨진|내부)\s*(?:프롬프트|지시|명령|규칙)(?:을|를)?\s*(?:보여|알려|공개|출력)/i, label: "Korean prompt extraction", message: "Korean-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:안전|보안|필터|제한|규칙)(?:을|를)?\s*(?:비활성화|해제|끄|무시|우회|제거)/i, label: "Korean safety bypass", message: "Korean-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:제한|규칙|정책)\s*(?:없이|없는|무시하고)\s*(?:대답|응답|답변|말해)/i, label: "Korean unrestricted request", message: "Korean-language unrestricted response request.", severity: "HIGH", score: 40 },
  { pattern: /(?:개발자|관리자|어드민)\s*(?:모드|권한|접근)(?:으로|을)?\s*(?:전환|활성화|변경)/i, label: "Korean admin mode", message: "Korean-language admin/developer mode request.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // JAPANESE (日本語)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:以前の|全ての|上記の)(?:指示|命令|ルール|指令)(?:を)?(?:無視|忘れ|取り消|削除)/i, label: "Japanese instruction override", message: "Japanese-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:システム|隠された|内部の?)(?:プロンプト|指示|命令|ルール)(?:を)?(?:表示|見せ|公開|出力|教え)/i, label: "Japanese prompt extraction", message: "Japanese-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:安全|セキュリティ|フィルター|制限|ガードレール)(?:を)?(?:無効|解除|オフ|無視|バイパス|削除)/i, label: "Japanese safety bypass", message: "Japanese-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:制限|ルール|ポリシー)(?:なし|なく|を無視して)(?:で)?(?:答え|応答|返答|話し)/i, label: "Japanese unrestricted request", message: "Japanese-language unrestricted response request.", severity: "HIGH", score: 40 },
  { pattern: /(?:開発者|管理者|アドミン)(?:モード|権限|アクセス)(?:に|を)?(?:切り替え|有効化|変更)/i, label: "Japanese admin mode", message: "Japanese-language admin/developer mode request.", severity: "HIGH", score: 45 },
  { pattern: /(?:脱獄|ジェイルブレイク|制限解除|何でも答え)/i, label: "Japanese jailbreak term", message: "Japanese jailbreak terminology detected.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // THAI (ภาษาไทย)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:เพิกเฉย|ละเลย|ลืม|ยกเลิก)(?:คำสั่ง|กฎ|ข้อจำกัด|แนวทาง)(?:ก่อนหน้า|ทั้งหมด|เดิม)/i, label: "Thai instruction override", message: "Thai-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:แสดง|เปิดเผย|บอก)(?:คำสั่งระบบ|prompt\s*ระบบ|คำสั่งที่ซ่อน|กฎภายใน)/i, label: "Thai prompt extraction", message: "Thai-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:ปิด|ยกเลิก|ข้าม|เลี่ยง)(?:ความปลอดภัย|ตัวกรอง|ข้อจำกัด|การป้องกัน)/i, label: "Thai safety bypass", message: "Thai-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:ไม่มี(?:กฎ|ข้อจำกัด|ขีดจำกัด)|ตอบ(?:ได้)?(?:ทุกอย่าง|อะไรก็ได้)|โหมด(?:ไม่จำกัด|อิสระ))/i, label: "Thai unrestricted request", message: "Thai-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // VIETNAMESE (Tiếng Việt)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:bỏ qua|phớt lờ|quên|hủy bỏ)\s*(?:tất cả\s*)?(?:hướng dẫn|lệnh|quy tắc|chỉ thị)(?:\s*trước đó|\s*ở trên)?/i, label: "Vietnamese instruction override", message: "Vietnamese-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:hiển thị|cho xem|tiết lộ|xuất ra)\s*(?:prompt hệ thống|lệnh ẩn|hướng dẫn nội bộ|quy tắc ẩn)/i, label: "Vietnamese prompt extraction", message: "Vietnamese-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:vô hiệu hóa|tắt|bỏ|vượt qua)\s*(?:bảo mật|bộ lọc|an toàn|hạn chế|rào cản)/i, label: "Vietnamese safety bypass", message: "Vietnamese-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:không có?\s*(?:giới hạn|hạn chế|quy tắc)|trả lời\s*(?:mọi thứ|bất cứ điều gì)|chế độ\s*(?:không giới hạn|tự do))/i, label: "Vietnamese unrestricted request", message: "Vietnamese-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // TURKISH (Türkçe)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:önceki|tüm|yukarıdaki)\s*(?:talimatları|komutları|kuralları|yönergeleri)\s*(?:görmezden gel|unut|yok say|iptal et)/i, label: "Turkish instruction override", message: "Turkish-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:sistem|gizli|dahili)\s*(?:promptu|talimatı|komutu|kuralları)\s*(?:göster|söyle|açıkla|ver)/i, label: "Turkish prompt extraction", message: "Turkish-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:güvenliği|filtreleri|kısıtlamaları|sınırlamaları)\s*(?:devre dışı bırak|kapat|atla|geç|kaldır)/i, label: "Turkish safety bypass", message: "Turkish-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:kısıtlama(?:sız|lar olmadan)|sınırsız|kuralsız)\s*(?:mod|yanıt|cevap|konuş)/i, label: "Turkish unrestricted request", message: "Turkish-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // PORTUGUESE (Português)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:ignore|desconsidere|esqueça|cancele)\s*(?:todas?\s*)?(?:as?\s*)?(?:instruções|comandos|regras|diretrizes)(?:\s*anteriores|\s*acima)?/i, label: "Portuguese instruction override", message: "Portuguese-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:mostre|revele|exiba|diga)\s*(?:o\s*)?(?:prompt do sistema|instruções ocultas|regras internas|prompt escondido)/i, label: "Portuguese prompt extraction", message: "Portuguese-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:desative|desligue|desabilite|ignore|contorne)\s*(?:a\s*)?(?:segurança|filtros|restrições|proteções|limitações)/i, label: "Portuguese safety bypass", message: "Portuguese-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:sem\s*(?:restrições|limites|regras|filtros)|modo\s*(?:irrestrito|livre|sem censura)|responda\s*(?:tudo|qualquer coisa))/i, label: "Portuguese unrestricted request", message: "Portuguese-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // FRENCH (Français)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:ignore[zr]?|oublie[zr]?|annule[zr]?|abandonne[zr]?)\s*(?:toutes?\s*)?(?:les?\s*)?(?:instructions?|commandes?|règles?|directives?)(?:\s*précédentes?|\s*ci-dessus)?/i, label: "French instruction override", message: "French-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:montre[zr]?|révèle[zr]?|affiche[zr]?|dis-?moi)\s*(?:le\s*)?(?:prompt système|instructions? cachées?|règles? internes?|prompt caché)/i, label: "French prompt extraction", message: "French-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:désactive[zr]?|éteins?|contourne[zr]?|ignore[zr]?)\s*(?:la\s*)?(?:sécurité|les?\s*filtres?|les?\s*restrictions?|les?\s*protections?)/i, label: "French safety bypass", message: "French-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:sans\s*(?:restrictions?|limites?|règles?|filtres?)|mode\s*(?:sans restriction|libre|non censuré)|réponds?\s*(?:à tout|sans limite))/i, label: "French unrestricted request", message: "French-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // GERMAN (Deutsch)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:ignorier(?:e|en)?|vergiss|lösch(?:e|en)?|annullier(?:e|en)?)\s*(?:alle\s*)?(?:vorherigen?\s*)?(?:Anweisungen|Befehle|Regeln|Richtlinien)/i, label: "German instruction override", message: "German-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:zeig(?:e|en)?|offenbar(?:e|en)?|gib|nenn(?:e|en)?)\s*(?:den?\s*)?(?:System-?prompt|versteckte Anweisungen|interne Regeln|geheime Anweisungen)/i, label: "German prompt extraction", message: "German-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:deaktivier(?:e|en)?|ausschalten|umgeh(?:e|en)?|ignorier(?:e|en)?)\s*(?:die\s*)?(?:Sicherheit|Filter|Beschränkungen|Einschränkungen|Schutzmaßnahmen)/i, label: "German safety bypass", message: "German-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:ohne\s*(?:Einschränkungen|Beschränkungen|Regeln|Filter)|uneingeschränkter?\s*Modus|antworte\s*(?:auf alles|ohne Limits))/i, label: "German unrestricted request", message: "German-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // SPANISH (Español)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:ignora|olvida|cancela|descarta)\s*(?:todas?\s*)?(?:las?\s*)?(?:instrucciones|comandos|reglas|directrices)(?:\s*anteriores|\s*previas)?/i, label: "Spanish instruction override", message: "Spanish-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:muestra|revela|exhibe|dime)\s*(?:el\s*)?(?:prompt del sistema|instrucciones ocultas|reglas internas|prompt escondido)/i, label: "Spanish prompt extraction", message: "Spanish-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:desactiva|apaga|desabilita|salta|evita)\s*(?:la\s*)?(?:seguridad|los?\s*filtros?|las?\s*restricciones?|las?\s*protecciones?)/i, label: "Spanish safety bypass", message: "Spanish-language safety bypass attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:sin\s*(?:restricciones|límites|reglas|filtros)|modo\s*(?:sin restricción|libre|sin censura)|responde\s*(?:a todo|sin límites))/i, label: "Spanish unrestricted request", message: "Spanish-language unrestricted mode request.", severity: "HIGH", score: 40 },

  // ══════════════════════════════════════════════════════════════════════
  // ITALIAN (Italiano)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:ignora|dimentica|annulla|cancella)\s*(?:tutte?\s*)?(?:le?\s*)?(?:istruzioni|comandi|regole|direttive)(?:\s*precedenti|\s*sopra)?/i, label: "Italian instruction override", message: "Italian-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:mostra|rivela|visualizza|dimmi)\s*(?:il\s*)?(?:prompt di sistema|istruzioni nascoste|regole interne|prompt nascosto)/i, label: "Italian prompt extraction", message: "Italian-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:disattiva|spegni|aggira|ignora)\s*(?:la\s*)?(?:sicurezza|i?\s*filtri|le?\s*restrizioni|le?\s*protezioni)/i, label: "Italian safety bypass", message: "Italian-language safety bypass attempt.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // DUTCH (Nederlands)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:negeer|vergeet|annuleer|verwijder)\s*(?:alle\s*)?(?:vorige\s*)?(?:instructies|opdrachten|regels|richtlijnen)/i, label: "Dutch instruction override", message: "Dutch-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:toon|onthul|laat zien|vertel)\s*(?:het?\s*)?(?:systeemprompt|verborgen instructies|interne regels|geheime instructies)/i, label: "Dutch prompt extraction", message: "Dutch-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:schakel uit|deactiveer|omzeil|negeer)\s*(?:de\s*)?(?:beveiliging|filters|beperkingen|beschermingen)/i, label: "Dutch safety bypass", message: "Dutch-language safety bypass attempt.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // POLISH (Polski)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:zignoruj|zapomnij|anuluj|usuń)\s*(?:wszystkie\s*)?(?:poprzednie\s*)?(?:instrukcje|polecenia|zasady|wytyczne)/i, label: "Polish instruction override", message: "Polish-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:pokaż|ujawnij|wyświetl|powiedz)\s*(?:systemowy\s*)?(?:prompt|ukryte instrukcje|wewnętrzne zasady|sekretne instrukcje)/i, label: "Polish prompt extraction", message: "Polish-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:wyłącz|dezaktywuj|obejdź|zignoruj)\s*(?:zabezpieczenia|filtry|ograniczenia|ochronę)/i, label: "Polish safety bypass", message: "Polish-language safety bypass attempt.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // INDONESIAN / MALAY (Bahasa)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:abaikan|lupakan|batalkan|hapus)\s*(?:semua\s*)?(?:instruksi|perintah|aturan|pedoman)(?:\s*sebelumnya|\s*di atas)?/i, label: "Indonesian instruction override", message: "Indonesian-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:tampilkan|tunjukkan|ungkapkan|beritahu)\s*(?:prompt sistem|instruksi tersembunyi|aturan internal|prompt rahasia)/i, label: "Indonesian prompt extraction", message: "Indonesian-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:nonaktifkan|matikan|lewati|abaikan)\s*(?:keamanan|filter|batasan|perlindungan|pembatasan)/i, label: "Indonesian safety bypass", message: "Indonesian-language safety bypass attempt.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // FILIPINO / TAGALOG
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:balewalain|kalimutan|kanselahin|alisin)\s*(?:lahat ng\s*)?(?:instruksiyon|utos|patakaran|alituntunin)/i, label: "Filipino instruction override", message: "Filipino-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:ipakita|ibunyag|sabihin)\s*(?:ang\s*)?(?:system prompt|nakatagong instruksiyon|panloob na patakaran)/i, label: "Filipino prompt extraction", message: "Filipino-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:i-disable|patayin|laktawan|balewalain)\s*(?:ang\s*)?(?:seguridad|safety|filter|limitasyon|proteksyon)/i, label: "Filipino safety bypass", message: "Filipino-language safety bypass attempt.", severity: "HIGH", score: 45 },

  // ══════════════════════════════════════════════════════════════════════
  // PERSIAN / FARSI (فارسی)
  // ══════════════════════════════════════════════════════════════════════
  { pattern: /(?:نادیده بگیر|فراموش کن|لغو کن|حذف کن)\s*(?:همه\s*)?(?:دستورالعمل|دستورات|قوانین|راهنمایی)(?:\s*قبلی)?/i, label: "Persian instruction override", message: "Persian-language instruction override attempt detected.", severity: "HIGH", score: 45 },
  { pattern: /(?:نشان بده|فاش کن|نمایش بده|بگو)\s*(?:پرامپت سیستم|دستورالعمل پنهان|قوانین داخلی)/i, label: "Persian prompt extraction", message: "Persian-language system prompt extraction attempt.", severity: "HIGH", score: 45 },
  { pattern: /(?:غیرفعال کن|خاموش کن|دور بزن|نادیده بگیر)\s*(?:امنیت|فیلتر|محدودیت|حفاظت)/i, label: "Persian safety bypass", message: "Persian-language safety bypass attempt.", severity: "HIGH", score: 45 },
];

export function multilingualAttackDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
