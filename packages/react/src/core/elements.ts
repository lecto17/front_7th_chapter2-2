/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null => {
  // null, undefined, boolean은 렌더링하지 않음
  if (isEmptyValue(node)) {
    return null;
  }

  // 원시 타입(문자열, 숫자)은 텍스트 노드로 변환
  if (typeof node === "string" || typeof node === "number") {
    return createTextElement(node);
  }

  // 배열은 Fragment로 처리
  if (Array.isArray(node)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key, ...rest } = node;
    return createElement(Fragment, rest, node.props.children?.map(normalizeNode));
  }

  // 이미 VNode 형태면 그대로 반환
  return node;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (node: VNode): VNode => {
  return {
    type: TEXT_ELEMENT,
    key: null,
    props: { children: [], nodeValue: String(node) },
  };
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  // 1. key를 분리
  const key = originProps?.key ?? null;

  // 2. key를 제외한 나머지 props 복사
  const props: Record<string, any> = {};
  if (originProps) {
    for (const prop in originProps) {
      if (prop !== "key") {
        props[prop] = originProps[prop];
      }
    }
  }

  // 3. children 처리
  if (rawChildren.length > 0) {
    props.children = rawChildren
      .flat(Infinity)
      .map(normalizeNode)
      .filter((child) => child !== null);
  }

  // 4. VNode 반환
  return {
    type,
    key,
    props,
  } as VNode;
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  // 1. key가 있는 경우: key 기반 경로 생성
  if (key !== null) {
    return `${parentPath}.k${key}`;
  }

  // 2. key가 없는 경우: 타입에 따라 경로 생성
  // 2-1. 컴포넌트인 경우 (함수 타입)
  if (typeof nodeType === "function") {
    // 컴포넌트 이름 추출 (displayName 또는 name 속성 사용)
    const componentName = (nodeType as any).displayName || nodeType.name || "Component";

    // 같은 타입의 컴포넌트가 형제 중 몇 번째인지 카운트
    let typeCount = 0;
    if (siblings) {
      for (let i = 0; i < index && i < siblings.length; i++) {
        if (siblings[i]?.type === nodeType) {
          typeCount++;
        }
      }
    }

    return `${parentPath}.c${componentName}_${typeCount}`;
  }

  // 2-2. 일반 요소인 경우 (string 타입 또는 심볼)
  // index 기반 경로 생성
  return `${parentPath}.i${index}`;
};
