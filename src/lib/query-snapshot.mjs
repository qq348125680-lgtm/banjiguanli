/** Query-scoped cache identity. Changing page, size, filter or view invalidates only that list.
 * Identical query refreshes may keep their last successful snapshot.
 */
export function decideQuerySnapshot(previousKey, components) {
  if (!Array.isArray(components) || !components.length || components.some(v=>v===null || v===undefined || v==='')) {
    return {key:'',clear:true};
  }
  const key=JSON.stringify(components);
  return {key,clear:previousKey!==key};
}
