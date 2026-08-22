import type { Plot, Recommendation } from './types'

export type AssistantLanguage = 'en' | 'sw'
export type AssistantIntent = 'volume' | 'rain' | 'stage' | 'sensor'

export const assistantText = {
  en: {
    fabLabel: 'Ask AXIS AI', fabAria: 'Ask AXIS AI Assistant', title: 'AXIS AI Assistant', subtitle: 'Grounded agronomic Q&A', close: 'Close Assistant',
    quick: 'Quick questions', expand: 'Expand quick questions', collapse: 'Collapse quick questions', send: 'Send', thinking: 'Thinking…', loading: 'Generating explanation…',
    placeholder: 'Ask AXIS a question…', offlinePlaceholder: 'AI questions are unavailable offline', unavailablePlaceholder: 'Live AI is unavailable',
    offline: 'AI questions are unavailable while offline. Quick questions still work.', unavailable: 'Live AI is unavailable. Quick questions still work.',
    error: 'AXIS AI is temporarily unavailable. Your irrigation recommendation is unchanged.', retry: 'Retry', aiLabel: 'AI-generated explanation', localLabel: 'Deterministic AXIS explanation',
    disclaimer: 'The deterministic AXIS recommendation is authoritative. Explanations never change its litres, runtime, or action.',
    greeting: (plot?: Plot) => plot ? `You are asking about ${plot.name}. I will use only this plot's saved AXIS recommendation.` : 'Select a plot so AXIS can explain its saved recommendation.',
    questions: { volume: 'Why did my water volume change today?', rain: 'How did rain forecast affect my plot?', stage: 'Explain crop growth stage water needs', sensor: "Why didn't soil moisture change after irrigation?" }
  },
  sw: {
    fabLabel: 'Uliza AXIS AI', fabAria: 'Uliza Msaidizi wa AXIS AI', title: 'Msaidizi wa AXIS AI', subtitle: 'Maswali na majibu ya kilimo yenye msingi wa data', close: 'Funga Msaidizi',
    quick: 'Maswali ya haraka', expand: 'Panua maswali ya haraka', collapse: 'Kunja maswali ya haraka', send: 'Tuma', thinking: 'Inafikiria…', loading: 'Inatayarisha maelezo…',
    placeholder: 'Uliza AXIS swali…', offlinePlaceholder: 'Maswali ya AI hayapatikani bila intaneti', unavailablePlaceholder: 'AI ya moja kwa moja haipatikani',
    offline: 'Maswali ya AI hayapatikani ukiwa nje ya mtandao. Maswali ya haraka bado yanafanya kazi.', unavailable: 'AI ya moja kwa moja haipatikani. Maswali ya haraka bado yanafanya kazi.',
    error: 'AXIS AI haipatikani kwa muda. Pendekezo lako la umwagiliaji halijabadilika.', retry: 'Jaribu tena', aiLabel: 'Maelezo yaliyotolewa na AI', localLabel: 'Maelezo ya uhakika ya AXIS',
    disclaimer: 'Pendekezo la uhakika la AXIS ndilo lenye mamlaka. Maelezo hayabadilishi lita, muda, au hatua yake.',
    greeting: (plot?: Plot) => plot ? `Unauliza kuhusu ${plot.name}. Nitatumia tu pendekezo lililohifadhiwa la shamba hili.` : 'Chagua shamba ili AXIS iweze kueleza pendekezo lake lililohifadhiwa.',
    questions: { volume: 'Kwa nini kiasi cha maji kilibadilika leo?', rain: 'Utabiri wa mvua uliathirije shamba?', stage: 'Eleza mahitaji ya hatua ya ukuaji', sensor: 'Kwa nini unyevu wa udongo haukubadilika baada ya umwagiliaji?' }
  }
} as const

