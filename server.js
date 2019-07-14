const Koa = require('koa');
const cors = require('@koa/cors');
const mount = require('koa-mount');
const graphql = require('graphql');
const graphqlHTTP = require('koa-graphql');
const sqlite3 = require('sqlite3').verbose();
const app = new Koa();

const database = new sqlite3.Database('./my.db');
const createContactTable = () => {
    const query = `
    CREATE TABLE IF NOT EXISTS contacts (
    id integer PRIMARY KEY,
    firstName text,
    lastName text,
    email text UNIQUE)`;
    return database.run(query);
};
// 创建了一个 SQL 表来存储 contacts的基本信息。每个 contact 的基本信息包括：唯一的标识、名、姓和 email。
createContactTable();

// 定义一个 GraphQL 类型
// 使用基本的内置 GraphQL 类型，如 GraphQLID 和 GraphQLString 来创建我们自定义类型，对应数据库中的 contact。
const ContactType = new graphql.GraphQLObjectType({
    name: 'Contact',
    fields: {
        id: { type: graphql.GraphQLID },
        firstName: { type: graphql.GraphQLString },
        lastName: { type: graphql.GraphQLString },
        email: { type: graphql.GraphQLString },
    },
});

// 定义查询类型 
// 查询有两个字段： contacts，可以用来获取数据库中的所有 contacts，而 contact 则根据 id 获取一个 contact 信息。 contact 字段允许所需的 id 参数为 GraphQLID 类型。
var queryType = new graphql.GraphQLObjectType({  
    name: 'Query',
    fields: {
        contacts: {
            type: graphql.GraphQLList(ContactType),
            resolve: (root, args, context, info) => {
                return new Promise((resolve, reject) => {
                    database.all("SELECT * FROM contacts;", function (err, rows) {
                        if (err) {
                            reject([]);
                        }
                        resolve(rows);
                    });
                });

            }
        },
        contact: {
            type: ContactType, // 说明返回数据的类型
            args: { // 定义期望从客户端得到的参数
                id: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLID)
                }
            },
            resolve: (root, { // 实际逻辑发生的地方
                id     // resolve()方法的第二个参数访问任何传递的参数
            }, context, info) => {
                // 简单调用 database.all() 和 database.run() 方法来执行正确的 SQL 查询，以便从 SQLite 获取数据，返回一个 Promise 来处理得到的数据。
                return new Promise((resolve, reject) => {

                    database.all("SELECT * FROM contacts WHERE id = (?);", [id], function (err, rows) {
                        if (err) {
                            reject(null);
                        }
                        resolve(rows[0]);
                    });
                });
            }
        }
    }
});

// 创建一个 mutation 类型，用于创建、更新和删除操作
var mutationType = new graphql.GraphQLObjectType({  
    name: 'Mutation',
    fields: { // 所有的字段都接受符合 args 属性定义的参数，并由一个 resolve() 方法来获取传递过来的参数，执行相应的 SQL 操作，并返回一个 Promise。
        createContact: { // 创建 contacts
            type: ContactType,
            args: {
                firstName: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                },
                lastName: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                },
                email: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                }
            },
            resolve: (root, {
                firstName,
                lastName,
                email
            }) => {
                return new Promise((resolve, reject) => {
                    database.run('INSERT INTO contacts (firstName, lastName, email) VALUES (?,?,?);', [firstName, lastName, email], (err) => {
                        if (err) {
                            reject(null);
                        }
                        database.get("SELECT last_insert_rowid() as id", (err, row) => {

                            resolve({
                                id: row["id"],
                                firstName: firstName,
                                lastName: lastName,
                                email: email
                            });
                        });
                    });
                })

            }
        },
        updateContact: { // 更新 contacts
            type: graphql.GraphQLString,
            args: {
                id: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLID)
                },
                firstName: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                },
                lastName: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                },
                email: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLString)
                }
            },
            resolve: (root, {
                id,
                firstName,
                lastName,
                email
            }) => {
                return new Promise((resolve, reject) => {
                    database.run('UPDATE contacts SET firstName = (?), lastName = (?), email = (?) WHERE id = (?);', [firstName, lastName, email, id], (err) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(`Contact #${id} updated`);

                    });
                })
            }
        },
        deleteContact: { // 删除 contacts
            type: graphql.GraphQLString,
            args: {
                id: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLID)
                }
            },
            resolve: (root, {
                id
            }) => {
                return new Promise((resolve, reject) => {
                    database.run('DELETE from contacts WHERE id =(?);', [id], (err) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(`Contact #${id} deleted`);

                    });
                })

            }
        }
    }
});


// 创建 GraphQL schema
// GraphQL schema 是 GraphQL 的核心概念，它定义了连接到服务器的客户端可用的功能。我们传递已定义的 query 和 mutation 类型到 schema。
const schema = new graphql.GraphQLSchema({  
    query: queryType,
    mutation: mutationType
});

app.use(cors());

app.use(
    mount(
        '/graphql',
        graphqlHTTP({
            schema: schema,
            graphiql: true, //是否开启本地调试模式
        })
    )
);

app.use(async ctx => {
    ctx.body = 'Hello World';
});

app.listen(3000,() => {  
    console.log("GraphQL server running at http://localhost:3000");
});