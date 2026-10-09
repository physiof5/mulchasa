// 서식자료실 — 장기요양 관련 공식 서식 18종 (public/forms)
// 출처: 법제처 국가법령정보센터 별지 서식(노인장기요양보험법 시행규칙, 장기요양 관련 고시). 2026-10-09 정리.
// 법령·고시의 서식은 저작권 보호 대상이 아니어서(저작권법 제7조) 그대로 내려받을 수 있게 둔다.
// ⚠️ 서식은 개정될 수 있으므로 매년 1월·법령 개정 때 최신본으로 바꾼다.

export type FormCategory = 'apply' | 'after' | 'cost' | 'equipment' | 'appeal' | 'medical'

export const FORM_CATEGORIES: { key: FormCategory; label: string }[] = [
  { key: 'apply', label: '등급 신청' },
  { key: 'after', label: '등급 받은 뒤' },
  { key: 'cost', label: '비용·이용' },
  { key: 'equipment', label: '복지용구' },
  { key: 'appeal', label: '이의 신청' },
  { key: 'medical', label: '의료기관용' },
]

/** 누가 쓰는 서류인지 (보호자가 헷갈리지 않게) */
export type FormWriter = 'family' | 'agency' | 'clinic'
export const WRITER_LABEL: Record<FormWriter, string> = {
  family: '본인·가족이 작성',
  agency: '공단·관청이 발급',
  clinic: '병원이 작성',
}

export interface FormItem {
  id: string
  title: string
  official: string // 공식 서식 번호
  file: string // public/forms 안 파일 이름
  downloadName: string // 내려받을 때 파일 이름
  type: 'pdf' | 'hwp' | 'hwpx'
  pages?: number
  sizeKb: number
  category: FormCategory
  writer: FormWriter
  summary: string
  submitTo?: string
}

