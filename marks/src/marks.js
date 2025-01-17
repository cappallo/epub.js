import svg from './svg';
import events from './events';
import { useReaderStore } from '../../../src/store/readerStore';

export class Pane {
  constructor(target, container = document.body) {
    this.target = target;
    this.element = svg.createElement('svg');
    this.marks = [];

    // Match the coordinates of the target element
    this.element.style.position = 'absolute';
    // Disable pointer events
    this.element.setAttribute('pointer-events', 'none');

    // Set up mouse event proxying between the target element and the marks
    events.proxyMouse(this.target, this.marks);

    this.container = container;
    this.container.appendChild(this.element);

    this.render();
  }

  addMark(mark) {
    var g = svg.createElement('g');
    this.element.appendChild(g);
    mark.bind(g, this.container);

    this.marks.push(mark);

    mark.render();
    return mark;
  }

  removeMark(mark) {
    var idx = this.marks.indexOf(mark);
    if (idx === -1) {
      return;
    }
    var el = mark.unbind();
    this.element.removeChild(el);
    this.marks.splice(idx, 1);
  }

  render() {
    setCoords(this.element, coords(this.target, this.container));
    for (var m of this.marks) {
      m.render();
    }
  }
}

export class Mark {
  constructor() {
    this.element = null;
  }

  bind(element, container) {
    this.element = element;
    this.container = container;
  }

  unbind() {
    var el = this.element;
    this.element = null;
    return el;
  }

  render() {}

  dispatchEvent(e) {
    if (!this.element) return;
    this.element.dispatchEvent(e);
  }

  getBoundingClientRect() {
    return this.element.getBoundingClientRect();
  }

  getClientRects() {
    var rects = [];
    var el = this.element.firstChild;
    while (el) {
      rects.push(el.getBoundingClientRect());
      el = el.nextSibling;
    }
    return rects;
  }

  filteredRanges() {
    if (!this.range) {
      return [];
    }

    // De-duplicate the boxes
    const rects = Array.from(this.range.getClientRects());
    const stringRects = rects.map((r) => JSON.stringify(r));
    const setRects = new Set(stringRects);
    return Array.from(setRects).map((sr) => JSON.parse(sr));
  }
}

/**
 * Adjusts the tops and bottoms of rectangles to align them, covering slight gaps or removing slight overlaps.
 * Ensures that large gaps (e.g., the height of a rectangle or more) are not adjusted to prevent highlighting blank lines.
 *
 * @param {Array} rects - Array of rectangle objects with top, bottom, left, right, height, and width properties.
 * @param {number} threshold - Maximum gap or overlap allowed for adjustment.
 * @returns {Array} - Adjusted array of rectangle objects.
 */
function adjustRectangles(rects, threshold) {
  const adjusted = [];
  for (let i = 0; i < rects.length; i++) {
    if (i === 0) {
      adjusted.push({ ...rects[i] });
      continue;
    }
    const prev = adjusted[adjusted.length - 1];
    const current = rects[i];
    const gap = current.top - prev.top - prev.height;
    const overlap = prev.top + prev.height - current.top;

    if (gap >= 0 && gap < threshold) {
      // Cover the slight gap by extending the previous rectangle
      adjusted[adjusted.length - 1].height += gap;
    } else if (overlap > 0 && overlap < threshold) {
      // Remove the slight overlap by adjusting the previous rectangle's height
      adjusted[adjusted.length - 1].height -= overlap;
    }

    adjusted.push({ ...current });
  }
  return adjusted;
}

export class Highlight extends Mark {
  constructor(range, className, data, attributes) {
    super();
    this.range = range;
    this.className = className;
    this.data = data || {};
    this.attributes = attributes || {};
  }

  bind(element, container) {
    super.bind(element, container);

    for (var attr in this.data) {
      if (this.data.hasOwnProperty(attr)) {
        this.element.dataset[attr] = this.data[attr];
      }
    }

    for (var attr in this.attributes) {
      if (this.attributes.hasOwnProperty(attr)) {
        this.element.setAttribute(attr, this.attributes[attr]);
      }
    }

    if (this.className) {
      this.element.classList.add(this.className);
    }
  }

