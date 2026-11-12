/**
 * A table of contents that does not fit one page continues on further pages.
 *
 * `groupByFit` is the pure part (it only asks "does this group still fit?"),
 * `paginateToc` measures with the real layout and rebuilds the leaves.
 */

/**
 * Greedily fill groups of items.
 * @template T
 * @param {T[]} items
 * @param {(group: T[], groupIndex: number) => boolean} fits  would this group fit a page?
 * @returns {T[][]} every group holds at least one item, so this always terminates
 */
export function groupByFit(items, fits) {
  const groups = [];
  let current = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length > 0 && !fits(candidate, groups.length)) {
      groups.push(current);
      current = [item];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Spread the entries of the table of contents leaf over as many leaves as needed.
 * The first leaf keeps the title; continuation leaves only list entries. The
 * "add chapter" button moves to the last leaf, at the bottom of the page.
 *
 * @param {HTMLElement} tocLeaf   the `.page-num.num-start` leaf
 * @param {HTMLElement} host      element inside the sheet to measure in
 * @param {{width:number,height:number}} leafSize
 * @param {(info: object) => void} [report]  receives what was measured, for diagnostics
 * @returns {HTMLElement[]} the table of contents leaves, in order
 */
export function paginateToc(tocLeaf, host, leafSize, report) {
  const list = tocLeaf.querySelector("nav.pages-list > ol");
  if (!list) return [tocLeaf];
  const items = [...list.children];
  if (items.length < 2) return [tocLeaf];

  const button = tocLeaf.querySelector(".create");

  const makeProbe = (continuation, withButton = false) => {
    const probe = tocLeaf.cloneNode(true);
    Object.assign(probe.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: `${leafSize.width}px`,
      height: `${leafSize.height}px`,
      visibility: "hidden",
      pointerEvents: "none",
    });
    probe.querySelector("nav.pages-list > ol").replaceChildren();
    if (continuation) probe.querySelector(".journal-header")?.remove();
    if (!withButton) probe.querySelector(".create")?.remove();
    host.appendChild(probe);
    return probe;
  };

  const probes = [makeProbe(false), makeProbe(true)];
  // The list itself never scrolls (the CSS makes it overflow: visible), so the page
  // area (the nav element) is what overflows. Do not also test the list: the margin
  // after its last entry makes it a pixel or two "taller" than it is.
  const overflows = (probe) => {
    const nav = probe.querySelector("nav.pages-list");
    return nav.scrollHeight > nav.clientHeight + 1;
  };

  if (report) {
    // what does the first page look like when it holds the first few entries?
    const probe = probes[0];
    const nav = probe.querySelector("nav.pages-list");
    const ol = nav.querySelector(":scope > ol");
    ol.replaceChildren(...items.slice(0, 4).map((li) => li.cloneNode(true)));
    const box = (el) => ({ client: el.clientHeight, scroll: el.scrollHeight, css: getComputedStyle(el).height });
    report({
      page: { width: leafSize.width, height: leafSize.height },
      leaf: box(probe),
      nav: { ...box(nav), overflowY: getComputedStyle(nav).overflowY },
      ol: { ...box(ol), overflow: getComputedStyle(ol).overflow },
      entryHeights: [...ol.children].map((li) => Math.round(li.getBoundingClientRect().height)),
      firstEntry: ol.firstElementChild?.outerHTML.replace(/\s+/g, " ").slice(0, 700),
    });
  }

  const fill = (probe, group) =>
    probe.querySelector("nav.pages-list > ol").replaceChildren(...group.map((li) => li.cloneNode(true)));

  let groups;
  try {
    groups = groupByFit(items, (group, groupIndex) => {
      const probe = probes[groupIndex === 0 ? 0 : 1];
      fill(probe, group);
      return !overflows(probe);
    });

    // The button sits at the bottom of the last page: make room, or start a new page for it.
    if (button) {
      for (;;) {
        const last = groups.length - 1;
        const probe = makeProbe(last > 0, true);
        probes.push(probe);
        fill(probe, groups[last]);
        if (!overflows(probe) || groups[last].length < 2) break;
        groups.push([groups[last].pop()]);
      }
    }
  } finally {
    probes.forEach((probe) => probe.remove());
  }
  if (groups.length < 2) return [tocLeaf];

  const leaves = [tocLeaf];
  list.replaceChildren(...groups[0]);
  groups.slice(1).forEach((group, i) => {
    const leaf = tocLeaf.cloneNode(true);
    leaf.classList.add("st-toc-continued");
    leaf.querySelector(".journal-header")?.remove();
    leaf.querySelector(".create")?.remove(); // a clone without the listeners; the real one moves below
    leaf.querySelector("nav.pages-list > ol").replaceChildren(...group);
    leaves[i].after(leaf);
    leaves.push(leaf);
  });

  // keep the original button (it has Foundry's click listener) and put it on the last page
  if (button && leaves.length > 1) leaves.at(-1).querySelector(".content-inner")?.appendChild(button);
  return leaves;
}
