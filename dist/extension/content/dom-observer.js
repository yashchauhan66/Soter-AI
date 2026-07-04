export function currentPromptTarget(adapter) {
    const targets = adapter.getPromptTargets();
    const focused = document.activeElement instanceof HTMLElement
        ? targets.find((target) => target.element === document.activeElement || target.element.contains(document.activeElement))
        : null;
    return focused ?? targets.sort((a, b) => b.element.getBoundingClientRect().bottom - a.element.getBoundingClientRect().bottom)[0] ?? null;
}
export function observePromptDom(onChange) {
    const observer = new MutationObserver(() => onChange());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
}
