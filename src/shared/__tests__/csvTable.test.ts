import { describe, expect, it } from 'vitest'
import {
  csvColumnCount,
  csvDelimiterForPath,
  csvEolForText,
  parseCsv,
  serializeCsv,
} from '../csvTable'

describe('parseCsv', () => {
  it('parsea filas y columnas simples', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('respeta comillas con delimitadores dentro', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })

  it('desescapa comillas dobles', () => {
    expect(parseCsv('"di ""hola""",x')).toEqual([['di "hola"', 'x']])
  })

  it('admite saltos de línea dentro de comillas', () => {
    expect(parseCsv('"linea1\nlinea2",b')).toEqual([['linea1\nlinea2', 'b']])
  })

  it('acepta CRLF, LF y CR sueltos como fin de fila', () => {
    expect(parseCsv('a,b\r\n1,2\n3,4\r5,6')).toEqual([
      ['a', 'b'], ['1', '2'], ['3', '4'], ['5', '6'],
    ])
  })

  it('un salto final no genera una fila fantasma', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('conserva celdas vacías', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })

  it('texto vacío no da filas', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('acepta tabulador como delimitador', () => {
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('serializeCsv', () => {
  it('entrecomilla sólo cuando hace falta', () => {
    expect(serializeCsv([['a', 'b,c', 'd"e', 'f\ng']]))
      .toBe('a,"b,c","d""e","f\ng"')
  })

  it('no añade comillas superfluas', () => {
    expect(serializeCsv([['a', 'b'], ['1', '2']])).toBe('a,b\n1,2')
  })

  it('respeta delimitador y fin de línea pedidos', () => {
    expect(serializeCsv([['a', 'b'], ['1', '2']], { delim: '\t', eol: '\r\n' }))
      .toBe('a\tb\r\n1\t2')
  })
})

describe('ida y vuelta', () => {
  // Lo que importa de verdad: editar una celda no puede alterar las demás.
  it.each([
    'a,b\n1,2',
    '"con, coma",normal',
    '"con ""comillas""",x',
    '"multi\nlinea",y',
    'vacia,,final',
    '3e-06,0007,9007199254740993',
  ])('preserva %j', text => {
    expect(serializeCsv(parseCsv(text))).toBe(text)
  })

  it('no toca la precisión de números grandes ni la notación científica', () => {
    const rows = parseCsv('9007199254740993,3e-06,0007')
    expect(rows[0]).toEqual(['9007199254740993', '3e-06', '0007'])
  })
})

describe('ayudantes', () => {
  it('elige tabulador para .tsv y coma para el resto', () => {
    expect(csvDelimiterForPath('datos.tsv')).toBe('\t')
    expect(csvDelimiterForPath('datos.TSV')).toBe('\t')
    expect(csvDelimiterForPath('datos.csv')).toBe(',')
  })

  it('detecta el fin de línea dominante', () => {
    expect(csvEolForText('a,b\r\n1,2')).toBe('\r\n')
    expect(csvEolForText('a,b\n1,2')).toBe('\n')
  })

  it('cuenta columnas por la fila más ancha', () => {
    expect(csvColumnCount([['a'], ['a', 'b', 'c'], ['a', 'b']])).toBe(3)
    expect(csvColumnCount([])).toBe(0)
  })
})
