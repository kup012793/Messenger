# 사이 — 둘만의 실시간 메신저

Next.js, Supabase, Tailwind CSS로 만든 반응형 1:1 메신저입니다. 환경변수가 없으면 데모 모드로 바로 실행되며, Supabase를 연결하면 이메일 로그인, 실시간 메시지, 이미지 업로드, 링크 감지가 활성화됩니다.

## 로컬 실행

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Supabase 연결

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)을 실행합니다.
3. Authentication → URL Configuration에서 Site URL을 배포 주소로 지정하고, Redirect URLs에 로컬 주소와 Vercel 주소를 추가합니다.
4. Project Settings → API의 Project URL과 anon key를 `.env.local`에 입력합니다.
5. 친구 두 명이 각자 이메일 매직 링크로 로그인하면 같은 대화방을 사용합니다.

## Vercel 배포

GitHub 저장소를 Vercel에 연결한 뒤 다음 환경변수를 Production/Preview/Development에 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Build Command는 `npm run build`, Framework Preset은 Next.js를 사용합니다. 배포 후 생성된 주소를 Supabase Redirect URLs에도 추가해야 이메일 로그인이 돌아옵니다.

## 보안 참고

현재 스키마는 로그인한 사용자끼리 하나의 방을 공유합니다. 둘만 사용하는 경우 Supabase Authentication의 신규 가입을 닫고 두 계정만 미리 초대하세요. 사용자가 더 늘어나면 rooms/members 테이블을 추가해 RLS를 방 단위로 제한해야 합니다.
