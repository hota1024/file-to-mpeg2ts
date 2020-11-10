export const chunk = <T extends any[]>(array: T, size: number): T[] => {
  return array.reduce(
    (newArray, _, i) =>
      i % size ? newArray : [...newArray, array.slice(i, i + size)],
    [] as T[][]
  )
}
