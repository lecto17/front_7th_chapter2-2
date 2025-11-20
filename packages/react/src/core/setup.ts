import { context } from "./context";
import { VNode } from "./types";
import { removeInstance } from "./dom";
import { cleanupUnusedHooks } from "./hooks";
import { render, flushEffects } from "./render";
import { enqueue } from "../utils";

/**
 * Mini-React 애플리케이션의 루트를 설정하고 첫 렌더링을 시작합니다.
 *
 * @param rootNode - 렌더링할 최상위 VNode
 * @param container - VNode가 렌더링될 DOM 컨테이너
 */
export const setup = (rootNode: VNode | null, container: HTMLElement): void => {
  // 여기를 구현하세요.
  // 1. 컨테이너 유효성을 검사합니다.
  if (!(container instanceof HTMLElement) || rootNode === null) {
    throw new Error("컨테이너가 없습니다");
  }

  const {
    root: { container: prevContainer, instance: prevInstance },
  } = context;

  // 2. 이전 렌더링 내용을 정리하고 컨테이너를 비웁니다.
  if (prevContainer && prevInstance) {
    removeInstance(prevContainer, prevInstance);
  }

  cleanupUnusedHooks();
  container.replaceChildren();

  // 3. 루트 컨텍스트와 훅 컨텍스트를 리셋합니다.
  context.root.reset({ container, node: rootNode });
  context.hooks.clear(); // cursor, visited, componentStack 초기화
  context.hooks.state.clear(); // setup에서는 state도 완전히 초기화 (테스트 간 격리)
  context.effects.queue.length = 0;

  // 4. 첫 렌더링을 실행합니다.
  render();

  // 5. 렌더링 이후 비동기적으로 effect를 실행합니다.
  enqueue(flushEffects);
};
