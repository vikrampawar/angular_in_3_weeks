// need cookieParser middleware before we can do anything with cookies

import fs from 'fs';

//TODO: Should the hardcoded filename be read from a variable provided by json-server?
const dbFile = './database.json';

// Initialized to empty, this is where we save who is currently
// logged on to the server.
// 
// When someone successfully authenticates, we associate their
// identity (user account info) with the auth token that's in
// the "auth" cookie.
//
// The identity is a user record taken from the database.
//
// Each session will be an object with:
// - token: toString
// - user: {username, creditCard, etc.}
const sessions = [];

export function authRouter(app) {

  // If the user sent an 'auth' cookie, set req.user.
  // This should be run on every request.
  app.use((req, res, next) => {
    // check if client sent 'auth' cookie
    let cookie = req.cookies?.auth;
    if (cookie) {
      const user = sessions.find(s => s.token === cookie)
      console.log("found user:", user)
      req.user = user;
    }
    next();
  });

  // POST /login - if good username/password, write an auth token.
  app.use((req, res, next) => {
    if (req._parsedUrl.path === "/login" && req.method === "POST") {
      const { username, password } = req.body;
      console.log(`User:"${username}", Pass:"${password}"`);
      const db = readDatabase();
      const users = db.users;
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        // Create a session token
        const cookieVal = makeCookie()
        // Write it as a cookie
        res.cookie('auth', cookieVal, { maxAge: 20 * 60 * 1000 /* 20 minutes */, httpOnly: true });
        // Save it here in global memory along with the user.
        sessions.push({ token: cookieVal, user: { ...user, token: cookieVal } })
        res.status(200).send({ ...user, password: "****", token: cookieVal });
      } else {
        res.status(401).send("Bad username or password");
      }
    } else {
      next();
    }
  });

  // POST /register 
  app.use((req, res, next) => {
    if (req._parsedUrl.path === "/register" && req.method === "POST") {
      const newUser = req.body;
      const { username, password, email, name, phone, credit_card } = newUser;
      console.log('hit register', username, password)

      if (!username || !password) {
        res.status(401).send(`Username and password are needed to register`);
        return;
      }
      const db = readDatabase();
      const { users } = db;

      let user;
      user = users.find(u => u.username === username);
      if (user) {
        res.status(400).send(`${username} already exists. Login or register with a different username.`);
        return;
      }
      user = users.find(u => u.email === email);
      if (user) {
        res.status(400).send(`${email} already exists. Login or register with a different email.`);
        return;
      }

      user = { id: getNextUserId(users), ...newUser, adminUser: false };

      db.users.push(user);
      saveDatabase(db);
      res.status(200).send(user)
    } else {
      next();
    }
  });

  // DEBUGGING ONLY: Did we write a cookie?
  // app.use(function (req, res, next) {
  //   // check if client sent 'auth' cookie
  //   let cookie = req.cookies?.auth;
  //   if (cookie === undefined) {
  //     console.log(`no auth cookie`);
  //   } else {
  //     console.log('auth cookie exists', cookie);
  //   }
  //   next();
  // });

}

function readDatabase() {
  return JSON.parse(fs.readFileSync(dbFile));
}
function saveDatabase(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db));
}

function makeCookie() {
  return `daam-${Math.random().toString().substring(2)}`
}

export const getNextUserId = (users) =>
  users.reduce((prev, curr) => (prev > curr.id) ? prev : curr.id, 0) + 1;
