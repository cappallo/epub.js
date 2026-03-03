export declare class Pane {
  element: SVGElement;
  marks: Mark[];
  constructor(target: Element, container?: Element);
  addMark(mark: Mark): Mark;
  removeMark(mark: Mark): void;
  render(): void;
}

export declare class Mark {
  element: Element | null;
  bind(element: Element, container: Element): void;
  unbind(): Element;
  render(): void;
  dispatchEvent(e: Event): void;
  getBoundingClientRect(): DOMRect;
  getClientRects(): DOMRect[];
  filteredRanges(): DOMRect[];
}

export declare class Highlight extends Mark {
  range: Range;
  className: string;
  data: Record<string, unknown>;
  attributes: Record<string, string>;
  constructor(
    range: Range,
    className?: string,
    data?: Record<string, unknown>,
    attributes?: Record<string, string>
  );
}

export declare class Underline extends Highlight {}
