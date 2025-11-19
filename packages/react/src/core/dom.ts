/* eslint-disable @typescript-eslint/no-explicit-any */
// import { NodeType, NodeTypes } from "./constants";
import { Instance } from "./types";

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  // Text 노드가 아닌 Element인지 확인
  if (!(dom instanceof Element)) {
    console.error("setDomProps: dom is not an Element", {
      dom,
      domType: (dom as Element)?.constructor?.name,
      nodeType: (dom as Element)?.nodeType,
    });
    return;
  }

  Object.keys(props).forEach((key) => {
    if (key === "children") return; // children은 제외

    const value = props[key];

    if (key.startsWith("on")) {
      // 이벤트 핸들러
      const eventName = key.slice(2).toLowerCase();
      dom.addEventListener(eventName, value);
    } else if (key === "className") {
      if (dom instanceof Element) {
        dom.setAttribute("class", value);
      }
    } else if (key === "style" && typeof value === "object") {
      // 스타일 객체 처리
      if (dom instanceof HTMLElement) {
        Object.keys(value).forEach((styleKey) => {
          dom.style.setProperty(styleKey, value[styleKey]);
        });
      }
    } else {
      if (dom instanceof Element) {
        dom.setAttribute(key, value);
      }
    }
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  // Text 노드가 아닌 Element인지 확인
  if (!(dom instanceof Element)) {
    console.error("updateDomProps: dom is not an Element", {
      dom,
      domType: (dom as Element)?.constructor?.name,
      nodeType: (dom as Element)?.nodeType,
    });
    return;
  }

  try {
    // 이전 속성 제거
    // getAttributeNames()는 Element에만 있으므로 안전하게 사용 가능
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);

    // 이전에 있던 속성 중 다음에 없는 속성 제거
    prevKeys.forEach((key) => {
      if (key === "children") return; // children은 제외
      if (!(key in nextProps)) {
        // 속성 제거 로직
        if (key.startsWith("on")) {
          // 이벤트 핸들러 제거
          const eventName = key.slice(2).toLowerCase();
          dom.removeEventListener(eventName, prevProps[key]);
        } else if (key === "className") {
          if (dom instanceof Element) {
            dom.removeAttribute("class");
          }
        } else if (key === "style" && typeof prevProps[key] === "object") {
          // 스타일 객체의 모든 속성 제거
          if (dom instanceof HTMLElement) {
            Object.keys(prevProps[key]).forEach((styleKey) => {
              dom.style.removeProperty(styleKey);
            });
          }
        } else {
          if (dom instanceof Element) {
            dom.removeAttribute(key);
          }
        }
      }
    });

    // 새로운 속성 설정
    nextKeys.forEach((key) => {
      if (key === "children") return; // children은 제외
      const prevValue = prevProps[key];
      const nextValue = nextProps[key];

      if (prevValue === nextValue) return; // 변경 없음

      if (key.startsWith("on")) {
        // 이벤트 핸들러
        if (prevValue) {
          const eventName = key.slice(2).toLowerCase();
          dom.removeEventListener(eventName, prevValue);
        }
        if (nextValue) {
          const eventName = key.slice(2).toLowerCase();
          dom.addEventListener(eventName, nextValue);
        }
      } else if (key === "className") {
        if (dom instanceof Element) {
          dom.setAttribute("class", nextValue);
        }
      } else if (key === "style" && typeof nextValue === "object") {
        // 스타일 객체 처리
        if (dom instanceof HTMLElement) {
          if (prevValue && typeof prevValue === "object") {
            // 이전 스타일 속성 제거
            Object.keys(prevValue).forEach((styleKey) => {
              if (!(styleKey in nextValue)) {
                dom.style.removeProperty(styleKey);
              }
            });
          }
          // 새로운 스타일 속성 설정
          Object.keys(nextValue).forEach((styleKey) => {
            dom.style.setProperty(styleKey, nextValue[styleKey]);
          });
        }
      } else {
        if (dom instanceof Element) {
          dom.setAttribute(key, nextValue);
        }
      }
    });
  } catch (error) {
    console.error("updateDomProps error:", error, {
      dom,
      domType: dom?.constructor?.name,
      nodeType: dom?.nodeType,
      prevProps,
      nextProps,
    });
    throw error;
  }
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  if (!instance) return [];

  const nodes: (HTMLElement | Text)[] = [];

  // 직접 DOM이 있으면 추가
  if (instance.dom) {
    nodes.push(instance.dom);
  }

  // 자식들의 DOM 노드들도 재귀적으로 수집
  if (instance.children) {
    instance.children.forEach((child) => {
      if (child) {
        nodes.push(...getDomNodes(child));
      }
    });
  }

  return nodes;
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  if (!instance) return null;

  // 직접 DOM이 있으면 반환
  if (instance.dom) {
    return instance.dom;
  }

  // 자식들 중에서 첫 번째 DOM 찾기
  if (instance.children) {
    for (const child of instance.children) {
      if (child) {
        const dom = getFirstDom(child);
        if (dom) return dom;
      }
    }
  }

  return null;
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  for (const child of children) {
    if (child) {
      const dom = getFirstDom(child);
      if (dom) return dom;
    }
  }
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  if (!instance) return;

  const domNodes = getDomNodes(instance);

  if (domNodes.length === 0) return;

  if (anchor) {
    // anchor 앞에 삽입
    const firstNode = domNodes[0];
    parentDom.insertBefore(firstNode, anchor);

    // 나머지 노드들도 순서대로 삽입
    for (let i = 1; i < domNodes.length; i++) {
      parentDom.insertBefore(domNodes[i], anchor);
    }
  } else {
    // 맨 끝에 추가
    domNodes.forEach((node) => {
      parentDom.appendChild(node);
    });
  }
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  if (!instance) return;

  // 모든 DOM 노드를 가져와서 제거
  const domNodes = getDomNodes(instance);

  domNodes.forEach((node) => {
    if (node.parentNode === parentDom) {
      parentDom.removeChild(node);
    }
  });
};
