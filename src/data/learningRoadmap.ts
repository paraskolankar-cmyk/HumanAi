/**
 * 90-Day Learning Roadmap
 * ------------------------
 * Maps each of the 9 Learning-section categories across 90 days using
 * spaced repetition (Vocabulary + one grammar topic every day, so
 * vocabulary compounds daily while grammar topics progress in a
 * sensible foundational -> advanced order). Every 6th day is a
 * cumulative review + test day covering that week's topics.
 *
 * This file is pure DATA (no AI call needed to generate it) — the
 * actual lesson CONTENT for each day is generated once by Gemini and
 * cached in Turso via /api/learning/content/[day].ts, so this roadmap
 * only decides WHICH topic each day covers.
 */

export type TopicId =
  | 'vocabulary'
  | 'grammar_essentials'
  | 'tenses_structure'
  | 'synonyms_antonyms'
  | 'noun_pronoun'
  | 'verbs'
  | 'voice_narration'
  | 'advanced_grammar'
  | 'expert_grammar';

export interface DayPlan {
  day: number;
  // Vocabulary runs every single day (10 new words/day, compounding).
  vocabularyDay: true;
  // The grammar-family topic focused on this day.
  grammarTopic: TopicId;
  // true on review/test days (every 6th day) — content for that day is a
  // cumulative test instead of new material.
  isReviewDay: boolean;
}

const GRAMMAR_TOPIC_SEQUENCE: TopicId[] = [
  'grammar_essentials',   // Days 1-15ish: absolute basics first
  'noun_pronoun',
  'verbs',
  'tenses_structure',
  'synonyms_antonyms',
  'voice_narration',
  'advanced_grammar',
  'expert_grammar'
];

export const TOPIC_LABELS: Record<TopicId, string> = {
  vocabulary: 'Vocabulary',
  grammar_essentials: 'Grammar Essentials',
  tenses_structure: 'Tenses & Structure',
  synonyms_antonyms: 'Synonyms & Antonyms',
  noun_pronoun: 'Noun & Pronoun',
  verbs: 'Verbs (V1 - V4)',
  voice_narration: 'Voice & Narration',
  advanced_grammar: 'Advanced Grammar',
  expert_grammar: 'Expert Grammar'
};

export function buildNinetyDayRoadmap(): DayPlan[] {
  const roadmap: DayPlan[] = [];
  let topicIndex = 0;
  let daysOnCurrentTopic = 0;
  // Roughly ~9 non-review days per topic across the 8 grammar topics
  // (8 topics * 9 days = 72 content days + review days fills out to 90).
  const DAYS_PER_TOPIC = 9;

  for (let day = 1; day <= 90; day++) {
    const isReviewDay = day % 6 === 0;

    if (isReviewDay) {
      roadmap.push({
        day,
        vocabularyDay: true,
        grammarTopic: GRAMMAR_TOPIC_SEQUENCE[Math.min(topicIndex, GRAMMAR_TOPIC_SEQUENCE.length - 1)],
        isReviewDay: true
      });
      continue;
    }

    roadmap.push({
      day,
      vocabularyDay: true,
      grammarTopic: GRAMMAR_TOPIC_SEQUENCE[Math.min(topicIndex, GRAMMAR_TOPIC_SEQUENCE.length - 1)],
      isReviewDay: false
    });

    daysOnCurrentTopic++;
    if (daysOnCurrentTopic >= DAYS_PER_TOPIC && topicIndex < GRAMMAR_TOPIC_SEQUENCE.length - 1) {
      topicIndex++;
      daysOnCurrentTopic = 0;
    }
  }

  return roadmap;
}

export const NINETY_DAY_ROADMAP = buildNinetyDayRoadmap();
