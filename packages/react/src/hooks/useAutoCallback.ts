import type { AnyFunction } from "../types";
import { useCallback } from "./useCallback";
import { useRef } from "./useRef";

/**
 * 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백을 생성합니다.
 *
 * @param fn - 최신 상태를 참조할 함수
 * @returns 참조가 안정적인 콜백 함수
 */
export const useAutoCallback = <T extends AnyFunction>(fn: T): T => {
  // useRef를 사용하여 최신 함수를 저장합니다.
  const fnRef = useRef<T>(fn);

  // 매 렌더링마다 최신 함수로 업데이트합니다.
  fnRef.current = fn;

  // useCallback으로 안정적인 참조를 가진 래퍼 함수를 반환합니다.
  // 이 래퍼 함수는 항상 fnRef.current를 호출하므로 최신 함수를 실행합니다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback(((...args: any[]) => fnRef.current(...args)) as T, []);
};
