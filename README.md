# github란?
오픈소스 sw를 공유하고 기여할 수 있는 대중적인 공간으로, 버전관리를 위해 git를 사용하는 협업 플랫폼이다
# repository란?
파일 및 폴더를 포함하는 프로젝트이다
# branch란?
repository의 병렬 버전이다. 
repositorysms 기본적으로 하나의 branch가 있고, 추가 branch를 만들면 리포지토리의 branch를 복사하고 기본 프로젝트를 중단 없이 안전하게 변경 할 수 있다. 
즉, 브랜치(Branch)를 통해 하나의 프로젝트를 여러 갈래로 나누어서 관리할 수 있다.

## 미국 증시 마감 카드뉴스

한국 시간 화~토 오전 7시 15분에 시세와 RSS 뉴스를 수집하고 Pages를 배포합니다. 카드 순서는 한눈에 보기 → 지수 → 11개 섹터 ETF → AI·반도체 → 채권·자산 → 일정입니다.

자동 AI 요약은 GitHub 저장소의 Settings → Secrets and variables → Actions에서 `OPENAI_API_KEY`를 Repository secret으로 등록하면 활성화됩니다. ChatGPT 구독과 별개인 OpenAI API 키이며 API 사용 요금이 발생합니다. 키를 소스 코드나 Cloudflare 공개 변수에 넣지 마세요. 기본 모델은 `gpt-4.1-mini`이며 `scripts/refresh_editorial.py`에서 설정합니다.

AI에는 수집된 시세와 뉴스 제목만 제공합니다. 기사 본문이나 장중 고점은 자동 수집하지 않습니다. 키가 없거나 모델 요청이 실패하면 시세 기반 요약을 표시하고 이전 AI 요약을 재사용하지 않습니다. 한국·미국의 확정 당일 경제지표·실적 일정은 아직 데이터 API를 연결하지 않아 공식 일정 링크를 제공합니다.
