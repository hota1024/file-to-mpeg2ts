import { BitStream, BitView } from 'bit-buffer'
import { chunk, chunkBuffer, indexed } from '../helpers'
import { IEncoder } from './IEncoder'

/**
 * EncoderOptions type.
 */
export type EncoderOptions = {
  /**
   * packet identifier.
   */
  pid: number

  /**
   * head size(bytes).
   */
  headSize?: number

  /**
   * map buffers.
   *
   * @param buffer current buffer.
   * @param index current index.
   * @param buffers array of all buffers.
   */
  preMap?(buffer: Buffer, index: number, buffers: Buffer[]): Buffer
}

/**
 * Encoder class.
 */
export class Encoder implements IEncoder {
  /**
   * max size of ts file(bytes).
   */
  readonly tsMaxSize: number = 65536

  /**
   * packet size(bytes).
   */
  readonly packetSize: number = 188

  /**
   * ts header size(bytes).
   */
  readonly headerSize: number = 8

  /**
   * payload size(bytes).
   */
  readonly payloadSize: number = this.packetSize - this.headerSize

  /**
   * ts max packets.
   */
  readonly tsMaxPackets: number = Math.floor(this.tsMaxSize / this.packetSize)

  /**
   * head size(bytes).
   */
  readonly headSize: number = 0

  /**
   * sync byte.
   */
  readonly syncByte: number = 0x47

  /**
   * max value of continuty counter.
   */
  readonly maxContinutyCounter: number = 16

  readonly preMap: EncoderOptions['preMap'] = (buffer) => buffer

  /**
   * packet identifier.
   */
  readonly pid: number

  constructor(options: EncoderOptions) {
    this.pid = options.pid
    this.headSize = options.headSize ?? this.headSize
    this.preMap = options.preMap ?? this.preMap
  }

  encode(buffer: Buffer): Buffer[] {
    const rawBuffers = this.chunkRawBuffer(buffer)
    const buffers = this.setHeads(rawBuffers).map((buffer, i) =>
      this.createPacket(buffer, i)
    )
    const tsPackets = chunk(buffers, this.tsMaxPackets)

    const tsList = tsPackets.map((packets) => {
      return Buffer.concat(packets)
    })

    return tsList
  }

  /**
   * create a packet.
   *
   * @param buffer buffer.
   * @param counter counter.
   */
  private createPacket(buffer: Buffer, counter: number) {
    counter %= this.maxContinutyCounter

    const view = new BitView(Buffer.alloc(this.packetSize, 0xff))
    const stream = new BitStream(view)

    stream['bigEndian'] = true

    view.setBits(0, this.syncByte, 8)

    view.setBits(8, 0b0, 1) // TEI
    view.setBits(9, 0b1, 1) // PUSI
    view.setBits(10, 0b0, 1) // transport priority
    view.setBits(11, this.pid, 13) // PID

    view.setBits(24, 0b00, 2) // TSC
    view.setBits(26, 0b00, 0b01) // adaptation field control(0b01 = pyaload)
    view.setBits(28, counter, 4) // continuity counter

    buffer.forEach((byte, index) => {
      view.setBits(4 * 8 + index * 8, byte, 8)
    })

    return view.buffer
  }

  /**
   * set heads to each buffer.
   *
   * @param buffers buffers.
   */
  private setHeads(buffers: Buffer[]) {
    const result: Buffer[] = []

    for (const [i, buffer] of indexed(buffers)) {
      const mapped = this.preMap(buffer, i, buffers)
      result.push(mapped)
    }

    return result
  }

  /**
   * chunk given buffer.
   *
   * @param buffer buffer.
   */
  private chunkRawBuffer(buffer: Buffer) {
    const chunkSize = this.payloadSize - this.headSize
    const chunked = chunkBuffer(buffer, chunkSize)

    return chunked
  }
}
