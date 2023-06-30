import { AsyncSQLite3 } from "./async-sqlite";
import {
  path, addPerson, addPhone,
  createPersonTableSql, createPhoneTableSql, getPersonSql,
  personsData,
  Person, Phone, getRandomNumber, RawPerson, expectPerson, getPhoneSql,
} from "./test-helper";

describe('Sqlite class tests', () => {
  describe('open, close db', () => {
    const sut = new AsyncSQLite3(path, 'write');
    test('success open and close db', async () => {
      expect(await sut.open()).toBe(path + ' opened');
      const result = await sut.run(createPersonTableSql);
      expect(result.lastID).toBe(0);
      expect(result.changes).toBe(0);
      expect(await sut.close()).toBe(path + ' closed');
    });

    test('fail, db not opened', async () => {
      const sql = 'any sql string';
      const methods = [sut.run, sut.all, sut.get, sut.each, sut.close];
      for (let method of methods) {
        try {
          // @ts-ignore
          await method.bind(sut, sql)();
          throw Error('not exepted');
        } catch (e) {
          expect(String(e)).toContain('database is not opened');
        }
      }
    })
  })

  describe('process fail', () => {
    const sut = new AsyncSQLite3(path, 'write');
    // open before test, and close after test
    beforeEach(async () => { await sut.open(); });
    afterEach(async () => { await sut.close(); });

    test('process any run, get, all, each exeption...', async () => {
      const notValidSql = 'CREATE TABLE ? (column_name TEXT)'
      try {
        // нельзя как параметр передавать ИМЕНА таблиц или имена столбцов
        // можно передавать только ЗНАЧЕНИЯ полей, например "... WHERE govId=?"
        // как видим
        const result = await sut.run(notValidSql, 'table_name');
        throw Error('not excepted');
      } catch(e) {
        expect(String(e)).toContain('syntax error');
      }
    })
  })

  describe('work with rowid table...', () => {
    const sut = new AsyncSQLite3(path, 'write');
    beforeEach(async () => { await sut.open(); await sut.run(createPhoneTableSql)});
    afterEach(async () => { await sut.close(); });
    test('created row with rowid value', async () => {
      const result = await sut.run('INSERT INTO phone VALUES (?, ?)', '000000000001', '+75551112233');
      expect(Object.keys(result).length).toBe(2);
      expect(typeof result.lastID).toBe('number');
      // new table always begined with 1;
      expect(result.lastID).toBe(1);
      // changes rows count of run;
      expect(result.changes).toBe(1);

      const phone = await sut.get<Phone & {rowid: number}>(
        'SELECT rowid, personId, number FROM phone WHERE rowid=' + result.lastID
      );
      expect(phone.rowid).toBe(result.lastID);
      expect(phone.personId).toBe('000000000001')
      expect(phone.number).toBe('+75551112233')
    })
  })

  describe('work with person, phone db...', () => {
    const sut = new AsyncSQLite3(path, 'write');
    describe('create table tests', () => {
      // open before test, and close after test
      beforeEach(async () => { await sut.open(); });
      afterEach(async () => { await sut.close(); });

      test('success create table', async () => {
        const result = await sut.run(createPersonTableSql);
        expect(Object.keys(result).length).toBe(2);
        expect(result.lastID).toBe(0);
        expect(result.changes).toBe(0);
      })
      test('success create table, insert row', async () => {
        await sut.run(createPersonTableSql);
        const id = await addPerson(sut, personsData[0]);
        expect(typeof id).toBe('string');
      })
    })

    describe('work with rows...', () => {
      beforeEach(async () => { await sut.open(); await sut.run(createPersonTableSql), await sut.run(createPhoneTableSql)});
      afterEach(async () => { await sut.close(); });

      describe('work and test params', () => {
        test('process sql string with params', async () => {
          const recordSql = "INSERT INTO person VALUES (?, ?, ?, ?, ?)";
          const id = getRandomNumber(12);
          const [lastName, firstName, age, sex] = personsData[1];
          const result = await sut.run(recordSql, id, lastName, firstName, age, sex);
          // not rowid attribute in person table
          expect(result.lastID).toBe(0);
          expect(result.changes).toBe(1);
          expectPerson(sut, id, personsData[1]);
        });

        test('process only sql string', async () => {
          const values = "('000000000001', 'PersonName', 'PersonLastName', 24, 'man')"
          const recordSql = "INSERT INTO person VALUES " + values;
          const result = await sut.run(recordSql);
          expect(result.changes).toBe(1);
          expectPerson(sut, '000000000001', ['PersonName', 'PersonLastName', 24, 'man']);
        });

        test('process sql string with number params', async () => {
          const id = getRandomNumber(12);
          const [lastName, firstName, age, sex] = personsData[1];
          const recordSql = "INSERT INTO person VALUES (?4, ?1, ?2, ?3, ?2)";
          // parameters not ordered by attrs and sex replaced to firstName!
          const result = await sut.run(recordSql, lastName, firstName, age, id);
          expect(result.changes).toBe(1);
          expectPerson(sut, id, [lastName, firstName, age, firstName]);
        });
        
        test('process sql string with named params by $', async () => {
          const attrs = {
            $id: getRandomNumber(12),
            $first: personsData[1][0],
            $last: personsData[1][1],
            $age: personsData[1][2],
            $sex: personsData[1][3],
          }
          const recordSql = "INSERT INTO person VALUES ($id, $first, $last, $age, $sex)";
          const result = await sut.run(recordSql, attrs);
          expect(result.changes).toBe(1);
          expectPerson(sut, attrs.$id, personsData[1]);
        });

        test('process sql string with named params by @', async () => {
          const attrs = {
            '@id': getRandomNumber(12),
            '@first': personsData[1][0],
            '@last': personsData[1][1],
            '@age': personsData[1][2],
            '@sex': personsData[1][3],
          }
          const recordSql = "INSERT INTO person VALUES (@id, @first, @last, @age, @sex)";
          const result = await sut.run(recordSql, attrs);
          expect(result.changes).toBe(1);
          expectPerson(sut, attrs['@id'], personsData[1]);
        });

        test('process sql string with named params by :', async () => {
          const attrs = {
            ':id': getRandomNumber(12),
            ':first': personsData[1][0],
            ':last': personsData[1][1],
            ':age': personsData[1][2],
            ':sex': personsData[1][3],
          }
          const recordSql = "INSERT INTO person VALUES (:id, :first, :last, :age, :sex)";
          const result = await sut.run(recordSql, attrs);
          expect(result.changes).toBe(1);
          expectPerson(sut, attrs[':id'], personsData[1]);
        });
      })

      describe('person and phone tables tests', () => {
        test('add person and phone', async () => {
          const id = await addPerson(sut, personsData[0]);
          const number = await addPhone(sut, id);
          expectPerson(sut, id, personsData[0]);
          const phone = await sut.get<Phone>(getPhoneSql, id);
          expect(phone).not.toBeUndefined();
          expect(phone.personId).toBe(id);
          expect(phone.number).toBe(number);
        })

        test('test many phones case', async () => {
          async function expectPhones(personId: string, phoneCount: number) {
            // const phonesSql = `SELECT person.govId, person.firstName, number FROM phone,
            //   (SELECT govId, firstName FROM person WHERE govId=?1) as person
            //   WHERE personId=?1`
            const phonesSql2 = `
              SELECT govId, firstName, number FROM phone 
                JOIN (SELECT govId, firstName FROM person WHERE govId=?1)
              WHERE personId=?1`
            const phones = await sut.all<{govId: string, firstName: string, number: string}>(phonesSql2, personId);
            expect(Array.isArray(phones)).toBe(true);
            expect(phones.length).toBe(phoneCount);
            phones.forEach(phone => {expect(phone.govId).toBe(personId)})
            phones.forEach(phone => {
              const firstName = personsData.find(data => data[0] === phone.firstName)![0]
              expect(phone.firstName).toBe(firstName)
            })
            phones.forEach(phone => {expect(typeof phone.number).toBe('string')})
            phones.forEach(phone => {expect(phone.number.length).toBe(12)})
          }

          const ids: string[] = [];
          for (const data of personsData) {
            ids.push(await addPerson(sut, data));
          }
          addPhone(sut, ids[1]);
          addPhone(sut, ids[1]);
          addPhone(sut, ids[2]);
          addPhone(sut, ids[4]);

          await expectPhones(ids[0], 0);
          await expectPhones(ids[1], 2);
          await expectPhones(ids[2], 1);
          await expectPhones(ids[3], 0);
          await expectPhones(ids[4], 1);

        })
      })

      describe('update row tests', () => {
        test('success, update one attrs', async () => {
          const raw = personsData[0];
          const id = await addPerson(sut, raw);
          const beforeUpdatePerson = await sut.get<Person>(getPersonSql, id);
          expect(beforeUpdatePerson.govId).toBe(id);
          expect(beforeUpdatePerson.age).toBe(raw[2]);

          const updateSql = 'UPDATE person SET age=$value WHERE govId=$govId'
          const params = {$value: 33, $govId:id};
          const updateResult = await sut.run(updateSql, params);
          expect(Object.keys(updateResult).length).toBe(2);
          expect(updateResult.lastID).toBe(0);
          expect(updateResult.changes).toBe(1);
          const afterUpdatePerson = await sut.get<Person>(getPersonSql, id);
          expect(afterUpdatePerson.govId).toBe(id);
          expect(afterUpdatePerson.firstName).toBe(raw[0]);
          expect(afterUpdatePerson.lastName).toBe(raw[1]);
          expect(afterUpdatePerson.age).toBe(33);
          expect(afterUpdatePerson.sex).toBe(raw[3]);
        })

        test('success, update multiple attrs', async () => {
          const raw = personsData[3];
          const id = await addPerson(sut, raw);
          const beforeUpdatePerson = await sut.get<Person>(getPersonSql, id);
          expect(beforeUpdatePerson.govId).toBe(id);
          expect(beforeUpdatePerson.age).toBe(raw[2]);

          const updateSql = 'UPDATE person SET (age, sex)=($age, $sex) WHERE govId=$govId'
          const params = {$age: 63, $sex: 'other', $govId:id};
          const updateResult = await sut.run(updateSql, params);
          expect(Object.keys(updateResult).length).toBe(2);
          expect(updateResult.lastID).toBe(0);
          expect(updateResult.changes).toBe(1);
          const afterUpdatePerson = await sut.get<Person>(getPersonSql, id);
          expect(afterUpdatePerson.govId).toBe(id);
          expect(afterUpdatePerson.firstName).toBe(raw[0]);
          expect(afterUpdatePerson.lastName).toBe(null);
          expect(afterUpdatePerson.age).toBe(63);
          expect(afterUpdatePerson.sex).toBe('other');
        })

        test('success, but not updated rows', async () => {
          const raw = personsData[2];
          const id = await addPerson(sut, raw);

          const updateSql = 'UPDATE person SET age=12 WHERE govId="notValidId"'
          const updateResult = await sut.run(updateSql);
          expect(updateResult.lastID).toBe(0);
          expect(updateResult.changes).toBe(0);

          const notUpdatedPerson = await sut.get<Person>(getPersonSql, id);
          expect(notUpdatedPerson.govId).toBe(id);
          expect(notUpdatedPerson.firstName).toBe(raw[0]);
          expect(notUpdatedPerson.lastName).toBe(raw[1]);
          expect(notUpdatedPerson.age).toBe(raw[2]);
          expect(notUpdatedPerson.sex).toBe(raw[3]);
        })

        test('fail, not updated rows', async () => {
          const raw = personsData[2];
          const id = await addPerson(sut, raw);

          // нельзя добавлять как параметр имени столбцов
          const updateSql = 'UPDATE person SET ?=? WHERE govId=?'
          const updateCb = async () => await sut.run(updateSql, 'age', 15, id);
          try {
            await updateCb();
          } catch (e) {
            expect(String(e)).toContain('syntax error');
          }
        })
      })
    })
  })
})
