/**
 * chunk given buffer by given size.
 */
export const chunkBuffer = (buffer: Buffer, size: number): Buffer[] => {
  const chunked: Buffer[] = []
  let i = 0

  while (i < buffer.length) {
    chunked.push(buffer.slice(i, (i += size)))
  }

  return chunked
}
