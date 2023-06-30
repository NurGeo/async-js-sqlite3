import { AsyncSQLite3 } from "./async-sqlite";

export const path = ':memory:';

export const getPersonSql = 'SELECT * FROM person WHERE govId=?';
export const getPhoneSql = 'SELECT * FROM phone WHERE personId=?';

export const createPersonTableSql = `CREATE TABLE person (
  govId TEXT PRIMARY KEY,
  firstName TEXT NOT NULL UNIQUE,
  lastName TEXT,
  age INTEGER,
  sex TEXT
) WITHOUT ROWID;`

export const createPhoneTableSql = `CREATE TABLE phone (
  personId TEXT,
  number TEXT NOT NULL UNIQUE,
  FOREIGN KEY (personId)
    REFERENCES person (govId)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
)`;

export type RawPerson = [string, string?, number?, string?];

export type Person = {
  govId: string,
  firstName: string,
  lastName?: string,
  age?: number,
  sex?: string,
}

export type Phone = {
  personId: string,
  number: string,
}

export const personsData: RawPerson[] = [
  ['Nuradil', 'Khoishin', 25, 'man'],
  ['Asem', 'Abdulina', 22, 'woman'],
  ['Artem', 'Nesterov', 45, 'man'],
  ['Jake', , 45, ],
  ['Ibrakhim', 'Kunaev', 18, 'man'],
  ['Elizaveta', 'Muhina', , 'woman'],
]

export function getRandomNumber(count: number): string {
  let result = '';
  for (let i = 0; i < count; i++)
    result += Math.round(Math.random() * 9);
  return result;
}

export async function addPerson(sut: AsyncSQLite3, rawPerson: RawPerson): Promise<string> {
  const govId = getRandomNumber(12);
  const personData = [govId, ...rawPerson];
  const result = await sut.run(`INSERT INTO person VALUES (?, ?, ?, ?, ?)`, personData);
  expect(result.lastID).toBe(0);
  expect(result.changes).toBe(1);
  return govId;
}

export async function addPhone(sut: AsyncSQLite3, personId: string): Promise<string> {
  const phoneNumber = '+7' + getRandomNumber(10);
  const result = await sut.run(`INSERT INTO phone VALUES (?, ?)`, personId, phoneNumber);
  expect(result.lastID > 0).toBe(true);
  expect(result.changes).toBe(1);
  return phoneNumber;
}

export async function expectPerson(sut: AsyncSQLite3, id: string, personTuple: RawPerson): Promise<void> {
  const person = await sut.get<Person>("SELECT * FROM person WHERE govId=?", id);
  expect(person.govId).toBe(id);
  expect(person.firstName).toBe(personTuple[0]);
  expect(person.lastName).toBe(personTuple[1] ?? null);
  expect(person.age).toBe(personTuple[2] ?? null);
  expect(person.sex).toBe(personTuple[3] ?? null);
}
