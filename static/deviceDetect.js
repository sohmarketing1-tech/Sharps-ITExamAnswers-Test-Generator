export function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 0)
  );
}

export function isMouseOnlyDevice() {
  return !isTouchDevice();
}
