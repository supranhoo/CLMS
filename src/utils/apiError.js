// One place that turns whatever a failed request threw into text a person can act on.
// The local API answers errors as { success:false, message, error }; the recovered screens were written against a
// SQL Server shape (error.originalError.info.message), which is kept as a fallback so both read correctly.

/** The message to show for a failed axios call (or any thrown value). Never throws. */
export function apiErrorMessage(error, fallback = 'The request could not be completed.') {
  const data = error?.response?.data;
  const candidates = [
    data?.message,
    typeof data?.error === 'string' ? data.error : undefined,
    data?.error?.originalError?.info?.message,
    data?.error?.message,
    typeof data === 'string' ? data : undefined,
  ];
  const found = candidates.find((text) => typeof text === 'string' && text.trim());
  if (found) return found.trim();
  if (error?.response) return `${fallback} (HTTP ${error.response.status})`;
  if (error?.request) return 'The local API did not respond. Check that it is running on 127.0.0.1:5001.';
  return typeof error?.message === 'string' && error.message ? error.message : fallback;
}
