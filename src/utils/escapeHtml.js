// Values that come from a workbook or the API are data, never markup. Every template that builds an HTML string
// (upload reports written with document.write, for example) must pass each interpolated value through this.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}
