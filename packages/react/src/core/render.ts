import { context } from "./context";
// import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue, enqueue } from "../utils";
import { EffectHook } from "./types";
import { HookTypes } from "./constants";

/**
 * 큐에 있는 모든 effect를 실행합니다.
 * 렌더링 이후 비동기적으로 호출됩니다.
 */
export const flushEffects = (): void => {
  const effectsToRun = [...context.effects.queue];
  context.effects.queue.length = 0;

  effectsToRun.forEach(({ path, cursor }) => {
    const hooks = context.hooks.state.get(path);
    if (!hooks) {
      return;
    }

    const hook = hooks[cursor] as EffectHook | undefined;
    if (!hook || hook.kind !== HookTypes.EFFECT) {
      return;
    }

    // 이전 클린업 함수가 있으면 실행
    if (hook.cleanup) {
      hook.cleanup();
    }

    // 새로운 effect 실행 및 클린업 함수 저장
    const cleanup = hook.effect();
    hook.cleanup = cleanup || null;
  });
};

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  const { root } = context;
  if (!root.container || !root.node) {
    return;
  }

  // 1. 훅 컨텍스트를 초기화합니다.
  context.hooks.clear();

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  const newInstance = reconcile(root.container, root.instance, root.node, "");

  // 3. 새 인스턴스를 컨텍스트에 저장
  root.instance = newInstance;

  // 4. 사용되지 않은 훅들을 정리(cleanupUnusedHooks)합니다.
  cleanupUnusedHooks();

  // 5. 렌더링 이후 비동기적으로 effect를 실행합니다.
  enqueue(flushEffects);
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
