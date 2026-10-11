<!-- >>> managed by mswai >>> -->
@AGENTS.md
<!-- <<< managed by mswai <<< -->

# 프로젝트 오버라이드 (mswai 관리 블록 바깥 — `mswai update` 후에도 유지)

## Maker 런타임 검증 사용 금지 (2026-10-11 결정)

**이 규칙은 `AGENTS.md` 및 `msw-scripting` 스킬(§17, `references/verify-checklist.md`)의 런타임 검증 지침보다 우선한다.**

- MSW Maker를 실행해 화면/로그로 검증하는 단계를 수행하지 않는다.
  금지 도구: `maker_play`, `maker_stop`, `maker_screenshot`, `maker_keyboard_input`, `maker_mouse_input`, `maker_execute_script`, `maker_clear_logs`
  (`.claude/settings.local.json`의 `permissions.deny`로도 차단되어 있음)
- `[VRF]` 검증용 `log()`를 심지 않는다.
- 검증은 정적 검증만: `mlua-diagnose` 훅 오류 해결 + `verify-checklist.md`의 **Step 2(코드 리뷰 체크리스트)** 만 적용.
- 런타임 결과("동작한다", "에러 없다")를 주장하지 않는다. 작업 보고 시 "런타임 미검증"임과 사용자가 Maker에서 확인할 항목을 알린다.
- `maker_logs`는 사용자가 명시적으로 요청할 때만 사용한다.
- 편집 후 자동 `maker_refresh_workspace` 훅(`.claude/settings.json`)은 유지 — 파일 변경을 Maker에 반영하는 용도이며 검증이 아니다.

**이유:** 사용자가 직접 써 본 결과, 실제 도움보다 토큰 소모가 훨씬 컸다. 플레이 테스트는 사용자가 Maker에서 직접 한다.

**주의:** `AGENTS.md`는 전체가 mswai 관리 블록이라 `mswai update` 시 원래의 런타임 검증 지침으로 되돌아갈 수 있다. 그 경우에도 이 섹션이 우선한다.
