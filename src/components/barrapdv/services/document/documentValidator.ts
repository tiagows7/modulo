/** Validação de CPF/CNPJ (mesmo critério do AppSiTef). */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false

  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += Number(d[i]) * (10 - i)
  let dig = (sum * 10) % 11
  if (dig === 10) dig = 0
  if (dig !== Number(d[9])) return false

  sum = 0
  for (let i = 0; i < 10; i += 1) sum += Number(d[i]) * (11 - i)
  dig = (sum * 10) % 11
  if (dig === 10) dig = 0
  return dig === Number(d[10])
}

export function isValidCnpj(cnpj: string): boolean {
  const d = onlyDigits(cnpj)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false

  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const d1 = calc(d, w1)
  const d2 = calc(d, w2)
  return d1 === Number(d[12]) && d2 === Number(d[13])
}

export function formatCpfCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
