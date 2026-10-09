import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '개인정보처리방침',
}

// ── 운영자 정보 ──────────
const SERVICE = '보호가 필요해 앱(가칭)'
const OPERATOR = {
  company: '새로고침',
  ceo: '송민준',
  officer: '송민준',
  email: 'spacex2025@naver.com',
}
const EFFECTIVE_DATE = '2026년 10월 9일'

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto min-h-screen bg-white px-5 py-10 text-gray-800">
      <Link href="/" className="text-[15px] text-gray-500">← 홈으로</Link>

      <h1 className="text-[26px] font-extrabold text-gray-900 mt-6">개인정보처리방침</h1>
      <p className="text-[16px] text-gray-600 mt-3 leading-relaxed">
        {OPERATOR.company}(이하 &lsquo;운영자&rsquo;)는 {SERVICE}(이하 &lsquo;서비스&rsquo;)를 운영하면서
        「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고, 관련 고충을 빠르게 처리하기 위해
        다음과 같이 개인정보처리방침을 두고 있습니다.
      </p>
      <p className="text-[14px] text-gray-400 mt-2">시행일: {EFFECTIVE_DATE}</p>

      <Section n={1} title="처리하는 개인정보와 목적">
        <Table
          head={['구분', '처리 항목', '목적']}
          rows={[
            ['사전 신청 (보호자·전문가)', '이름, 휴대폰 번호, 지역, 선택한 도움·서비스 항목, 메모 / (보호자) 받고 싶은 장소(집·운동센터) / (전문가) 활동 방식(방문·운동센터), 운동센터 이름, 이동 수단, 활동 시간대', '서비스 오픈 소식 안내, 서비스 연결 안내 연락'],
            ['방문 운동 지도 요청서 (보호자)', '호칭, 연락처(휴대폰 또는 카카오 오픈채팅 주소), 방문 주소(상세주소 포함), 희망 시간, 메모', '운동 지도 전문가 연결 및 연락'],
            ['요청서의 건강 정보 (민감정보)', '불편한 부위, 증상 기간·상태, 통증 정도, 메모 중 건강 관련 내용', '전문가가 상황을 이해하고 알맞은 운동 지도를 제안'],
            ['전문가 회원 가입·프로필', '이름, 이메일, 휴대폰 번호, 물리치료사 면허번호, 경력, 활동 유형·지역·좌표, 소속(병원·스튜디오), 카카오 오픈채팅 주소, 소개글, 자격증, 프로필 사진, 활동 가능 시간', '면허 확인, 프로필 공개, 승인 안내 문자 발송'],
            ['후기 작성', '닉네임, 별점, 후기 내용, 첨부 사진', '전문가 후기 공개'],
            ['스팸 방지', '접속 IP를 되돌릴 수 없게 변환한 값(IP 원문은 저장하지 않음), 제출 시각', '반복·자동 등록 방지'],
          ]}
        />
        <p>건강 정보(민감정보)는 다른 항목과 <b>별도로 동의</b>를 받은 경우에만 처리합니다.</p>
      </Section>

      <Section n={2} title="보유 기간과 파기">
        <Table
          head={['구분', '보유 기간']}
          rows={[
            ['사전 신청', '서비스 오픈 안내 후 1년, 또는 삭제 요청 시까지'],
            ['요청서 (건강 정보 포함)', '요청 마감 후 6개월, 또는 삭제 요청 시까지'],
            ['전문가 회원 정보', '탈퇴 시까지'],
            ['후기', '작성자의 삭제 요청 또는 운영 정책에 따른 삭제 시까지'],
            ['스팸 방지용 변환 값', '해당 신청·요청서와 함께 파기'],
          ]}
        />
        <p>
          보유 기간이 끝나거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로
          삭제하며, 다른 법령에 따라 보관해야 하는 경우에는 그 기간 동안 따로 보관합니다.
        </p>
      </Section>

      <Section n={3} title="개인정보의 제3자 제공">
        <p>운영자는 이용자의 동의가 있거나 법령에 근거가 있는 경우에만 개인정보를 제3자에게 제공합니다.</p>
        <Table
          head={['받는 자', '제공 항목', '목적', '보유 기간']}
          rows={[
            ['요청 지역이 맞는 등록 전문가(물리치료사)', '시·구 단위 지역, 건강 정보, 희망 시간 (연락처·상세주소 제외)', '요청 내용 확인 및 제안', '요청 마감 시까지'],
            ['요청을 수락한 전문가 1인', '호칭, 연락처, 상세 주소, 건강 정보, 희망 시간', '방문 일정 조율 및 운동 지도', '해당 서비스 종료 시까지'],
          ]}
        />
      </Section>

      <Section n={4} title="처리 위탁과 국외 이전">
        <p>원활한 서비스 운영을 위해 다음 업체에 개인정보 처리를 맡기고 있습니다.</p>
        <Table
          head={['수탁자', '맡기는 업무', '국가']}
          rows={[
            ['Supabase, Inc.', '데이터베이스·파일 저장 (저장 위치: 대한민국 서울 리전)', '미국 법인'],
            ['Vercel, Inc.', '웹사이트 호스팅, 접속 기록 처리', '미국 등'],
            ['주식회사 카카오', '입력한 주소를 좌표로 변환, 지도 표시', '대한민국'],
            ['솔라피(SOLAPI)', '전문가 승인 안내 문자 발송', '대한민국'],
            ['Anthropic, PBC', '전문가용 AI 브랜딩 진단 답변 처리 (저장하지 않음)', '미국'],
          ]}
        />
        <p>
          국외 업체에는 서비스 이용 시점에 네트워크를 통해 정보가 전송되며, 위 위탁 업무 수행 기간 동안 처리됩니다.
          국외 이전을 원하지 않으시면 해당 기능을 이용하지 않거나 아래 문의처로 요청해 주세요.
          이 경우 일부 서비스 이용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section n={5} title="이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있으며, 동의를 철회할 수 있습니다.
          아래 문의 이메일로 요청하시면 지체 없이 처리하고 결과를 알려 드립니다.
        </p>
      </Section>

      <Section n={6} title="자동으로 저장되는 정보">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>내 위치</b>: &lsquo;현재 위치로 설정&rsquo;을 누르면 좌표가 이용자 기기(브라우저 저장소)에만 저장되며,
            운영자 데이터베이스에는 저장하지 않습니다. 다만 거리순 검색 시 검색 화면 주소(URL)에 좌표가 포함되어
            호스팅 업체의 접속 기록에 남을 수 있습니다.
          </li>
          <li><b>요청서 확인 정보</b>: 계정 없이 내 요청서를 다시 볼 수 있도록 확인용 값을 기기에 저장합니다.</li>
          <li><b>관리자 로그인 쿠키</b>: 운영자 화면 로그인에만 사용합니다.</li>
          <li>광고·행태 분석 목적의 쿠키나 추적 도구는 사용하지 않습니다.</li>
        </ul>
        <p>브라우저 설정에서 저장된 정보를 언제든 지울 수 있습니다.</p>
      </Section>

      <Section n={7} title="안전성 확보 조치">
        <ul className="list-disc pl-5 space-y-1">
          <li>모든 통신 암호화(HTTPS)</li>
          <li>데이터베이스 접근 제한(행 단위 보안 정책), 관리자 기능은 서버에서만 인증</li>
          <li>IP 등 식별 정보는 원문 대신 되돌릴 수 없는 값으로 저장</li>
          <li>개인정보 접근 권한을 운영자로 최소화</li>
        </ul>
      </Section>

      <Section n={8} title="만 14세 미만 아동">
        <p>서비스는 만 14세 미만 아동의 개인정보를 받지 않습니다.</p>
      </Section>

      <Section n={9} title="개인정보 보호책임자와 문의처">
        <ul className="space-y-1">
          <li>개인정보 보호책임자: {OPERATOR.officer}</li>
          <li>이메일: {OPERATOR.email}</li>
          <li>운영자: {OPERATOR.company} (대표 {OPERATOR.ceo})</li>
        </ul>
        <p className="mt-2">
          개인정보 침해에 대한 상담은 개인정보침해신고센터(국번 없이 118), 개인정보분쟁조정위원회(1833-6972)에도
          문의하실 수 있습니다.
        </p>
      </Section>

      <Section n={10} title="방침의 변경">
        <p>이 방침이 바뀌는 경우 시행 7일 전부터 서비스 화면을 통해 알려 드립니다.</p>
      </Section>
    </main>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[19px] font-bold text-gray-900 mb-3">
        {n}. {title}
      </h2>
      <div className="text-[16px] leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[14px] border-collapse min-w-[520px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left bg-gray-50 border border-gray-200 p-2 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className="align-top border border-gray-200 p-2">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