export const FORMS: FormItem[] = [
  // ── 등급 신청 ──
  {
    id: 'ltc-application',
    title: '장기요양인정 신청서',
    official: '노인장기요양보험법 시행규칙 별지 제1호의2서식',
    file: 'ltc-application.pdf',
    downloadName: '장기요양인정 신청서(별지 제1호의2서식).pdf',
    type: 'pdf', pages: 3, sizeKb: 127,
    category: 'apply', writer: 'family',
    summary: '장기요양등급을 처음 신청할 때 쓰는 기본 신청서예요. 등급 갱신, 등급 변경, 받는 서비스 종류를 바꿀 때도 같은 서식에 표시해서 써요. 가족이 대신 낼 수 있어요.',
    submitTo: '국민건강보험공단 지사',
  },
  {
    id: 'doctor-opinion',
    title: '의사소견서',
    official: '노인장기요양보험법 시행규칙 별지 제2호서식',
    file: 'doctor-opinion.pdf',
    downloadName: '의사소견서(별지 제2호서식).pdf',
    type: 'pdf', pages: 4, sizeKb: 118,
    category: 'apply', writer: 'clinic',
    summary: '의사가 부모님의 질병과 몸 상태를 적어 공단에 내는 서류예요. 신청서와 함께 내지 않고 나중에 내도 돼요. 보호자가 대신 진료받아서는 쓸 수 없어서, 부모님이 직접(외래·입원·방문) 진료를 받아야 해요.',
    submitTo: '국민건강보험공단 (병원에서 발급)',
  },
  {
    id: 'doctor-opinion-request',
    title: '의사소견서 발급의뢰서',
    official: '노인장기요양보험법 시행규칙 별지 제3호서식',
    file: 'doctor-opinion-request.pdf',
    downloadName: '의사소견서 발급의뢰서(별지 제3호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 51,
    category: 'apply', writer: 'agency',
    summary: '등급을 신청하면 공단이 주는 의뢰서예요. 병원에 이 의뢰서를 내면 의사소견서 발급 비용의 일부만 내면 돼요(일반 20%, 감경 대상·일부 의료급여 수급자 10%, 기초생활수급자 면제).',
    submitTo: '의사소견서를 받을 병원',
  },
  {
    id: 'benefit-start-exception',
    title: '장기요양급여 제공시기 예외 적용 신청서',
    official: '노인장기요양보험법 시행규칙 별지 제18호서식',
    file: 'benefit-start-exception.pdf',
    downloadName: '장기요양급여 제공시기 예외 적용 신청서(별지 제18호서식).pdf',
    type: 'pdf', pages: 2, sizeKb: 81,
    category: 'apply', writer: 'family',
    summary: '장기요양 서비스는 보통 인정서를 받은 뒤부터 적용돼요. 함께 사는 가족이 없거나 미성년자·65세 이상 노인만 함께 사는 경우, 이 신청서를 내면 처음 등급을 신청한 날부터 적용받을 수 있어요.',
    submitTo: '국민건강보험공단 지사',
  },
  {
    id: 'proxy-designation',
    title: '대리인 지정서',
    official: '노인장기요양보험법 시행규칙 별지 제9호서식',
    file: 'proxy-designation.pdf',
    downloadName: '대리인 지정서(별지 제9호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 36,
    category: 'apply', writer: 'agency',
    summary: '도와줄 가족이 없을 때 시장·군수·구청장이 지정한 사람이 대신 신청할 수 있게 하는 지정서예요. 가족이 대신 신청할 때는 이 서식 없이 신분증 등으로 할 수 있어요.',
    submitTo: '시·군·구청 발급 → 공단 제출',
  },

  // ── 등급 받은 뒤 ──
  {
    id: 'ltc-certificate',
    title: '장기요양인정서',
    official: '노인장기요양보험법 시행규칙 별지 제6호서식',
    file: 'ltc-certificate.pdf',
    downloadName: '장기요양인정서(별지 제6호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 50,
    category: 'after', writer: 'agency',
    summary: '등급이 나오면 공단이 보내 주는 \'등급 증명서\' 양식이에요. 등급·유효기간·받을 수 있는 서비스가 적혀 있고, 기관과 계약할 때 보여 줘요. 갱신 신청은 유효기간이 끝나기 90일 전부터 30일 전까지 해요.',
  },
  {
    id: 'care-plan',
    title: '개인별장기요양이용계획서',
    official: '노인장기요양보험법 시행규칙 별지 제7호서식',
    file: 'care-plan.pdf',
    downloadName: '개인별장기요양이용계획서(별지 제7호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 50,
    category: 'after', writer: 'agency',
    summary: '인정서와 함께 오는 이용 계획서 양식이에요. 월 한도액, 본인부담률, 필요한 서비스가 적혀 있어요. 기관과 계약할 때 함께 보여 줘요.',
  },
  {
    id: 'ltc-survey',
    title: '장기요양인정조사표',
    official: '노인장기요양보험법 시행규칙 별지 제5호서식 (2025.12.12. 개정)',
    file: 'ltc-survey.pdf',
    downloadName: '장기요양인정조사표(별지 제5호서식).pdf',
    type: 'pdf', pages: 8, sizeKb: 124,
    category: 'after', writer: 'agency',
    summary: '공단 직원이 집으로 방문조사를 올 때 쓰는 조사표예요. 몸 기능, 사회생활 기능, 인지, 행동 변화, 간호 처치, 재활, 집 환경까지 무엇을 보는지 미리 알아 두면 준비에 도움이 돼요.',
  },

  // ── 비용·이용 ──
  {
    id: 'copay-reduction',
    title: '본인부담금 감경신청서',
    official: '장기요양 본인부담금 감경에 관한 고시 별지 제1호서식',
    file: 'copay-reduction.hwp',
    downloadName: '본인부담금 감경신청서.hwp',
    type: 'hwp', sizeKb: 55,
    category: 'cost', writer: 'family',
    summary: '건강보험료·재산이 기준 이하라서 장기요양 본인부담금을 줄여(감경) 받고 싶을 때 내는 신청서예요. 노인장기요양보험 누리집에서도 신청할 수 있고, 대상인지 모르겠으면 공단(1577-1000)에 먼저 물어보세요.',
    submitTo: '국민건강보험공단 지사',
  },
  {
    id: 'facility-use-application',
    title: '장기요양기관 입소·이용신청서',
    official: '노인장기요양보험법 시행규칙 별지 제10호서식',
    file: 'facility-use-application.pdf',
    downloadName: '장기요양기관 입소·이용신청서(별지 제10호서식).pdf',
    type: 'pdf', pages: 2, sizeKb: 80,
    category: 'cost', writer: 'family',
    summary: '의료급여를 받는 분이 요양원·주간보호센터 같은 장기요양기관을 이용(입소)하려고 할 때 내는 신청서예요. 처음 이용, 갱신, 변경, 해지 때 써요.',
    submitTo: '시·군·구청',
  },
  {
    id: 'family-care-cash',
    title: '가족요양비 지급 신청서',
    official: '노인장기요양보험법 시행규칙 별지 제17호서식',
    file: 'family-care-cash.pdf',
    downloadName: '가족요양비 지급 신청서(별지 제17호서식).pdf',
    type: 'pdf', pages: 3, sizeKb: 108,
    category: 'cost', writer: 'family',
    summary: '섬·벽지에 살거나 천재지변, 감염병·정신장애 등으로 기관 서비스를 받기 어려워 가족이 돌볼 때, 현금(가족요양비)을 받기 위한 신청서예요.',
    submitTo: '국민건강보험공단 지사',
  },
  {
    id: 'special-cash-account',
    title: '특별현금급여수급계좌 입금신청서',
    official: '노인장기요양보험법 시행규칙 별지 제18호의2서식',
    file: 'special-cash-account.pdf',
    downloadName: '특별현금급여수급계좌 입금신청서(별지 제18호의2서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 89,
    category: 'cost', writer: 'family',
    summary: '가족요양비 같은 현금 급여를 압류가 막힌 전용 통장(수급계좌)으로 받고 싶을 때 내는 신청서예요.',
    submitTo: '국민건강보험공단 지사',
  },

  // ── 복지용구 ──
  {
    id: 'equipment-confirmation',
    title: '복지용구 급여확인서',
    official: '복지용구 급여범위 및 급여기준 등에 관한 고시 별지 제1호서식 (2025.7.10. 개정)',
    file: 'equipment-confirmation.hwpx',
    downloadName: '복지용구 급여확인서.hwpx',
    type: 'hwpx', sizeKb: 13,
    category: 'equipment', writer: 'agency',
    summary: '공단이 발급하는 확인서로, 사거나 빌릴 수 있는 복지용구 품목이 적혀 있어요. 1년에 160만 원(본인부담금 포함) 안에서 이용하고, 넘는 금액은 전액 본인이 내요. 복지용구 사업소에 보여 줘요.',
  },
  {
    id: 'equipment-additional',
    title: '복지용구 추가급여신청서',
    official: '복지용구 급여범위 및 급여기준 등에 관한 고시 별지 제2호서식',
    file: 'equipment-additional.hwpx',
    downloadName: '복지용구 추가급여신청서.hwpx',
    type: 'hwpx', sizeKb: 17,
    category: 'equipment', writer: 'family',
    summary: '몸 상태가 바뀌었거나 쓰던 복지용구가 망가져서, 정해진 사용 기간 안이라도 다시 받고 싶을 때 내는 신청서예요.',
    submitTo: '국민건강보험공단 지사',
  },

  // ── 이의 신청 ──
  {
    id: 'review-request',
    title: '심사청구서',
    official: '노인장기요양보험법 시행규칙 별지 제32호서식',
    file: 'review-request.pdf',
    downloadName: '심사청구서(별지 제32호서식).pdf',
    type: 'pdf', pages: 2, sizeKb: 50,
    category: 'appeal', writer: 'family',
    summary: '등급 판정 등 공단의 결정에 동의하기 어려울 때 다시 살펴봐 달라고 내는 청구서예요. 등급 판정 결과는 통보받은 날부터 90일 안에 증명서류와 함께 낼 수 있어요.',
    submitTo: '국민건강보험공단',
  },
  {
    id: 're-review-request',
    title: '재심사청구서',
    official: '노인장기요양보험법 시행규칙 별지 제37호서식',
    file: 're-review-request.pdf',
    downloadName: '재심사청구서(별지 제37호서식).pdf',
    type: 'pdf', pages: 2, sizeKb: 57,
    category: 'appeal', writer: 'family',
    summary: '심사청구 결과에도 동의하기 어려울 때 한 번 더 판단을 받는 청구서예요. 보건복지부(장기요양재심사위원회)가 결정해요.',
    submitTo: '보건복지부 장기요양재심사위원회',
  },

  // ── 의료기관용 ──
  {
    id: 'home-nursing-order-doctor',
    title: '방문간호지시서 (의사·한의사용)',
    official: '노인장기요양보험법 시행규칙 별지 제29호서식',
    file: 'home-nursing-order-doctor.pdf',
    downloadName: '방문간호지시서(의사·한의사용)(별지 제29호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 57,
    category: 'medical', writer: 'clinic',
    summary: '간호사가 집으로 와서 하는 방문간호를 받으려면 필요한 지시서예요. 의사·한의사가 써 주고, 발급일부터 180일 동안 쓸 수 있어요.',
  },
  {
    id: 'home-nursing-order-dentist',
    title: '방문간호지시서 (치과의사용)',
    official: '노인장기요양보험법 시행규칙 별지 제30호서식',
    file: 'home-nursing-order-dentist.pdf',
    downloadName: '방문간호지시서(치과의사용)(별지 제30호서식).pdf',
    type: 'pdf', pages: 1, sizeKb: 50,
    category: 'medical', writer: 'clinic',
    summary: '치과위생사 등이 집으로 와서 입안 관리(치아 세균막 관리 등)를 하는 방문간호에 필요한 치과의사 지시서예요.',
  },
]

export const FORMS_SOURCE = '법제처 국가법령정보센터 별지 서식 (2026년 10월 정리)'
