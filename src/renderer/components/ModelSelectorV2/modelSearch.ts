export function modelMatchesSearch(
  model: { modelId: string; modelName?: string },
  search: string,
  providerName = ''
): boolean {
  const query = search.trim().toLowerCase()
  return (
    !query || [providerName, model.modelId, model.modelName ?? ''].some((value) => value.toLowerCase().includes(query))
  )
}
