// 서비스 워커 — 알림(웹 푸시) 전용
// 화면·데이터는 저장(캐시)하지 않는다: 늘 최신 화면을 보여 주고, 지난 화면이 남는 문제를 막기 위해.
// 알림 내용에는 건강 정보·대화 내용을 넣지 않는다(잠금 화면 노출 대비). 서버가 제목·짧은 안내·이동할 주소만 보낸다.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 예전 버전(mulchasa-v1)이 만든 저장 공간 정리
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: '보호가 필요해', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '보호가 필요해'
  const url = data.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // 그 대화방을 지금 보고 있으면 알림을 띄우지 않음
      const watching = list.some((c) => {
        try {
          return c.focused && c.visibilityState === 'visible' && new URL(c.url).pathname === url
        } catch {
          return false
        }
      })
      if (watching) return undefined
      return self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url },
      })
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // 이미 열린 앱 창이 있으면 그 창에서 이동, 없으면 새로 열기
      for (const c of list) {
        if ('focus' in c && new URL(c.url).origin === self.location.origin) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : undefined))
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
