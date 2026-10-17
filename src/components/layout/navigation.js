export function normalizePath(value = "") {
  const path = String(value || "/").replace(/\/+$/, "") || "/";
  return path.toLowerCase();
}

export function organizeMenu(rows = []) {
  const menu = Array.isArray(rows) ? rows : [];
  const byId = new Map(menu.map((item) => [String(item.menu_id), { ...item, children: [] }]));
  const roots = [];

  byId.forEach((item) => {
    const parentId = String(item.parent_menu_id ?? "0");
    const parent = byId.get(parentId);
    if (parent && parent !== item) parent.children.push(item);
    else roots.push(item);
  });

  return roots;
}

export function flattenMenu(groups = []) {
  return groups.flatMap((group) => [
    ...(group.menu_url ? [group] : []),
    ...(group.children || []).filter((item) => item.menu_url),
  ]);
}

export function routeMatches(currentPath, targetPath) {
  const current = normalizePath(currentPath);
  const target = normalizePath(targetPath);
  return current === target || (target !== "/" && current.startsWith(`${target}/`));
}

export function routeLabel(path = "") {
  return String(path)
    .replace(/^\//, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Dashboard";
}
