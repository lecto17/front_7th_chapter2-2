import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT } from "./constants";
import { Instance, VNode } from "./types";
import {
  getFirstDom,
  getFirstDomFromChildren,
  insertInstance,
  removeInstance,
  setDomProps,
  updateDomProps,
} from "./dom";
import { createChildPath } from "./elements";
// import { isEmptyValue } from "../utils";

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  // 1. 새 노드가 null이면 기존 인스턴스를 제거합니다. (unmount)
  if (node === null) {
    if (instance) {
      removeInstance(parentDom, instance);
    }
    return null;
  }

  // 2. 기존 인스턴스가 없으면 새 노드를 마운트합니다. (mount)
  if (instance === null) {
    const { type, props, key } = node;

    // TEXT_ELEMENT 처리
    if (type === TEXT_ELEMENT) {
      const dom = document.createTextNode(props.nodeValue || "");
      const newInstance: Instance = {
        kind: NodeTypes.TEXT,
        dom,
        node,
        children: [],
        key,
        path,
      };
      insertInstance(parentDom, newInstance, null);
      return newInstance;
    }

    // Fragment 처리
    if (type === Fragment) {
      const children: (Instance | null)[] = [];
      const childNodes = props?.children || [];

      childNodes.forEach((child: VNode, index: number) => {
        const childPath = createChildPath(path, child.key, index, child.type, childNodes);
        const childInstance = reconcile(parentDom, null, child, childPath);
        children.push(childInstance);
      });

      const newInstance: Instance = {
        kind: NodeTypes.FRAGMENT,
        dom: getFirstDomFromChildren(children),
        node,
        children,
        key,
        path,
      };
      return newInstance;
    }

    // 컴포넌트 처리 (함수 타입)
    if (typeof type === "function") {
      const Component = type as React.ComponentType;

      // 컴포넌트 경로를 스택에 추가
      context.hooks.componentStack.push(path);
      context.hooks.cursor.set(path, 0);
      context.hooks.visited.add(path); // 이 컴포넌트가 렌더링되었음을 기록

      try {
        // 컴포넌트 함수 실행
        const childNode = Component(props);

        // 자식 VNode 재조정
        const childPath = childNode ? createChildPath(path, childNode.key, 0, childNode.type, [childNode]) : path;
        const childInstance = reconcile(parentDom, null, childNode, childPath);

        const newInstance: Instance = {
          kind: NodeTypes.COMPONENT,
          dom: getFirstDom(childInstance),
          node,
          children: childInstance ? [childInstance] : [],
          key,
          path,
        };

        return newInstance;
      } finally {
        // 컴포넌트 경로를 스택에서 제거
        context.hooks.componentStack.pop();
      }
    }

    // 일반 DOM 요소 처리 (string 타입)
    const dom = document.createElement(type as string);
    const newInstance: Instance = {
      kind: NodeTypes.HOST,
      dom,
      node,
      children: [],
      key,
      path,
    };

    // 속성 설정
    setDomProps(dom, props);

    // 자식 처리
    const childNodes = props?.children || [];
    const children: (Instance | null)[] = [];

    childNodes.forEach((child: VNode, index: number) => {
      const childPath = createChildPath(path, child.key, index, child.type, childNodes);
      const childInstance = reconcile(dom, null, child, childPath);
      children.push(childInstance);
    });

    newInstance.children = children;

    // DOM에 삽입
    insertInstance(parentDom, newInstance, null);

    return newInstance;
  }

  // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
  if (instance.node.type !== node.type || instance.key !== node.key) {
    removeInstance(parentDom, instance);
    // 재귀 호출로 마운트
    return reconcile(parentDom, null, node, path);
  }

  // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  const { type, props } = node;

  // TEXT_ELEMENT 업데이트
  if (type === TEXT_ELEMENT) {
    if (instance.dom && instance.dom instanceof Text) {
      instance.dom.textContent = props.nodeValue || "";
    }
    instance.node = node;
    return instance;
  }

  // Fragment 업데이트
  if (type === Fragment) {
    const childNodes = props?.children || [];
    const newChildren: (Instance | null)[] = [];
    const oldChildren = instance.children || [];

    childNodes.forEach((child: VNode, index: number) => {
      const childPath = createChildPath(path, child.key, index, child.type, childNodes);
      const oldChildInstance = oldChildren[index] || null;
      const newChildInstance = reconcile(parentDom, oldChildInstance, child, childPath);
      newChildren.push(newChildInstance);
    });

    // 남은 자식 제거
    for (let i = childNodes.length; i < oldChildren.length; i++) {
      if (oldChildren[i]) {
        removeInstance(parentDom, oldChildren[i]!);
      }
    }

    instance.children = newChildren;
    instance.dom = getFirstDomFromChildren(newChildren);
    instance.node = node;
    return instance;
  }

  // 컴포넌트 업데이트
  if (typeof type === "function") {
    const Component = type as React.ComponentType;

    // 컴포넌트 경로를 스택에 추가
    context.hooks.componentStack.push(path);
    const prevCursor = context.hooks.cursor.get(path) || 0;
    context.hooks.cursor.set(path, 0);
    context.hooks.visited.add(path); // 이 컴포넌트가 렌더링되었음을 기록

    try {
      // 컴포넌트 함수 재실행
      const childNode = Component(props);

      // 자식 재조정
      const oldChildInstance = instance.children[0] || null;
      const childPath = childNode ? createChildPath(path, childNode.key, 0, childNode.type, [childNode]) : path;
      const newChildInstance = reconcile(parentDom, oldChildInstance, childNode, childPath);

      instance.children = newChildInstance ? [newChildInstance] : [];
      instance.dom = getFirstDom(newChildInstance);
      instance.node = node;

      return instance;
    } finally {
      // 컴포넌트 경로를 스택에서 제거
      context.hooks.componentStack.pop();
      context.hooks.cursor.set(path, prevCursor);
    }
  }

  // 일반 DOM 요소 업데이트
  if (instance.dom && instance.dom instanceof HTMLElement) {
    // 추가 검증: 실제로 Element인지 확인
    if (!(instance.dom instanceof Element)) {
      console.error("reconcile: instance.dom is not an Element", {
        dom: instance.dom,
        domType: (instance.dom as Element)?.constructor?.name,
        nodeType: (instance.dom as Element)?.nodeType,
        instance,
        node,
      });
      return instance;
    }
    updateDomProps(instance.dom, instance.node.props, props);

    const childNodes = props?.children || [];
    const newChildren: (Instance | null)[] = [];
    const oldChildren = instance.children || [];

    childNodes.forEach((child: VNode, index: number) => {
      const childPath = createChildPath(path, child.key, index, child.type, childNodes);
      const oldChildInstance = oldChildren[index] || null;
      const newChildInstance = reconcile(instance.dom as HTMLElement, oldChildInstance, child, childPath);
      newChildren.push(newChildInstance);
    });

    // 남은 자식 제거
    for (let i = childNodes.length; i < oldChildren.length; i++) {
      if (oldChildren[i]) {
        removeInstance(instance.dom as HTMLElement, oldChildren[i]!);
      }
    }

    instance.children = newChildren;
    instance.node = node;
  }

  return instance;
};
