/**
 * Encoder interface.
 */
export interface IEncoder {
  /**
   * encode buffer to ts buffers.
   *
   * @param buffer buffer.
   */
  encode(buffer: Buffer): Buffer[]
}
