// utils/dateUtils.js
export const autoFormatDate = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let result = "";
  if (digits.length >= 2) result = digits.slice(0, 2);
  if (digits.length >= 4) result += "/" + digits.slice(2, 4);
  if (digits.length > 4) result += "/" + digits.slice(4);
  return result;
};

export const isValidDate = (ddmmyyyy) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(ddmmyyyy)) return false;
  const [d, m, y] = ddmmyyyy.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
};

export const toISODate = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split("/");
  return `${y}-${m}-${d}`;
};
