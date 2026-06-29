import type { UserRole } from '../types'

export interface CsvMember {
  name: string
  role: UserRole
  contact: string
}

export interface CsvParseResult {
  members: CsvMember[]
  errors: string[]
}

const roleAliases: Record<string, UserRole> = {
  administrateur: 'admin',
  admin: 'admin',
  'responsable catégorie': 'manager',
  'responsable categorie': 'manager',
  responsable: 'manager',
  manager: 'manager',
  bénévole: 'volunteer',
  benevole: 'volunteer',
  utilisateur: 'volunteer',
  volunteer: 'volunteer',
}

function splitRow(row: string, separator: string) {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index]
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === separator && !quoted) {
      values.push(value.trim())
      value = ''
    } else {
      value += character
    }
  }
  values.push(value.trim())
  return values
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function parseMembersCsv(content: string): CsvParseResult {
  const rows = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(row => row.trim())
  if (!rows.length) return { members: [], errors: ['Le fichier est vide.'] }

  const separator = (rows[0].match(/;/g)?.length ?? 0) >= (rows[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = splitRow(rows[0], separator).map(normalize)
  const column = (...names: string[]) => headers.findIndex(header => names.includes(header))
  const nameIndex = column('nom', 'name')
  const roleIndex = column('role')
  const emailIndex = column('email', 'e-mail')
  const phoneIndex = column('telephone', 'tel', 'phone')

  if (nameIndex < 0 || roleIndex < 0 || (emailIndex < 0 && phoneIndex < 0)) {
    return { members: [], errors: ['En-têtes requis : nom, role, et au moins email ou telephone.'] }
  }

  const members: CsvMember[] = []
  const errors: string[] = []
  rows.slice(1).forEach((row, index) => {
    const values = splitRow(row, separator)
    const name = values[nameIndex]?.trim() ?? ''
    const rawRole = values[roleIndex]?.trim() ?? ''
    const role = roleAliases[rawRole.toLocaleLowerCase('fr')]
    const email = emailIndex >= 0 ? values[emailIndex]?.trim() : ''
    const phone = phoneIndex >= 0 ? values[phoneIndex]?.trim() : ''
    const contact = email || phone || ''
    const line = index + 2
    if (!name) errors.push(`Ligne ${line} : nom manquant.`)
    else if (!role) errors.push(`Ligne ${line} : rôle « ${rawRole || 'vide'} » non reconnu.`)
    else if (!contact) errors.push(`Ligne ${line} : email ou téléphone manquant.`)
    else members.push({ name, role, contact })
  })
  return { members, errors }
}

export const membersCsvTemplate = `nom;role;email;telephone
Marie Dupont;bénévole;marie.dupont@example.fr;06 12 34 56 78
Paul Martin;responsable catégorie;paul.martin@example.fr;
Anne Bernard;administrateur;;06 98 76 54 32
`
