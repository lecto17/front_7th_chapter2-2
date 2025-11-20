import { shallowEquals } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  const { state, visited } = context.hooks;

  // state에 있는 모든 경로를 순회
  const pathsToCleanup: string[] = [];

  state.forEach((hooks, path) => {
    // visited에 없는 경로는 더 이상 사용되지 않는 컴포넌트
    if (!visited.has(path)) {
      pathsToCleanup.push(path);

      // 해당 경로의 모든 훅을 순회하며 cleanup 함수 실행
      hooks.forEach((hook) => {
        if (hook && typeof hook === "object" && "kind" in hook && hook.kind === HookTypes.EFFECT) {
          const effectHook = hook as EffectHook;
          if (effectHook.cleanup) {
            effectHook.cleanup();
          }
        }
      });
    }
  });

  // 사용되지 않는 경로의 상태 제거
  pathsToCleanup.forEach((path) => {
    state.delete(path);
  });
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 컴포넌트의 훅 커서와 상태 배열을 가져옵니다.
  const { currentPath, currentCursor, currentHooks } = context.hooks;

  // 2. 첫 렌더링이라면 초기값으로 상태를 설정합니다.
  if (currentHooks[currentCursor] === undefined) {
    currentHooks[currentCursor] = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;

    // 상태 배열을 context에 저장
    context.hooks.state.set(currentPath, currentHooks);
  }

  const value = currentHooks[currentCursor] as T;

  // 3. 상태 변경 함수(setter)를 생성합니다.
  // 클로저 문제를 피하기 위해 path와 cursor를 캡처
  const capturedPath = currentPath;
  const capturedCursor = currentCursor;

  const setState = (nextValue: T | ((prev: T) => T)) => {
    // 현재 상태 가져오기
    const hooks = context.hooks.state.get(capturedPath);
    if (!hooks) return;

    const currentValue = hooks[capturedCursor] as T;

    // 새 값 계산 (함수면 실행, 아니면 그대로 사용)
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(currentValue) : nextValue;

    // Object.is로 비교하여 같으면 재렌더링을 건너뜁니다.
    // 새 값이 이전 값과 같으면(Object.is) 재렌더링을 건너뜁니다.
    if (Object.is(currentValue, newValue)) {
      return;
    }

    // 값이 다르면 상태를 업데이트하고 재렌더링을 예약(enqueueRender)합니다.
    hooks[capturedCursor] = newValue;
    context.hooks.state.set(capturedPath, hooks);
    enqueueRender();
  };

  // 4. 훅 커서를 증가시키고 [상태, setter]를 반환합니다.
  context.hooks.cursor.set(currentPath, currentCursor + 1);

  return [value, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 1. 현재 컴포넌트의 훅 커서와 상태 배열을 가져옵니다.
  const { currentPath, currentCursor, currentHooks } = context.hooks;

  // 2. 이전 훅의 의존성 배열과 현재 의존성 배열을 비교합니다.
  const prevHook = currentHooks[currentCursor] as EffectHook | undefined;

  // 3. 의존성이 변경되었거나 첫 렌더링일 경우, 이펙트 실행을 예약합니다.
  let shouldRunEffect = false;

  if (!prevHook) {
    // 첫 렌더링
    shouldRunEffect = true;
  } else if (!deps) {
    // deps가 없으면 매번 실행
    shouldRunEffect = true;
  } else if (!prevHook.deps) {
    // 이전에는 deps가 없었는데 지금은 있으면 실행
    shouldRunEffect = true;
  } else if (!shallowEquals(prevHook.deps, deps)) {
    // deps가 변경되었으면 실행
    shouldRunEffect = true;
  }

  // 4. 이펙트 훅 데이터 저장
  const effectHook: EffectHook = {
    kind: HookTypes.EFFECT,
    deps: deps || null,
    cleanup: prevHook?.cleanup || null,
    effect,
  };

  currentHooks[currentCursor] = effectHook;
  context.hooks.state.set(currentPath, currentHooks);

  // 5. 이펙트 실행을 예약 (렌더링 후 비동기로 실행)
  if (shouldRunEffect) {
    context.effects.queue.push({
      path: currentPath,
      cursor: currentCursor,
    });
  }

  // 6. 훅 커서 증가
  context.hooks.cursor.set(currentPath, currentCursor + 1);
};
