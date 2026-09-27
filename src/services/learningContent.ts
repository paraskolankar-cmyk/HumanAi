// ============================================================
// STATIC FALLBACK CONTENT — AI call fail hone par yeh use hoga
// Har module ke liye ready-made content — zero API calls
// ============================================================

export const STATIC_CONTENT: Record<string, Record<number, any>> = {

  vocabulary: {
    1: {
      topic: "Day 1: Daily Life Vocabulary",
      explanation: "Aaj hum daily life mein use hone wale 10 important words seekhenge.",
      explanationTranslation: "Today we will learn 10 important words used in daily life.",
      vocabulary: [
        { word: "Achieve", meaning: "To successfully reach a goal", translation: "Praapt karna", example: "She worked hard to achieve her dreams." },
        { word: "Fluent", meaning: "Able to speak easily and smoothly", translation: "Dhaarapravaah", example: "He is fluent in English." },
        { word: "Confident", meaning: "Feeling sure about yourself", translation: "Aatmavishvaasi", example: "Be confident while speaking." },
        { word: "Improve", meaning: "To get better at something", translation: "Sudhaarna", example: "Practice daily to improve your English." },
        { word: "Communicate", meaning: "To share information with others", translation: "Soochna saanjha karna", example: "We communicate through language." },
        { word: "Vocabulary", meaning: "The words a person knows", translation: "Shabdabhandar", example: "Reading books builds vocabulary." },
        { word: "Practice", meaning: "To do something repeatedly to improve", translation: "Abhyaas karna", example: "Daily practice makes you perfect." },
        { word: "Understand", meaning: "To know the meaning of something", translation: "Samajhna", example: "Do you understand this lesson?" },
        { word: "Progress", meaning: "Forward movement or improvement", translation: "Pragati", example: "I can see my English progress." },
        { word: "Effort", meaning: "Hard work and energy put into something", translation: "Prayaas", example: "Success needs consistent effort." }
      ],
      examples: [
        { english: "I make an effort to practice English every day.", translation: "Main roz English seekhne ki koshish karta hoon." },
        { english: "My vocabulary is improving week by week.", translation: "Mera shabdabhandar hafte dar hafte badh raha hai." }
      ],
      questions: [
        { question: "What does 'Achieve' mean?", translation: "'Achieve' ka matlab kya hai?", options: ["To fail at something", "To successfully reach a goal", "To forget something", "To argue with someone"], answer: "To successfully reach a goal", explanation: "'Achieve' matlab hai kisi goal ko successfully paana. Jaise: She achieved her dream of becoming a doctor." },
        { question: "Which sentence uses 'Confident' correctly?", translation: "Kaun sa sentence 'Confident' sahi use karta hai?", options: ["She is confident about her mistake.", "He is confident that he will succeed.", "They were confident to lose.", "I am confident to never try."], answer: "He is confident that he will succeed.", explanation: "'Confident' ka use positive belief ke liye hota hai. 'He is confident that he will succeed' — yah sahi hai." },
        { question: "What is the meaning of 'Progress'?", translation: "'Progress' ka arth kya hai?", options: ["Moving backward", "Staying the same", "Forward improvement", "Making mistakes"], answer: "Forward improvement", explanation: "'Progress' matlab hai aage badhna ya sudhar aana. Jaise: I can see progress in my English." },
        { question: "Which word means 'Abhyaas karna' in English?", translation: "Kaun sa English word 'Abhyaas karna' hai?", options: ["Achieve", "Practice", "Improve", "Understand"], answer: "Practice", explanation: "'Practice' matlab hai baar baar karna taaki behtar ho jao. Jaise: Daily practice makes perfect." },
        { question: "What does 'Communicate' mean?", translation: "'Communicate' ka matlab kya hai?", options: ["To stay silent", "To share information with others", "To read books", "To write letters only"], answer: "To share information with others", explanation: "'Communicate' ka matlab hai apni baat doosron tak pahunchaana — bolkar, likhkar ya ishaaron se." }
      ]
    },
    2: {
      topic: "Day 2: Work & Office Vocabulary",
      explanation: "Aaj hum office aur kaam se related zaroori words seekhenge.",
      explanationTranslation: "Today we learn important words related to work and office.",
      vocabulary: [
        { word: "Deadline", meaning: "The last date to complete something", translation: "Antim tarikh", example: "Submit the report before the deadline." },
        { word: "Meeting", meaning: "A gathering to discuss work", translation: "Baithak / Meeting", example: "We have a team meeting at 10 AM." },
        { word: "Project", meaning: "A planned piece of work", translation: "Pariyojna", example: "Our project will finish next week." },
        { word: "Colleague", meaning: "A person you work with", translation: "Sahakarmee", example: "My colleague helped me with the report." },
        { word: "Manager", meaning: "A person who leads a team", translation: "Prabandak", example: "The manager approved the plan." },
        { word: "Presentation", meaning: "Showing information to a group", translation: "Pradarshan", example: "I gave a presentation today." },
        { word: "Report", meaning: "A written or spoken account of something", translation: "Prativedan", example: "Please send the weekly report." },
        { word: "Schedule", meaning: "A plan of times and activities", translation: "Samay-saarni", example: "Check the schedule for tomorrow." },
        { word: "Client", meaning: "A customer or someone you provide services to", translation: "Grahak / Client", example: "We met our client today." },
        { word: "Target", meaning: "A goal you aim to reach", translation: "Lakshya", example: "We achieved our monthly target." }
      ],
      examples: [
        { english: "The deadline for this project is Friday.", translation: "Is project ki antim tarikh shukravar hai." },
        { english: "My manager scheduled a meeting with the client.", translation: "Mere manager ne client ke saath meeting taiy ki." }
      ],
      questions: [
        { question: "What is a 'Deadline'?", translation: "'Deadline' kya hoti hai?", options: ["A type of meeting", "The last date to complete something", "A work target", "A colleague's name"], answer: "The last date to complete something", explanation: "'Deadline' matlab kaam khatam karne ki antim tarikh. Jaise: Submit the report before the deadline." },
        { question: "Who is a 'Colleague'?", translation: "'Colleague' kaun hota hai?", options: ["Your boss", "A person you work with", "A customer", "Your family member"], answer: "A person you work with", explanation: "'Colleague' matlab kaam par saath kaam karne wala vyakti. Jaise: My colleague helped me." },
        { question: "What does 'Schedule' mean?", translation: "'Schedule' ka matlab kya hai?", options: ["A type of report", "A plan of times and activities", "A work target", "A meeting room"], answer: "A plan of times and activities", explanation: "'Schedule' matlab samay-saarni — kab kya karna hai ka plan. Jaise: Check the schedule for tomorrow." },
        { question: "What is a 'Presentation'?", translation: "'Presentation' kya hota hai?", options: ["A written report", "Showing information to a group", "A type of deadline", "A client meeting only"], answer: "Showing information to a group", explanation: "'Presentation' matlab group ke saamne information dikhana ya explain karna." },
        { question: "What is a 'Target' in work?", translation: "Kaam mein 'Target' kya hota hai?", options: ["A colleague", "A goal you aim to reach", "A type of meeting", "A schedule"], answer: "A goal you aim to reach", explanation: "'Target' matlab wo goal jo aapko achieve karna hai. Jaise: We achieved our monthly target." }
      ]
    }
  },

  grammar: {
    1: {
      topic: "Day 1: Parts of Speech — Overview",
      explanation: "English grammar mein 8 parts of speech hote hain — Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection.",
      explanationTranslation: "Angrezi vyakaran mein 8 shabd-bhed hote hain — Sangya, Sarvanaam, Kriya, Visheshan, Kriya-visheshan, Sambandh-bodhak, Samuchcha-bodhak, Vismayaadibodak.",
      rules: [
        "Noun — Person, Place, Thing ya Idea ka naam. Jaise: Ram, Delhi, Book",
        "Pronoun — Noun ki jagah use hota hai. Jaise: He, She, It, They",
        "Verb — Kaam ya state batata hai. Jaise: Run, Eat, Is, Are",
        "Adjective — Noun ko describe karta hai. Jaise: Beautiful, Big, Happy",
        "Adverb — Verb, Adjective ya Adverb ko describe karta hai. Jaise: Quickly, Very",
        "Preposition — Relationship batata hai. Jaise: In, On, At, Under",
        "Conjunction — Words/clauses jodata hai. Jaise: And, But, Because, Or",
        "Interjection — Emotion express karta hai. Jaise: Wow!, Oh!, Hurray!"
      ],
      examples: [
        { english: "Ram (Noun) runs (Verb) quickly (Adverb) in (Preposition) the park.", translation: "Ram park mein tezi se dauda." },
        { english: "She (Pronoun) is (Verb) very (Adverb) beautiful (Adjective).", translation: "Woh bahut sundar hai." },
        { english: "I like tea and (Conjunction) coffee.", translation: "Mujhe chai aur coffee dono pasand hain." }
      ],
      questions: [
        { question: "Which word is a NOUN in: 'The dog runs fast'?", translation: "'The dog runs fast' mein NOUN kaun sa hai?", options: ["runs", "fast", "dog", "the"], answer: "dog", explanation: "'Dog' ek Noun hai kyunki yeh ek jeev ka naam hai. Noun = person, place, thing ya idea." },
        { question: "Which word is a VERB in: 'She sings beautifully'?", translation: "'She sings beautifully' mein VERB kaun sa hai?", options: ["She", "beautifully", "sings", "the"], answer: "sings", explanation: "'Sings' ek Verb hai kyunki yeh kaam batata hai — gaana gaana." },
        { question: "Which is an ADJECTIVE in: 'The tall boy is smart'?", translation: "Kaun sa Adjective hai?", options: ["boy", "is", "tall", "the"], answer: "tall", explanation: "'Tall' ek Adjective hai jo 'boy' ko describe karta hai." },
        { question: "Which word is a CONJUNCTION in: 'I like tea but not coffee'?", translation: "Kaun sa word Conjunction hai?", options: ["I", "like", "but", "not"], answer: "but", explanation: "'But' ek Conjunction hai jo do thoughts ko jodta hai — contrast ke liye." },
        { question: "Which is a PREPOSITION: 'The cat is under the table'?", translation: "Kaun sa Preposition hai?", options: ["cat", "under", "table", "the"], answer: "under", explanation: "'Under' ek Preposition hai jo table aur cat ke beech relationship batata hai." }
      ]
    },
    2: {
      topic: "Day 2: Articles — A, An, The",
      explanation: "Articles teen hote hain: A, An, The. A aur An indefinite articles hain (koi bhi), The definite article hai (wahi specific cheez).",
      explanationTranslation: "A = koi bhi ek (consonant sound se pehle), An = koi bhi ek (vowel sound se pehle), The = wahi khaas cheez.",
      rules: [
        "A — Consonant sound se shuru hone wale words se pehle. Jaise: a book, a dog, a university",
        "An — Vowel sound (a,e,i,o,u) se shuru hone wale words se pehle. Jaise: an apple, an hour, an egg",
        "The — Specific ya already-mentioned cheez ke liye. Jaise: the sun, the car we saw",
        "No Article — Languages, subjects, meals, proper nouns ke saath. Jaise: I eat breakfast. She studies Hindi."
      ],
      examples: [
        { english: "I saw a dog in the park.", translation: "Maine park mein ek kutta dekha." },
        { english: "She ate an apple and a banana.", translation: "Usne ek seb aur ek kela khaya." },
        { english: "The sun rises in the east.", translation: "Sooraj poorab mein ugta hai." }
      ],
      questions: [
        { question: "Which article fits: '___ apple a day keeps doctor away'?", translation: "Kaun sa article sahi hai?", options: ["A", "An", "The", "No article"], answer: "An", explanation: "'Apple' vowel sound 'a' se shuru hota hai, isliye 'An' use hoga — 'An apple'." },
        { question: "Fill in: 'She is ___ engineer'.", translation: "Sahi article bharein.", options: ["a", "an", "the", "no article"], answer: "an", explanation: "'Engineer' vowel sound 'e' se shuru hota hai, isliye 'an engineer' sahi hai." },
        { question: "Which is correct: '___ sun is very hot today'?", translation: "Kaun sa sahi hai?", options: ["A sun", "An sun", "The sun", "Sun"], answer: "The sun", explanation: "'Sun' ek specific cheez hai — sirf ek hi sun hai — isliye 'The sun' sahi hai." },
        { question: "Which sentence is correct?", translation: "Kaun sa sentence sahi hai?", options: ["I had a breakfast.", "I had an breakfast.", "I had the breakfast.", "I had breakfast."], answer: "I had breakfast.", explanation: "Meals ke saath article use nahi hota. 'I had breakfast' — no article needed." },
        { question: "Fill in: 'He is ___ honest man'.", translation: "Sahi article bharein.", options: ["a", "an", "the", "no article"], answer: "an", explanation: "'Honest' silent 'h' ke saath 'o' sound se shuru hota hai, isliye 'an honest man' sahi hai." }
      ]
    }
  },

  tenses: {
    1: {
      topic: "Day 1: Simple Present Tense",
      explanation: "Simple Present Tense tab use karte hain jab koi kaam regularly hota hai, aadat ho, ya koi sachchi baat batani ho.",
      explanationTranslation: "Jab koi kaam baar baar hota hai, ya koi sach batana ho, tab Simple Present use karte hain.",
      tenseStructure: "Subject + V1 (s/es for He/She/It) + Object",
      rules: [
        "I/We/You/They ke saath: V1 (base form) — I go, They eat",
        "He/She/It ke saath: V1 + s/es — He goes, She eats, It runs",
        "Negative: Subject + do/does + not + V1 — She does not eat",
        "Question: Do/Does + Subject + V1? — Does he eat rice?"
      ],
      examples: [
        { english: "I go to school every day.", translation: "Main roz school jaata hoon." },
        { english: "She drinks tea in the morning.", translation: "Woh subah chai peeti hai." },
        { english: "They play cricket on weekends.", translation: "Woh weekend par cricket khelte hain." },
        { english: "Does he work here?", translation: "Kya woh yahan kaam karta hai?" },
        { english: "I do not eat meat.", translation: "Main maas nahi khaata." }
      ],
      questions: [
        { question: "Which is correct for Simple Present with 'She'?", translation: "Simple Present mein 'She' ke saath kaun sa sahi hai?", options: ["She go to market.", "She goes to market.", "She going to market.", "She gone to market."], answer: "She goes to market.", explanation: "He/She/It ke saath verb mein 's' ya 'es' lagate hain. 'Go' → 'Goes'. Isliye 'She goes to market' sahi hai." },
        { question: "Make this negative: 'He plays football'", translation: "Is sentence ko negative banao.", options: ["He not plays football.", "He don't plays football.", "He does not play football.", "He didn't play football."], answer: "He does not play football.", explanation: "He/She/It ke negative mein 'does not + V1' use hota hai. 'play' (without s) use hoga." },
        { question: "Which sentence shows a HABIT?", translation: "Kaun sa sentence aadat dikhata hai?", options: ["She is eating now.", "She eats rice every day.", "She ate rice yesterday.", "She will eat rice."], answer: "She eats rice every day.", explanation: "Simple Present mein 'every day' ke saath aadat batate hain. 'She eats rice every day' correct hai." },
        { question: "Question form of: 'They speak English'", translation: "Iska question form kya hoga?", options: ["Does they speak English?", "Do they speaks English?", "Do they speak English?", "Are they speak English?"], answer: "Do they speak English?", explanation: "They/I/We/You ke saath 'Do' use hota hai question mein. 'Do they speak English?' sahi hai." },
        { question: "Fill in: 'The sun ___ in the east.'", translation: "Sahi form bharein.", options: ["rise", "rises", "rising", "rose"], answer: "rises", explanation: "'Sun' singular hai (It), isliye 'rises' sahi hai. Yeh ek scientific fact hai jo Simple Present mein batate hain." }
      ]
    },
    2: {
      topic: "Day 2: Simple Past Tense",
      explanation: "Simple Past Tense tab use karte hain jab koi kaam pehle ho chuka ho — abhi nahi, kal ya aur pehle.",
      explanationTranslation: "Jab koi kaam beet chuka ho tab Simple Past use karte hain.",
      tenseStructure: "Subject + V2 + Object",
      rules: [
        "Positive: Subject + V2 — I went, She ate, They played",
        "Negative: Subject + did not + V1 — She did not eat",
        "Question: Did + Subject + V1? — Did he eat?",
        "Regular verbs mein -ed lagate hain: play→played, work→worked",
        "Irregular verbs ki V2 alag hoti hai: go→went, eat→ate, see→saw"
      ],
      examples: [
        { english: "I went to Delhi last week.", translation: "Main pichhle hafte Delhi gaya tha." },
        { english: "She ate an apple this morning.", translation: "Usne aaj subah ek seb khaya." },
        { english: "Did you call him yesterday?", translation: "Kya tumne kal use phone kiya?" },
        { english: "They did not come to the party.", translation: "Woh party mein nahi aaye." }
      ],
      questions: [
        { question: "Which is the correct Simple Past of 'go'?", translation: "'Go' ki Simple Past form kya hai?", options: ["goed", "goes", "gone", "went"], answer: "went", explanation: "'Go' ek irregular verb hai. Iska Simple Past (V2) 'went' hai. Jaise: I went to school." },
        { question: "Make negative: 'She played cricket'", translation: "Is sentence ko negative banao.", options: ["She not played cricket.", "She did not played cricket.", "She did not play cricket.", "She doesn't played cricket."], answer: "She did not play cricket.", explanation: "Past mein negative ke liye 'did not + V1 (base form)' use karte hain. 'play' (not played)." },
        { question: "Which shows Simple Past correctly?", translation: "Kaun sa Simple Past sahi dikhata hai?", options: ["I am eating yesterday.", "I eat yesterday.", "I ate yesterday.", "I have eat yesterday."], answer: "I ate yesterday.", explanation: "'Yesterday' ke saath Simple Past use hota hai. 'Ate' is the V2 of 'eat'." },
        { question: "Question form of: 'He worked yesterday'", translation: "Iska question form kya hoga?", options: ["Did he worked yesterday?", "Did he work yesterday?", "Does he work yesterday?", "Was he work yesterday?"], answer: "Did he work yesterday?", explanation: "Past question mein 'Did + Subject + V1' use hota hai. 'work' (V1, not worked)." },
        { question: "Which verb is IRREGULAR?", translation: "Kaun sa verb irregular hai?", options: ["play → played", "work → worked", "see → saw", "talk → talked"], answer: "see → saw", explanation: "'See → Saw' ek irregular verb hai. Baaki sab regular hain (add -ed). Irregular verbs yaad karne padte hain." }
      ]
    }
  },

  verbs: {
    1: {
      topic: "Day 1: Common Verbs — V1 to V4 Forms",
      explanation: "Har English verb ke 4 forms hote hain: V1 (base), V2 (past), V3 (past participle), V4 (-ing form).",
      explanationTranslation: "Har Angrezi kriya ke 4 roop hote hain jinka alag alag jagah use hota hai.",
      verbs: [
        { v1: "Go", v2: "Went", v3: "Gone", v4: "Going", translation: "Jaana", example: "I go to school. I went yesterday. I have gone there." },
        { v1: "Eat", v2: "Ate", v3: "Eaten", v4: "Eating", translation: "Khaana", example: "She eats rice. She ate rice. She is eating rice." },
        { v1: "See", v2: "Saw", v3: "Seen", v4: "Seeing", translation: "Dekhna", example: "I see a bird. I saw it. I have seen it." },
        { v1: "Do", v2: "Did", v3: "Done", v4: "Doing", translation: "Karna", example: "I do my work. I did it. It is done." },
        { v1: "Write", v2: "Wrote", v3: "Written", v4: "Writing", translation: "Likhna", example: "She writes a letter. She wrote it. She is writing." },
        { v1: "Come", v2: "Came", v3: "Come", v4: "Coming", translation: "Aana", example: "They come daily. They came yesterday." },
        { v1: "Take", v2: "Took", v3: "Taken", v4: "Taking", translation: "Lena", example: "He takes notes. He took a book." },
        { v1: "Speak", v2: "Spoke", v3: "Spoken", v4: "Speaking", translation: "Bolna", example: "I speak English. I spoke to him." }
      ],
      examples: [
        { english: "I have eaten my lunch already.", translation: "Main pehle hi khana kha chuka hoon." },
        { english: "She was writing a letter when I came.", translation: "Jab main aaya, woh khat likh rahi thi." }
      ],
      questions: [
        { question: "What is V2 of 'Eat'?", translation: "'Eat' ka V2 form kya hai?", options: ["Eated", "Eaten", "Ate", "Eating"], answer: "Ate", explanation: "'Eat' ka V2 (Simple Past) 'Ate' hai. Jaise: She ate rice yesterday." },
        { question: "What is V3 of 'Write'?", translation: "'Write' ka V3 form kya hai?", options: ["Wrote", "Writing", "Written", "Writed"], answer: "Written", explanation: "'Write' ka V3 (Past Participle) 'Written' hai. Jaise: I have written a letter." },
        { question: "Which form is used with 'is/are/was/were'?", translation: "Is/are/was/were ke saath kaun sa form use hota hai?", options: ["V1", "V2", "V3", "V4"], answer: "V4", explanation: "V4 (-ing form) is/are/am/was/were ke saath use hota hai. Jaise: She is eating." },
        { question: "What is V2 of 'Go'?", translation: "'Go' ka V2 kya hai?", options: ["Goes", "Gone", "Going", "Went"], answer: "Went", explanation: "'Go' ka V2 'Went' hai. Jaise: I went to school yesterday." },
        { question: "Which form is used in 'I have ___ my work' (Do)?", translation: "Kaun sa form use hoga?", options: ["do", "did", "done", "doing"], answer: "done", explanation: "'Have/Has/Had' ke baad V3 use hota hai. 'Do' ka V3 'Done' hai — I have done my work." }
      ]
    }
  },

  "syno-anto": {
    1: {
      topic: "Day 1: Common Synonyms & Antonyms",
      explanation: "Synonyms = same meaning wale words. Antonyms = opposite meaning wale words.",
      explanationTranslation: "Synonyms = ek jaise matlab wale shabd. Antonyms = ulte matlab wale shabd.",
      rules: [
        "Synonym of Happy = Joyful, Glad, Pleased, Cheerful",
        "Antonym of Happy = Sad, Unhappy, Miserable",
        "Synonym of Big = Large, Huge, Enormous, Gigantic",
        "Antonym of Big = Small, Tiny, Little, Miniature",
        "Synonym of Fast = Quick, Rapid, Swift, Speedy",
        "Antonym of Fast = Slow, Sluggish, Lazy"
      ],
      examples: [
        { english: "She is happy (Synonym: joyful) today.", translation: "Woh aaj khush hai." },
        { english: "The opposite of 'brave' is 'cowardly'.", translation: "'Brave' ka ulta 'cowardly' hai." },
        { english: "He is rich (Antonym: poor).", translation: "Woh ameer hai (ulta: garib)." }
      ],
      questions: [
        { question: "What is the SYNONYM of 'Happy'?", translation: "'Happy' ka Synonym kya hai?", options: ["Sad", "Angry", "Joyful", "Tired"], answer: "Joyful", explanation: "'Joyful' ka matlab bhi 'Happy' jaise hi hota hai. Dono ka arth khushi hai." },
        { question: "What is the ANTONYM of 'Big'?", translation: "'Big' ka Antonym kya hai?", options: ["Large", "Huge", "Small", "Grand"], answer: "Small", explanation: "'Small' ka matlab 'Big' se bilkul ulta hai — chhhota." },
        { question: "Synonym of 'Fast'?", translation: "'Fast' ka Synonym kya hai?", options: ["Slow", "Quick", "Late", "Lazy"], answer: "Quick", explanation: "'Quick' aur 'Fast' dono ka matlab tezi se hona hai." },
        { question: "Antonym of 'Rich'?", translation: "'Rich' ka Antonym kya hai?", options: ["Wealthy", "Prosperous", "Poor", "Famous"], answer: "Poor", explanation: "'Rich' matlab ameer aur 'Poor' matlab garib — yeh ek dusre ke ulte hain." },
        { question: "Synonym of 'Brave'?", translation: "'Brave' ka Synonym kya hai?", options: ["Coward", "Fearful", "Courageous", "Weak"], answer: "Courageous", explanation: "'Brave' aur 'Courageous' dono ka matlab nikkar/sahasee hona hai." }
      ]
    }
  },

  "noun-pronoun": {
    1: {
      topic: "Day 1: Nouns — Types & Usage",
      explanation: "Noun kisi bhi person, place, thing ya idea ka naam hai. Noun ke 5 main types hote hain.",
      explanationTranslation: "Sangya kisi bhi vyakti, sthan, vastu ya vichaar ka naam hota hai.",
      rules: [
        "Proper Noun: Kisi khaas vyakti, jagah ya cheez ka naam. Jaise: Ram, Delhi, India",
        "Common Noun: Ek jaati ka general naam. Jaise: boy, city, book",
        "Abstract Noun: Jo dekhne ya choone mein nahi aata. Jaise: love, happiness, freedom",
        "Collective Noun: Group ka naam. Jaise: team, army, flock",
        "Material Noun: Jo substance/material se bana ho. Jaise: gold, wood, water"
      ],
      examples: [
        { english: "Ram (Proper) is a boy (Common) full of happiness (Abstract).", translation: "Ram (Proper Noun) ek khush (Abstract Noun) ladka (Common Noun) hai." },
        { english: "The team (Collective) won the gold (Material) medal.", translation: "Team ne sona (Material) ka medal jeeta." }
      ],
      questions: [
        { question: "Which is a PROPER NOUN?", translation: "Kaun sa Proper Noun hai?", options: ["city", "book", "Delhi", "happiness"], answer: "Delhi", explanation: "'Delhi' ek Proper Noun hai — kisi khaas jagah ka specific naam." },
        { question: "Which is an ABSTRACT NOUN?", translation: "Kaun sa Abstract Noun hai?", options: ["table", "love", "Ram", "team"], answer: "love", explanation: "'Love' ek Abstract Noun hai — isko dekh ya chhu nahi sakte, sirf feel kar sakte hain." },
        { question: "Which is a COLLECTIVE NOUN?", translation: "Kaun sa Collective Noun hai?", options: ["water", "team", "freedom", "Delhi"], answer: "team", explanation: "'Team' ek Collective Noun hai — logon ke group ka naam." },
        { question: "Which is a MATERIAL NOUN?", translation: "Kaun sa Material Noun hai?", options: ["boy", "gold", "army", "joy"], answer: "gold", explanation: "'Gold' ek Material Noun hai — yeh ek substance/material hai." },
        { question: "Which is a COMMON NOUN?", translation: "Kaun sa Common Noun hai?", options: ["Ram", "India", "city", "freedom"], answer: "city", explanation: "'City' ek Common Noun hai — yeh kisi bhi sheher ka general naam hai, kisi specific jagah ka nahi." }
      ]
    }
  },

  "voice-narration": {
    1: {
      topic: "Day 1: Active Voice vs Passive Voice",
      explanation: "Active Voice mein subject kaam karta hai. Passive Voice mein subject par kaam hota hai.",
      explanationTranslation: "Active mein kaam karne wala pehle aata hai. Passive mein kaam hua wala pehle aata hai.",
      rules: [
        "Active: Subject + Verb + Object — Ram ate the apple.",
        "Passive: Object + be-verb + V3 + by + Subject — The apple was eaten by Ram.",
        "Active→Passive: Object Subject banta hai, Subject 'by' ke saath aata hai",
        "Verb form: is/are + V3 (Present), was/were + V3 (Past), will be + V3 (Future)"
      ],
      examples: [
        { english: "Active: She writes a letter. | Passive: A letter is written by her.", translation: "Active: Woh khat likhti hai. | Passive: Khat uske dwara likha jaata hai." },
        { english: "Active: They built the house. | Passive: The house was built by them.", translation: "Active: Unhone ghar banaya. | Passive: Ghar unke dwara banaya gaya." }
      ],
      questions: [
        { question: "Convert to Passive: 'Ram eats an apple'", translation: "Passive mein badlo.", options: ["An apple is eaten by Ram.", "An apple eats Ram.", "Ram is eaten by apple.", "Apple was eat by Ram."], answer: "An apple is eaten by Ram.", explanation: "Active → Passive: Object (apple) pehle aata hai, 'is eaten' (is + V3), 'by Ram' baad mein." },
        { question: "Which is PASSIVE voice?", translation: "Kaun sa Passive Voice hai?", options: ["She reads a book.", "A book is read by her.", "She is reading a book.", "She read a book."], answer: "A book is read by her.", explanation: "'A book is read by her' — yahan 'book' subject hai aur 'by her' se pata chalta hai ki kaam usne kiya." },
        { question: "Passive of: 'They will build a house'", translation: "Passive banao.", options: ["A house will built by them.", "A house will be built by them.", "A house was built by them.", "A house is built by them."], answer: "A house will be built by them.", explanation: "Future Passive: will be + V3. 'Build' ka V3 'built' hai." },
        { question: "Active of: 'A letter was written by him'", translation: "Active banao.", options: ["He write a letter.", "He wrote a letter.", "He is writing a letter.", "He writes letter."], answer: "He wrote a letter.", explanation: "'Was written' Past Passive hai. Active mein: He (subject) + wrote (V2) + a letter." },
        { question: "Which tense uses 'is/are + V3' in Passive?", translation: "Passive mein 'is/are + V3' kab use hota hai?", options: ["Simple Past", "Simple Future", "Simple Present", "Past Continuous"], answer: "Simple Present", explanation: "Simple Present Passive mein 'is/are + V3' use hota hai. Jaise: The letter is written by her." }
      ]
    }
  },

  "other-pos": {
    1: {
      topic: "Day 1: Adjectives — Degrees of Comparison",
      explanation: "Adjectives ek cheez ko describe karte hain. Comparison ke 3 degrees hote hain: Positive, Comparative, Superlative.",
      explanationTranslation: "Adjective cheez ki visheshta batata hai. Teen degree mein comparison hota hai.",
      rules: [
        "Positive (koi comparison nahi): Ram is tall.",
        "Comparative (do cheez ka comparison): Ram is taller than Shyam.",
        "Superlative (sabse zyada): Ram is the tallest in the class.",
        "Short adj: add -er/-est: tall→taller→tallest, big→bigger→biggest",
        "Long adj: add more/most: beautiful→more beautiful→most beautiful",
        "Irregular: good→better→best, bad→worse→worst, little→less→least"
      ],
      examples: [
        { english: "She is tall. (Positive) | She is taller than me. (Comparative) | She is the tallest in class. (Superlative)", translation: "Woh lambi hai | Woh mujhse lambi hai | Woh class mein sabse lambi hai." },
        { english: "This is good. | This is better. | This is the best.", translation: "Yeh achha hai. | Yeh behtar hai. | Yeh sabse achha hai." }
      ],
      questions: [
        { question: "Comparative form of 'happy'?", translation: "'Happy' ki Comparative form kya hai?", options: ["more happy", "happier", "happiest", "most happy"], answer: "happier", explanation: "Short adjectives mein -er lagate hain Comparative ke liye. Happy → Happier (y → ier)." },
        { question: "Superlative of 'good'?", translation: "'Good' ki Superlative form?", options: ["gooder", "goodest", "better", "best"], answer: "best", explanation: "'Good' ek irregular adjective hai. Good → Better → Best." },
        { question: "Which is SUPERLATIVE: 'She is ___ girl in school'?", translation: "Kaun sa Superlative sahi hai?", options: ["a beautiful", "more beautiful", "the most beautiful", "beautifuler"], answer: "the most beautiful", explanation: "Long adjectives mein 'most' lagakar Superlative banate hain. 'The most beautiful' sahi hai." },
        { question: "Comparative of 'bad'?", translation: "'Bad' ki Comparative form?", options: ["badder", "baddest", "worse", "worst"], answer: "worse", explanation: "'Bad' irregular hai. Bad → Worse → Worst. 'Worse than' use hota hai comparison mein." },
        { question: "Which sentence uses POSITIVE degree?", translation: "Kaun sa sentence Positive Degree mein hai?", options: ["She is taller than him.", "She is the tallest.", "She is tall.", "She is more tall."], answer: "She is tall.", explanation: "Positive Degree mein sirf adjective use hota hai bina kisi comparison ke. 'She is tall' — Positive." }
      ]
    }
  },

  "expert-grammar": {
    1: {
      topic: "Day 1: Conditional Sentences (If Clauses)",
      explanation: "Conditional sentences 'if' se shuru hote hain aur kisi condition ka result batate hain. 4 types hote hain.",
      explanationTranslation: "Agar-toh wale sentences. Condition aur uska result batate hain.",
      rules: [
        "Zero Conditional (hamesha sach): If + Present, Present. If you heat water, it boils.",
        "First Conditional (possible future): If + Present, will + V1. If it rains, I will stay home.",
        "Second Conditional (unlikely/imaginary): If + Past, would + V1. If I were rich, I would travel.",
        "Third Conditional (past unreal): If + Past Perfect, would have + V3. If I had studied, I would have passed."
      ],
      examples: [
        { english: "If you study hard, you will pass. (1st Conditional)", translation: "Agar aap mehnat se padhoge, to pass karoge." },
        { english: "If I were a bird, I would fly. (2nd Conditional)", translation: "Agar main chidiya hota, toh ud jaata." },
        { english: "If she had come, we would have celebrated. (3rd Conditional)", translation: "Agar woh aati, toh hum celebrate karte." }
      ],
      questions: [
        { question: "Which is a FIRST CONDITIONAL sentence?", translation: "Kaun sa First Conditional hai?", options: ["If water boils, it evaporates.", "If it rains, I will stay home.", "If I were rich, I would travel.", "If she had come, we would have celebrated."], answer: "If it rains, I will stay home.", explanation: "First Conditional: If + Present Simple, will + V1. 'If it rains, I will stay home' — possible future situation." },
        { question: "Complete: 'If I ___ rich, I would help everyone.' (2nd Conditional)", translation: "2nd Conditional complete karo.", options: ["am", "was", "were", "will be"], answer: "were", explanation: "2nd Conditional mein Past Subjunctive use hota hai. 'I were' (not 'was') — imaginary situation." },
        { question: "Which is ZERO CONDITIONAL?", translation: "Kaun sa Zero Conditional hai?", options: ["If it rains, I will stay.", "If I were rich, I would travel.", "If you heat ice, it melts.", "If she had studied, she would have passed."], answer: "If you heat ice, it melts.", explanation: "Zero Conditional hamesha sach hoti hai — scientific facts. If + Present, Present." },
        { question: "3rd Conditional: 'If she ___ harder, she would have passed.'", translation: "3rd Conditional complete karo.", options: ["studies", "studied", "had studied", "will study"], answer: "had studied", explanation: "3rd Conditional: If + Past Perfect (had + V3), would have + V3. Past ki unreal situation." },
        { question: "What type: 'If you eat junk food, you gain weight'?", translation: "Yeh kaun sa conditional hai?", options: ["Zero", "First", "Second", "Third"], answer: "Zero", explanation: "Yeh Zero Conditional hai — ek sach jo hamesha hota hai (general truth/scientific fact)." }
      ]
    }
  }
};

// Day 2+ ke liye same structure, different content return karo
export function getStaticContent(moduleId: string, day: number, language: string = 'Hindi'): any {
  const moduleContent = STATIC_CONTENT[moduleId];
  if (!moduleContent) return null;

  // Day 1 ya 2 specific content hai, baaki ke liye Day 1 ko vary karke return karo
  if (moduleContent[day]) return moduleContent[day];

  // Day 1 base content se variation banao
  const base = moduleContent[1];
  if (!base) return null;

  return {
    ...base,
    topic: base.topic.replace('Day 1', `Day ${day}`),
    explanation: base.explanation,
    explanationTranslation: base.explanationTranslation,
  };
}
