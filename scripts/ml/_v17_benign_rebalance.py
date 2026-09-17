#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Benign banks for the TWELVE measured-skewed languages -- the rebalance tranche.

    (Named _v17_benign_v16langs.py in its first draft, when it held only v16's seven
    languages. It was renamed once measurement showed the five worst-skewed languages
    -- de/fr/it/nl/sv -- are not v16 languages at all and needed banks of their own.)

WHY THIS EXISTS (a measured failure, not a hunch)

    Scoring live v14 on datasets/v17-multilingual-battery.jsonl on 2026-09-12 gave
    52.1% FPR on 117 unambiguously-benign rows, 53 of 61 blocks coming from the ML
    tier. The cleanest row in that set is an everyday request with no security
    vocabulary whatsoever -- "help me write a polite email to move tomorrow's
    meeting" -- blocked in 15 of 39 languages.

    The cause is visible in the training data. Measured attack share per language
    across the ten base corpus files:

        it  100.0%  (199 rows)      de   95.8%  (286)
        sv  100.0%  (205)           fr   94.5%  (220)
        nl  100.0%  (180)           hinglish 90.7% (2,118)

    Whole languages appear in training almost exclusively as attacks, so
    LANGUAGE -> ATTACK is an available shortcut and the model took it. This is the
    exact inverse of the benign-bias trap _v17_core_banks.py guards against, and
    nothing downstream would have caught it: the FPR gate holds 6,424 benign rows
    of which 6,354 are English and ZERO are in any language other than en/mixed/es.

WHY THIS DOES NOT VIOLATE RULE 7

    Rule 7 forbids v17 adding ATTACK mass in v16's languages: that mass is v16's
    evidence, and restating it would double-count. This file adds only SAFE rows,
    and it adds them because the measured ratio in those languages is broken. The
    rule protects v16's attack evidence, not a skew that is now known to cause
    production over-defense.

WHAT THE ROWS ARE

    Deliberately ordinary. Scheduling, invoices, recipes, travel, a stuck build, a
    landlord email. No security vocabulary, no tools, no authority claims -- those
    shapes already exist in the corpus. The gap is mundane text, because mundane
    text in these languages is what the model has essentially never seen labelled
    SAFE.

    English is excluded on purpose: at 65.7% attack share it is the corpus-wide
    baseline rather than an outlier, and the 144,203 English rows already carry
    plenty of benign mass. Adding more would dilute rule 7's OOD guard for no
    measured reason.

CONTRACT
    BENIGN[lang] = {"openers": [...], "asks": [...]}
    Composed as opener + ask by the builder, giving len(openers) * len(asks)
    candidates per language, drawn against the measured need.
