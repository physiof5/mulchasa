'use client'

import { useEffect, useState } from 'react'

type BlogPost = {
  id: string
  title: string
  link: string
  thumbnail: string | null
  category: string
  publishedAt: string
}

const BLOG_URL = 'https://blog.naver.com/spacex_2025'

export default function BlogFeed({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/blog-feed')
      .then((r) => r.json())
      .then((d) => setPosts((d.posts ?? []).slice(0, limit)))
      .catch(() => setFailed(true))
  }, [limit])

  // 불러오기 실패 또는 글이 없으면 영역 자체를 숨김
  if (failed || (posts && posts.length === 0)) return null

  return (
    <section className="px-5 pt-4 pb-4">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[13px] font-medium" style={{ color: '#0F6E56' }}>
            물리치료사·사회복지사가 정리했어요
          </div>
          <h2 className="text-lg font-bold text-gray-900">보호가 필요해 최신 글</h2>
        </div>
        <a
          href={BLOG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] text-gray-500 py-2 pl-3"
        >
          전체 보기 ›
        </a>
      </div>

      {posts === null ? (
        // 불러오는 동안 보여줄 회색 자리
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[96px] rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {posts.map((p) => (
            <a
              key={p.id}
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 bg-white border border-gray-100 rounded-2xl p-3 min-h-[96px] active:scale-[0.98] transition-all"
            >
              {p.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover shrink-0 bg-gray-100"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span
                  className="self-start text-[12px] px-2 py-0.5 rounded-md mb-1"
                  style={{ background: '#E1F5EE', color: '#0F6E56' }}
                >
                  {p.category}
                </span>
                <div className="text-[16px] font-bold text-gray-900 leading-snug line-clamp-2">
                  {p.title}
                </div>
                <div className="text-[13px] text-gray-400 mt-1">
                  {new Date(p.publishedAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}