import * as fs from 'fs'
import chalk from 'chalk'
import { Encoder } from './Encoder/Encoder'
import { chunkBuffer, indexed } from './helpers'
import cli from 'cli-ux'

function encode(input: string, output: string, prefix = ''): void {
  const buffer = fs.readFileSync(input)

  const encoder = new Encoder({
    pid: 0x30,
    headSize: 4,
    preMap(buffer, index, buffers) {
      let status

      if (index === 0) {
        status = 0x00
      } else if (index === buffers.length - 1) {
        status = 0x02
      } else {
        status = 0x01
      }

      const result = Buffer.concat([
        Buffer.from([status, 0x00, 0x00, 0x00]),
        buffer,
      ])

      return result
    },
  })
  const files = encoder.encode(buffer) // files are an array of ts file buffer

  for (const [i, file] of indexed(files)) {
    fs.writeFileSync(`${output}/${prefix}${i}.ts`, file)
  }

  console.log(chalk.yellow(`generated ${files.length} ts files from ${input}.`))
}

function decode(input: string, output: string, ext: string): void {
  type Group = {
    groupName: string
    indexes: number[]
  }

  const groups: Group[] = []

  const dir = fs.readdirSync(input)

  for (const file of dir) {
    const matches = file.match(/^(.*)-(\d+)\.ts/)

    if (!matches) {
      continue
    }

    const groupName = matches[1]
    const index = parseInt(matches[2])

    const group = groups.find((g) => g.groupName === groupName)

    if (group) {
      group.indexes.push(index)
    } else {
      groups.push({
        groupName,
        indexes: [index],
      })
    }
  }

  groups.forEach((g) => {
    g.indexes = g.indexes.sort((a, b) => a - b)

    return g
  })

  for (const group of groups) {
    let file: Buffer

    const bar = cli.progress({
      format: `merging group ${group.groupName}... [{bar}] | {value} / {total} files`,
    })
    bar.start(group.indexes.length, 0)

    for (const [index, i] of indexed(group.indexes)) {
      const ts = fs.readFileSync(`${input}/${group.groupName}-${i}.ts`)
      const packets = chunkBuffer(ts, 188)

      bar.update(index + 1)

      for (const packet of packets) {
        const payload = packet.slice(4)
        const head = payload.slice(0, 4)
        const shard = payload.slice(4)

        const status = head[0]

        if (status === 0x00) {
          file = shard
        } else if (status === 0x01) {
          file = Buffer.concat([file, shard])
        } else if (status === 0x02) {
          file = Buffer.concat([file, shard])
        }
      }
    }

    fs.writeFileSync(`${output}/${group.groupName}.${ext}`, file)
    bar.stop()
    console.log(
      chalk.yellow(
        `decoded ${group.groupName} ts files to ${output}/${group.groupName}.${ext}\n`
      )
    )
  }
}

;(async () => {
  const files = ['test0', 'test1', 'test2']
  files.forEach((file) => encode(`input/${file}.jpg`, 'out', `${file}-`))
  console.log(chalk.blue('\nencoded all images to ts files.\n'))

  await cli.anykey()
  console.log()

  decode('out', 'decoded', 'jpg')
})()
