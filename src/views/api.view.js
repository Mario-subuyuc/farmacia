export function recordView(data) {
  return { data };
}

export function listView(data, count, pagination) {
  return { data, pagination: { page: pagination.page, limit: pagination.limit, total: count } };
}
