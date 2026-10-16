// 서버 전용: 웹 푸시 보내기 (알림 API·매일 예약 작업이 함께 씀)
// 알림 글에는 건강 정보·대화 내용을 넣지 않는다.
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
export const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:spacex2025@naver.com'

export const WHO: Record<string, string> = { mother: '어머님', father: '아버님', spouse: '배우자', self: '본인', other: '가족' }

export interface Payload {
  title: string
  body: string
  url: string
  tag?: string
}

export const recent = (iso: string, minutes: number) => Date.now() - new Date(iso).getTime() < minutes * 60_000

export async function sendToUsers(userIds: string[], payload: Payload): Promise<number> {
  if (!PUBLIC_KEY || !PRIVATE_KEY || userIds.length === 0) return 0
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds)
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
          urgency: 'high',
        })
        sent++
        await supabaseAdmin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 사라진 기기(앱 삭제·알림 해제) → 지움
        if (code === 404 || code === 410) await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id)
        else console.error('push send error:', code, e)
      }
    })
  )
  return sent
}