  /**
   * Renders the highlight by creating and appending SVG rectangles.
   * Adjusts rectangle positions to align tops and bottoms, avoiding large gaps.
   */
  render() {
    // Empty element
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    const docFrag = this.element.ownerDocument.createDocumentFragment();
    let filtered = this.filteredRanges().sort(
      (a, b) => a.top - b.top || a.height - b.height || a.left - b.left || a.width - b.width
    );
    const offset = this.element.getBoundingClientRect();
    const container = this.container.getBoundingClientRect();
    const lineSpacing = useReaderStore.getState().lineSpacing;
    const actualFontSize = useReaderStore.getState().fontSize;

    // Merge adjacent rectangles on the same line
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < filtered.length - 1; i++) {
        const rect1 = filtered[i];
        const rect2 = filtered[i + 1];

        // Check if rectangles are on same line and adjacent
        const sameTop = Math.abs(rect1.top - rect2.top) < 0.1;
        const sameHeight = Math.abs(rect1.height - rect2.height) < 0.1;
        const adjacent = Math.abs(rect1.left + rect1.width - rect2.left) < 0.1;

        if (sameTop && sameHeight && adjacent) {
          // Merge the rectangles
          filtered[i] = {
            top: rect1.top,
            left: rect1.left,
            height: rect1.height,
            width: rect1.width + rect2.width,
          };
          // Remove the second rectangle
          filtered.splice(i + 1, 1);
          merged = true;
          break;
        }
      }
    }

    // Filter out unwanted rectangles
    filtered = filtered.filter((rect, index, array) => {
      // Keep track if this rectangle should be kept
      let shouldKeep = true;

      array.forEach((otherRect, otherIndex) => {
        if (index === otherIndex) return; // Skip comparing with self

        // Check if the other rectangle's center point is inside this rectangle
        const otherCenterX = otherRect.left + otherRect.width / 2;
        const otherCenterY = otherRect.top + otherRect.height / 2;

        if (
          otherCenterX >= rect.left &&
          otherCenterX <= rect.left + rect.width &&
          otherCenterY >= rect.top &&
          otherCenterY <= rect.top + rect.height
        ) {
          // If this rectangle is larger than the other one, mark it for removal
          if (rect.width * rect.height > otherRect.width * otherRect.height) {
            shouldKeep = false;
          }
        }
      });

      return shouldKeep;
    });

    // Calculate line spacing if actualFontSize is available but lineSpacing is not set
    // if (actualFontSize && !lineSpacing && filtered.length > 1) {
    //   const uniqueTops = [...new Set(filtered.map((r) => r.top))].sort((a, b) => a - b);
    //   if (uniqueTops.length > 1) {
    //     const topDiff = uniqueTops[1] - uniqueTops[0];
    //     lineSpacing = topDiff / actualFontSize;
    //   }
    // }

    // Adjust rectangles to align tops and bottoms
    const threshold = actualFontSize || 12; // Example threshold based on font size
    filtered = adjustRectangles(filtered, threshold);

    // Final rect rendering
    for (let i = 0, len = filtered.length; i < len; i++) {
      const r = filtered[i];
      const el = svg.createElement('rect');

      let newHeight = r.height;
      let newY = r.top - offset.top + container.top;

      el.setAttribute('x', r.left - offset.left + container.left);
      el.setAttribute('y', newY);
      el.setAttribute('height', newHeight);
      el.setAttribute('width', r.width);

      docFrag.appendChild(el);
    }

    this.element.appendChild(docFrag);
  }
}

export class Underline extends Highlight {
  constructor(range, className, data, attributes) {
    super(range, className, data, attributes);
  }

  render() {
    // Empty element
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    var docFrag = this.element.ownerDocument.createDocumentFragment();
    var filtered = this.filteredRanges();
    var offset = this.element.getBoundingClientRect();
    var container = this.container.getBoundingClientRect();

    for (var i = 0, len = filtered.length; i < len; i++) {
      var r = filtered[i];

      var rect = svg.createElement('rect');
      rect.setAttribute('x', r.left - offset.left + container.left);
      rect.setAttribute('y', r.top - offset.top + container.top);
      rect.setAttribute('height', r.height);
      rect.setAttribute('width', r.width);
      rect.setAttribute('fill', 'none');

      var line = svg.createElement('line');
      line.setAttribute('x1', r.left - offset.left + container.left);
      line.setAttribute('x2', r.left - offset.left + container.left + r.width);
      line.setAttribute('y1', r.top - offset.top + container.top + r.height - 1);
      line.setAttribute('y2', r.top - offset.top + container.top + r.height - 1);

      line.setAttribute('stroke-width', 1);
      line.setAttribute('stroke', 'black'); //TODO: match text color?
      line.setAttribute('stroke-linecap', 'square');

      docFrag.appendChild(rect);

      docFrag.appendChild(line);
    }

    this.element.appendChild(docFrag);
  }
}

function coords(el, container) {
  var offset = container.getBoundingClientRect();
  var rect = el.getBoundingClientRect();

  return {
    top: rect.top - offset.top,
    left: rect.left - offset.left,
    height: el.scrollHeight,
    width: el.scrollWidth,
  };
}

function setCoords(el, coords) {
  el.style.setProperty('top', `${coords.top}px`, 'important');
  el.style.setProperty('left', `${coords.left}px`, 'important');
  el.style.setProperty('height', `${coords.height}px`, 'important');
  el.style.setProperty('width', `${coords.width}px`, 'important');
}

function contains(rect1, rect2) {
  return (
    rect2.right <= rect1.right && rect2.left >= rect1.left && rect2.top >= rect1.top && rect2.bottom <= rect1.bottom
  );
}