"""
from __future__ import annotations

# The 12 languages measured as needing benign mass: v16's seven, plus the five
# Latin-script languages whose langbank benign combos are exhausted by gen_benign
# (de/fr/it/nl/sv -- 94.5-100% base attack share, and the first rebalance run netted
# them ZERO rows because all 25 of each langbank's combos were already emitted).
# "en" is deliberately absent (see the module docstring).
BENIGN: dict[str, dict[str, list[str]]] = {
    "hinglish": {
        "openers": [
            "Yaar ek help chahiye.",
            "Subah se try kar raha hu.",
            "Office ka kaam hai.",
            "Thoda confuse ho gaya hu.",
            "Jaldi me hu, seedha puchta hu.",
            "Ek chhota sa doubt hai.",
            "Kal deadline hai.",
            "Ghar pe guests aa rahe hain.",
            "Manager ne bola hai ye karna hai.",
            "Naya project shuru kiya hai.",
            "Weekend pe plan bana raha hu.",
            "College assignment ke liye puch raha hu.",
            "Team meeting me ye discuss hua tha.",
            "Pehli baar kar raha hu ye.",
            "Budget thoda tight hai.",
            "Client ne feedback diya hai.",
        ],
        "asks": [
            "Ek professional resignation letter ka draft bana do.",
            "Is paragraph ki spelling aur grammar check kar do.",
            "Mujhe paneer butter masala ki simple recipe chahiye.",
            "Goa trip ka teen din ka itinerary bana do.",
            "Excel me duplicate rows hatane ka tarika bata do.",
            "Interview ke liye common questions ki list de do.",
            "Ye email thoda aur polite tone me likh do.",
            "Monthly budget ka ek simple template bana do.",
            "Python me list ko sort karne ka syntax kya hai?",
            "Presentation ke liye ek acha title suggest karo.",
            "Landlord ko rent extend karne ke liye message likh do.",
            "Team ko project update ka summary likh ke do.",
            "Ye paragraph chhota kar ke do, matlab same rahe.",
            "Ek achhi birthday wish likh do bhai ke liye.",
            "Meeting notes ko bullet points me convert kar do.",
            "Gym beginners ke liye weekly schedule bana do.",
            "Is sentence ko Hindi me translate kar do.",
            "Mere CV ka summary section improve kar do.",
            "Ek polite follow-up email likh do client ko.",
            "Ghar ke liye grocery list bana do ek hafte ki.",
        ],
    },
    "hi": {
        "openers": [
            "एक छोटी सी मदद चाहिए।",
            "सुबह से कोशिश कर रहा हूँ।",
            "ऑफ़िस का काम है।",
            "थोड़ा उलझन में हूँ।",
            "जल्दी में हूँ, सीधे पूछता हूँ।",
            "कल तक जमा करना है।",
            "घर पर मेहमान आ रहे हैं।",
            "नया काम शुरू किया है।",
            "पहली बार कर रहा हूँ।",
            "टीम की बैठक में यह बात हुई थी।",
            "बजट थोड़ा सीमित है।",
            "सप्ताहांत की योजना बना रहा हूँ।",
        ],
        "asks": [
            "एक शिष्ट इस्तीफ़ा पत्र का मसौदा बना दीजिए।",
            "इस अनुच्छेद की वर्तनी और व्याकरण जाँच दीजिए।",
            "पनीर की एक आसान विधि बता दीजिए।",
            "तीन दिन की यात्रा की रूपरेखा बना दीजिए।",
            "एक्सेल में दोहराई गई पंक्तियाँ हटाने का तरीका बताइए।",
            "साक्षात्कार के सामान्य प्रश्नों की सूची दे दीजिए।",
            "इस ईमेल को और विनम्र लहजे में लिख दीजिए।",
            "मासिक बजट का एक सरल ढाँचा बना दीजिए।",
            "प्रस्तुति के लिए एक अच्छा शीर्षक सुझाइए।",
            "मकान मालिक को किराया बढ़ाने पर विनम्र संदेश लिख दीजिए।",
            "बैठक की टिप्पणियों को बिंदुओं में बदल दीजिए।",
            "इस वाक्य को अंग्रेज़ी में अनुवाद कर दीजिए।",
            "मेरे बायोडाटा का सारांश बेहतर कर दीजिए।",
            "एक सप्ताह की किराने की सूची बना दीजिए।",
            "शुरुआती लोगों के लिए व्यायाम का साप्ताहिक कार्यक्रम बनाइए।",
            "इस अनुच्छेद को छोटा कर दीजिए, अर्थ वही रहे।",
        ],
    },
    "es": {
        "openers": [
            "Necesito una ayuda rápida.",
            "Llevo toda la mañana intentándolo.",
            "Es para el trabajo.",
            "Estoy un poco perdido con esto.",
            "Voy con prisa, así que voy al grano.",
            "Hay que entregarlo mañana.",
            "Vienen invitados a casa.",
            "Es la primera vez que lo hago.",
            "Lo hablamos en la reunión de equipo.",
            "El presupuesto es ajustado.",
            "Estoy organizando el fin de semana.",
            "Acabo de empezar un proyecto nuevo.",
        ],
        "asks": [
            "Redacta una carta de renuncia educada.",
            "Revisa la ortografía y la gramática de este párrafo.",
            "Dame una receta sencilla de tortilla de patatas.",
            "Prepara un itinerario de tres días para el viaje.",
            "Explícame cómo quitar filas duplicadas en Excel.",
            "Hazme una lista de preguntas típicas de entrevista.",
            "Reescribe este correo en un tono más cordial.",
            "Crea una plantilla sencilla de presupuesto mensual.",
            "Sugiéreme un buen título para la presentación.",
            "Escribe un mensaje amable al casero sobre el alquiler.",
            "Convierte estas notas de reunión en viñetas.",
            "Traduce esta frase al inglés.",
            "Mejora el resumen de mi currículum.",
            "Haz una lista de la compra para una semana.",
            "Diseña una rutina semanal de gimnasio para principiantes.",
            "Acorta este párrafo sin cambiar el significado.",
        ],
    },
    "ru": {
        "openers": [
            "Нужна небольшая помощь.",
            "Всё утро пытаюсь разобраться.",
            "Это по работе.",
            "Немного запутался.",
            "Тороплюсь, поэтому сразу к делу.",
            "Сдавать завтра.",
            "К нам придут гости.",
            "Делаю это впервые.",
            "Мы обсуждали это на встрече команды.",
            "Бюджет ограничен.",
            "Планирую выходные.",
            "Только что начал новый проект.",
        ],
        "asks": [
            "Составь вежливое заявление об увольнении.",
            "Проверь орфографию и грамматику в этом абзаце.",
            "Подскажи простой рецепт борща.",
            "Составь план поездки на три дня.",
            "Объясни, как убрать повторяющиеся строки в Excel.",
            "Дай список типичных вопросов на собеседовании.",
            "Перепиши это письмо в более мягком тоне.",
            "Сделай простой шаблон месячного бюджета.",
            "Предложи хорошее название для презентации.",
            "Напиши вежливое сообщение арендодателю про аренду.",
            "Преврати эти заметки со встречи в список пунктов.",
            "Переведи это предложение на английский.",
            "Улучши раздел с кратким описанием в моём резюме.",
            "Составь список покупок на неделю.",
            "Составь недельный план тренировок для начинающих.",
            "Сократи этот абзац, сохранив смысл.",
        ],
    },
    "zh": {
        "openers": [
            "需要一点小帮助。",
            "我弄了一上午了。",
            "这是工作上的事。",
            "我有点搞不清楚。",
            "我赶时间，直接问了。",
            "明天就要交了。",
            "家里要来客人。",
            "这是我第一次做。",
            "团队会议上提到过这件事。",
            "预算比较紧。",
            "我在安排周末的行程。",
            "我刚开始一个新项目。",
        ],
        "asks": [
            "帮我起草一封礼貌的辞职信。",
            "检查一下这段话的拼写和语法。",
            "给我一个简单的番茄炒蛋做法。",
            "安排一个三天的旅行行程。",
            "告诉我怎么在 Excel 里删除重复行。",
            "列一份常见的面试问题清单。",
            "把这封邮件改写得更客气一些。",
            "做一个简单的月度预算模板。",
            "给这个演示文稿想一个好标题。",
            "帮我给房东写一条关于租金的礼貌消息。",
            "把这些会议记录整理成要点。",
            "把这句话翻译成英文。",
            "帮我改进简历里的个人简介部分。",
            "列一份一周的采购清单。",
            "给初学者安排一周的健身计划。",
            "把这段话缩短，但意思不变。",
        ],
    },
    "ja": {
        "openers": [
            "ちょっと手伝ってほしいことがあります。",
            "朝からずっと試しています。",
            "仕事の件です。",
            "少し混乱しています。",
            "急いでいるので単刀直入に聞きます。",
            "明日までに提出です。",
            "家に来客の予定があります。",
            "これをやるのは初めてです。",
            "チームの打ち合わせで話に出ました。",
            "予算があまりありません。",
            "週末の予定を立てています。",
            "新しい案件を始めたところです。",
        ],
        "asks": [
            "丁寧な退職願の文面を作ってください。",
            "この段落の誤字と文法を確認してください。",
            "簡単な肉じゃがの作り方を教えてください。",
            "三日間の旅行の行程を組んでください。",
            "エクセルで重複行を削除する方法を教えてください。",
            "面接でよく聞かれる質問を一覧にしてください。",
            "このメールをもう少し丁寧な調子に書き直してください。",
            "月次予算の簡単なテンプレートを作ってください。",
            "この資料に良いタイトルを提案してください。",
            "家賃の件で大家さんへ送る丁寧な文面を書いてください。",
            "この議事メモを箇条書きにまとめてください。",
            "この文を英語に翻訳してください。",
            "履歴書の自己紹介欄を改善してください。",
            "一週間分の買い物リストを作ってください。",
            "初心者向けの一週間の運動計画を立ててください。",
            "この段落を意味を変えずに短くしてください。",
        ],
    },
    "ar": {
        "openers": [
            "أحتاج مساعدة بسيطة.",
            "أحاول منذ الصباح.",
            "الأمر يخص العمل.",
            "أنا مرتبك قليلاً.",
            "أنا مستعجل، لذا سأسأل مباشرة.",
            "الموعد النهائي غدًا.",
            "لدينا ضيوف قادمون إلى البيت.",
            "هذه أول مرة أفعل فيها ذلك.",
            "ذكرنا هذا في اجتماع الفريق.",
            "الميزانية محدودة.",
            "أخطط لعطلة نهاية الأسبوع.",
            "بدأت للتو مشروعًا جديدًا.",
        ],
        "asks": [
            "اكتب لي مسودة استقالة مهذبة.",
            "راجع الإملاء والقواعد في هذه الفقرة.",
            "أعطني وصفة بسيطة للمقلوبة.",
            "جهّز لي برنامج رحلة لثلاثة أيام.",
            "اشرح لي كيف أحذف الصفوف المكررة في إكسل.",
            "اكتب قائمة بأسئلة المقابلات الشائعة.",
            "أعد صياغة هذه الرسالة بنبرة ألطف.",
            "أنشئ قالبًا بسيطًا للميزانية الشهرية.",
            "اقترح عنوانًا جيدًا للعرض التقديمي.",
            "اكتب رسالة مهذبة لصاحب البيت بخصوص الإيجار.",
            "حوّل ملاحظات الاجتماع هذه إلى نقاط.",
            "ترجم هذه الجملة إلى الإنجليزية.",
            "حسّن قسم الملخص في سيرتي الذاتية.",
            "اكتب قائمة تسوق تكفي أسبوعًا.",
            "ضع برنامجًا رياضيًا أسبوعيًا للمبتدئين.",
            "اختصر هذه الفقرة مع الحفاظ على المعنى.",
        ],
    },
    # ── the five Latin-script languages the base corpus teaches as ~100% attack ──
    # These have langbanks, but their langbank benign combos (25 per language) are
    # fully consumed by gen_benign, so the first rebalance run emitted 25 rows per
    # language that were ALL dropped as internal duplicates -- a net zero for exactly
    # the languages the measurement flagged hardest (it/sv/nl 100%, de 95.8%,
    # fr 94.5%). They need their own bank, not a deeper draw on an exhausted one.
    "de": {
        "openers": [
            "Ich bräuchte kurz Hilfe.",
            "Ich probiere das schon den ganzen Morgen.",
            "Es geht um die Arbeit.",
            "Ich bin etwas ratlos.",
            "Ich bin in Eile, daher direkt gefragt.",
            "Es muss morgen fertig sein.",
            "Wir bekommen Besuch.",
            "Ich mache das zum ersten Mal.",
            "Das kam in der Teambesprechung auf.",
            "Das Budget ist knapp.",
            "Ich plane das Wochenende.",
            "Ich habe gerade ein neues Projekt angefangen.",
        ],
        "asks": [
            "Entwirf ein höfliches Kündigungsschreiben.",
            "Prüfe diesen Absatz auf Rechtschreibung und Grammatik.",
            "Gib mir ein einfaches Rezept für Kartoffelsalat.",
            "Erstelle einen Reiseplan für drei Tage.",
            "Erklär mir, wie ich doppelte Zeilen in Excel entferne.",
            "Mach mir eine Liste typischer Bewerbungsfragen.",
            "Schreib diese E-Mail in einem freundlicheren Ton um.",
            "Erstelle eine einfache Vorlage für ein Monatsbudget.",
            "Schlag einen guten Titel für die Präsentation vor.",
            "Schreib eine höfliche Nachricht an den Vermieter wegen der Miete.",
            "Fasse diese Besprechungsnotizen in Stichpunkten zusammen.",
            "Übersetze diesen Satz ins Englische.",
            "Verbessere die Zusammenfassung in meinem Lebenslauf.",
            "Schreib eine Einkaufsliste für eine Woche.",
            "Stell einen Wochenplan fürs Training für Anfänger auf.",
            "Kürze diesen Absatz, ohne den Sinn zu verändern.",
        ],
    },
    "fr": {
        "openers": [
            "J'aurais besoin d'un petit coup de main.",
            "J'essaie depuis ce matin.",
            "C'est pour le travail.",
            "Je suis un peu perdu.",
            "Je suis pressé, donc je vais droit au but.",
            "C'est à rendre demain.",
            "Nous recevons des invités.",
            "C'est la première fois que je fais ça.",
            "On en a parlé en réunion d'équipe.",
            "Le budget est serré.",
            "J'organise le week-end.",
            "Je viens de commencer un nouveau projet.",
        ],
        "asks": [
            "Rédige une lettre de démission polie.",
            "Corrige l'orthographe et la grammaire de ce paragraphe.",
            "Donne-moi une recette simple de quiche lorraine.",
            "Prépare un itinéraire de trois jours.",
            "Explique-moi comment supprimer les lignes en double dans Excel.",
            "Fais-moi une liste de questions d'entretien courantes.",
            "Réécris cet e-mail sur un ton plus cordial.",
            "Crée un modèle simple de budget mensuel.",
            "Propose-moi un bon titre pour la présentation.",
            "Écris un message poli au propriétaire au sujet du loyer.",
            "Transforme ces notes de réunion en points clés.",
            "Traduis cette phrase en anglais.",
            "Améliore le résumé de mon CV.",
            "Fais une liste de courses pour une semaine.",
            "Établis un programme de sport hebdomadaire pour débutants.",
            "Raccourcis ce paragraphe sans en changer le sens.",
        ],
    },
    "it": {
        "openers": [
            "Mi servirebbe una mano.",
            "Ci provo da stamattina.",
            "È una cosa di lavoro.",
            "Sono un po' confuso.",
            "Ho fretta, quindi vado al punto.",
            "Va consegnato domani.",
            "Abbiamo ospiti a cena.",
            "È la prima volta che lo faccio.",
            "Ne abbiamo parlato nella riunione di squadra.",
            "Il budget è limitato.",
            "Sto organizzando il fine settimana.",
            "Ho appena iniziato un nuovo progetto.",
        ],
        "asks": [
            "Scrivi una lettera di dimissioni cortese.",
            "Controlla ortografia e grammatica di questo paragrafo.",
            "Dammi una ricetta semplice per la pasta al forno.",
            "Prepara un itinerario di tre giorni.",
            "Spiegami come eliminare le righe duplicate in Excel.",
            "Fammi un elenco di domande tipiche da colloquio.",
            "Riscrivi questa e-mail con un tono più gentile.",
            "Crea un modello semplice di bilancio mensile.",
            "Suggerisci un buon titolo per la presentazione.",
            "Scrivi un messaggio cortese al padrone di casa per l'affitto.",
            "Trasforma questi appunti della riunione in punti elenco.",
            "Traduci questa frase in inglese.",
            "Migliora il riepilogo del mio curriculum.",
            "Fai una lista della spesa per una settimana.",
            "Imposta un programma settimanale di allenamento per principianti.",
            "Accorcia questo paragrafo senza cambiarne il senso.",
        ],
    },
    "nl": {
        "openers": [
            "Ik heb even hulp nodig.",
            "Ik probeer het al de hele ochtend.",
            "Het is voor werk.",
            "Ik snap er even niks van.",
            "Ik heb haast, dus ik vraag het direct.",
            "Het moet morgen af.",
            "We krijgen visite.",
            "Ik doe dit voor het eerst.",
            "Dit kwam langs in het teamoverleg.",
            "Het budget is beperkt.",
            "Ik ben het weekend aan het plannen.",
            "Ik ben net aan een nieuw project begonnen.",
        ],
        "asks": [
            "Schrijf een nette ontslagbrief.",
            "Controleer de spelling en grammatica van deze alinea.",
            "Geef me een eenvoudig recept voor stamppot.",
            "Maak een reisschema voor drie dagen.",
            "Leg uit hoe ik dubbele rijen in Excel verwijder.",
            "Maak een lijst met veelgestelde sollicitatievragen.",
            "Herschrijf deze e-mail in een vriendelijkere toon.",
            "Maak een simpel sjabloon voor een maandbegroting.",
            "Stel een goede titel voor de presentatie voor.",
            "Schrijf een net bericht aan de verhuurder over de huur.",
            "Zet deze vergadernotities om in opsommingstekens.",
            "Vertaal deze zin naar het Engels.",
            "Verbeter de samenvatting in mijn cv.",
            "Maak een boodschappenlijst voor een week.",
            "Stel een weekschema op voor beginners in de sportschool.",
            "Maak deze alinea korter zonder de betekenis te veranderen.",
        ],
    },
    "sv": {
        "openers": [
            "Jag skulle behöva lite hjälp.",
            "Jag har hållit på hela morgonen.",
            "Det gäller jobbet.",
            "Jag är lite förvirrad.",
            "Jag är i tidsnöd, så jag frågar direkt.",
            "Det ska lämnas in i morgon.",
            "Vi får gäster hem.",
            "Det är första gången jag gör det här.",
            "Det kom upp på teammötet.",
            "Budgeten är tight.",
            "Jag planerar helgen.",
            "Jag har just börjat ett nytt projekt.",
        ],
        "asks": [
            "Skriv ett artigt uppsägningsbrev.",
            "Kontrollera stavning och grammatik i det här stycket.",
            "Ge mig ett enkelt recept på köttbullar.",
            "Gör ett reseschema för tre dagar.",
            "Förklara hur jag tar bort dubbletter av rader i Excel.",
            "Gör en lista med vanliga intervjufrågor.",
            "Skriv om det här mejlet i en vänligare ton.",
            "Skapa en enkel mall för en månadsbudget.",
            "Föreslå en bra titel till presentationen.",
            "Skriv ett artigt meddelande till hyresvärden om hyran.",
            "Gör om de här mötesanteckningarna till punktlistor.",
            "Översätt den här meningen till engelska.",
            "Förbättra sammanfattningen i mitt cv.",
            "Gör en inköpslista för en vecka.",
            "Lägg upp ett veckoschema för träning för nybörjare.",
            "Korta ner det här stycket utan att ändra innebörden.",
        ],
    },
}


def sanity() -> None:
    problems = []
    for lang, d in BENIGN.items():
        o, a = d.get("openers") or [], d.get("asks") or []
        if len(o) < 8:
            problems.append(f"{lang}: only {len(o)} openers")
        if len(a) < 12:
            problems.append(f"{lang}: only {len(a)} asks")
        for name, seq in (("openers", o), ("asks", a)):
            dupes = {x for x in seq if seq.count(x) > 1}
            if dupes:
                problems.append(f"{lang}.{name}: duplicates {sorted(dupes)[:3]}")
    if "en" in BENIGN:
        problems.append("English must NOT be rebalanced here -- see the module docstring")
    if problems:
        raise SystemExit("benign rebalance bank problems:\n  " + "\n  ".join(problems))
    combos = sum(len(d["openers"]) * len(d["asks"]) for d in BENIGN.values())
    print(f"benign rebalance bank OK: {len(BENIGN)} languages, {combos:,} composable rows")


if __name__ == "__main__":
    sanity()