function normalized(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsAny(value: string, anchors: string[]) {
  return anchors.some(anchor => value.includes(anchor))
}

export function matchAssistantIntent(query: string): AssistantIntent | undefined {
  const value = normalized(query)
  if (containsAny(value, ['soil moisture', 'soil humidity', 'unyevu wa udongo']) && containsAny(value, ['irrigation', 'irrigated', 'watering', 'umwagiliaji', 'kumwagilia'])) return 'sensor'
  if (containsAny(value, ['rain', 'rainfall', 'precipitation', 'mvua'])) return 'rain'
  if (containsAny(value, ['growth stage', 'crop stage', 'crop age', 'stage', 'hatua ya ukuaji', 'hatua ya zao', 'umri wa zao'])) return 'stage'
  if (containsAny(value, ['water volume', 'water amount', 'volume', 'litres', 'liters', 'kiasi cha maji', 'lita', 'kiwango cha maji'])) return 'volume'
  return undefined
}

export function deterministicAnswer(intent: AssistantIntent, rec: Recommendation, language: AssistantLanguage): string {
  const litres = rec.decision.litres.toLocaleString()
  const target = (rec.decision.daily_target_litres ?? rec.decision.litres).toLocaleString()
  const applied = (rec.decision.applied_today_litres ?? 0).toLocaleString()
  if (intent === 'rain') return language === 'sw'
    ? `Utabiri uliohifadhiwa ni mm ${rec.weather.rain_next_24h_mm} za mvua. Mvua ilipunguza lengo kwa Lita ${rec.decision.rain_adjustment_litres.toLocaleString()}. Lengo la leo ni Lita ${target}, zimetumika ${applied}, na zimebaki ${litres}.`
    : `The saved forecast is ${rec.weather.rain_next_24h_mm} mm of rain. Rain reduced the target by ${rec.decision.rain_adjustment_litres.toLocaleString()} litres. Today's target is ${target} litres, ${applied} are logged, and ${litres} remain.`
  if (intent === 'stage') return language === 'sw'
    ? `Zao liko katika hatua ya ${rec.crop_stage.display_name}, siku ya ${rec.crop_stage.crop_age_days}. Kipengele cha hatua hii tayari kimetumika katika lengo la uhakika la Lita ${target}.`
    : `The crop is in the ${rec.crop_stage.display_name} stage, at crop age day ${rec.crop_stage.crop_age_days}. That stage factor is already included in the authoritative ${target}-litre daily target.`
  if (intent === 'sensor') {
    const response = rec.sensor_context?.irrigation_response
    if (!response) return language === 'sw' ? 'Hakuna vipimo vinavyofaa kabla na baada ya umwagiliaji kwa ulinganisho huu.' : 'There are no usable before-and-after sensor readings for this comparison.'
    return language === 'sw'
      ? `Lita ${response.irrigation_litres.toLocaleString()} ziliandikwa. Unyevu ulisoma ${response.before_water_content_pct}% kabla na ${response.after_water_content_pct}% baada (${response.change_percentage_points} pointi). Hii ni taarifa ya kukagua, si utambuzi wa hitilafu, na haijabadilisha pendekezo.`
      : `${response.irrigation_litres.toLocaleString()} litres were logged. Soil moisture read ${response.before_water_content_pct}% before and ${response.after_water_content_pct}% after (${response.change_percentage_points} percentage points). This is a factual check, not a fault diagnosis, and it did not change the recommendation.`
  }
  return language === 'sw'
    ? `Lengo la uhakika la leo ni Lita ${target}. Lita ${applied} tayari zimeandikwa, kwa hivyo Lita ${litres} zimebaki${rec.decision.duration_minutes !== undefined ? ` kwa takriban dakika ${rec.decision.duration_minutes}` : ''}.`
    : `Today's authoritative target is ${target} litres. ${applied} litres are already logged, so ${litres} litres remain${rec.decision.duration_minutes !== undefined ? ` for about ${rec.decision.duration_minutes} minutes` : ''}.`
}
